// pages/routes/plan/plan.js - 路线规划页（核心）
// Bug修复：移除景点使用 stable index + filter；增加本地数据回退

Page({
  data: {
    selectedAttractions: [],
    routeCalculated: false,
    routeCalculating: false,
    plannedStops: [],
    mapStops: [],
    mapHeight: 500,
    currentStopIndex: 0,
    totalDistance: 0,
    estimatedTime: 0,
    routeName: '',
    systemInfo: {}
  },

  onLoad: function (options) {
    var sysInfo = wx.getSystemInfoSync();
    this.setData({
      systemInfo: sysInfo,
      mapHeight: Math.floor(sysInfo.windowHeight * 0.45)
    });

    this.loadSelectedAttractions();
  },

  onShow: function () {
    this.loadSelectedAttractions();
  },

  // ========== 加载已选景点 ==========
  loadSelectedAttractions: async function () {
    var that = this;
    var selectedIds = wx.getStorageSync('selectedAttractionIds') || [];

    if (selectedIds.length === 0) {
      that.setData({ selectedAttractions: [] });
      return;
    }

    // 1. 尝试云函数获取景点详情
    if (wx.cloud) {
      try {
        var res = await wx.cloud.callFunction({
          name: 'getAttractions',
          data: { action: 'byIds', ids: selectedIds }
        });

        if (res.result && res.result.list) {
          that.setData({ selectedAttractions: res.result.list });
          return;
        }
      } catch (err) {
        console.error('加载景点失败:', err);
      }
    }

    // 2. 从全局缓存查找
    var app = getApp();
    var cached = app.globalData.cachedAttractions;
    if (cached) {
      var foundList = selectedIds.map(function (id) {
        for (var i = 0; i < cached.length; i++) {
          if (cached[i]._id === id) return cached[i];
        }
        return null;
      }).filter(Boolean);

      if (foundList.length > 0) {
        that.setData({ selectedAttractions: foundList });
        return;
      }
    }

    // 3. 回退本地数据
    var defaultData = require('../../../data/defaultData.js');
    var localList = selectedIds.map(function (id) {
      for (var j = 0; j < defaultData.defaultAttractions.length; j++) {
        if (defaultData.defaultAttractions[j]._id === id) return defaultData.defaultAttractions[j];
      }
      return null;
    }).filter(Boolean);

    that.setData({ selectedAttractions: localList });
  },

  // ========== 操作景点 ==========

  // 添加景点（跳转景点列表选择模式）
  onAddAttraction: function () {
    var currentIds = this.data.selectedAttractions.map(function (a) { return a._id; });
    wx.setStorageSync('selectedAttractionIds', currentIds);
    wx.navigateTo({ url: '/pages/attractions/list/list?mode=select' });
  },

  // 移除景点 【Bug修复：使用稳定方法避免 splice 后下标错位】
  onRemoveAttraction: function (e) {
    var index = e.currentTarget.dataset.index;
    var selectedAttractions = this.data.selectedAttractions.slice();
    var removedId = selectedAttractions[index] ? selectedAttractions[index]._id : null;

    // 从数组中移除对应项
    var newAttractions = selectedAttractions.filter(function (_, i) { return i !== index; });

    this.setData({ selectedAttractions: newAttractions });

    // 更新缓存
    var ids = newAttractions.map(function (a) { return a._id; });
    wx.setStorageSync('selectedAttractionIds', ids);

    // 如果已规划路线，同步移除对应景点
    if (this.data.routeCalculated && removedId) {
      var plannedStops = this.data.plannedStops.filter(function (stop) {
        return (stop.attractionId || stop.id) !== removedId;
      });
      this.setData({
        plannedStops: plannedStops,
        mapStops: plannedStops.map(function (s, i) {
          return {
            id: s.attractionId || s.id,
            name: s.name,
            latitude: s.location.latitude,
            longitude: s.location.longitude,
            distance: s.distanceFromPrev
          };
        })
      });
    }
  },

  // ========== 智能路线规划 ==========
  onPlanRoute: async function () {
    var that = this;

    if (that.data.selectedAttractions.length < 2) {
      wx.showToast({ title: '至少选择2个景点', icon: 'none' });
      return;
    }

    that.setData({ routeCalculating: true });

    // 1. 尝试云函数智能规划
    if (wx.cloud) {
      try {
        var currentLocation = null;
        try {
          var locRes = await wx.getLocation({ type: 'gcj02' });
          currentLocation = {
            latitude: locRes.latitude,
            longitude: locRes.longitude
          };
        } catch (e) {
          // 无位置授权也继续
        }

        var res = await wx.cloud.callFunction({
          name: 'planRoute',
          data: {
            attractionIds: that.data.selectedAttractions.map(function (a) { return a._id; }),
            startLocation: currentLocation
          }
        });

        that.setData({ routeCalculating: false });

        if (res.result && res.result.plannedStops) {
          that.applyPlanResult(res.result.plannedStops, res.result.totalDistance || 0, res.result.estimatedTime || 0);
          return;
        }

        if (res.result && res.result.error) {
          wx.showToast({ title: res.result.error, icon: 'none' });
          that.setData({ routeCalculating: false });
          return;
        }
      } catch (err) {
        console.error('路线规划失败:', err);
      }
    }

    // 2. 回退：本地简单排序（按选择顺序，不做邻居贪心）
    that.setData({ routeCalculating: false });
    var stops = that.data.selectedAttractions.map(function (a, i) {
      return {
        id: a._id,
        name: a.name,
        location: a.location || { latitude: 0, longitude: 0 },
        distanceFromPrev: 0
      };
    });

    that.applyPlanResult(stops, 0, 0);
    wx.showToast({ title: '已按选择顺序排列（请配置云开发以启用智能规划）', icon: 'none' });
  },

  // 应用规划结果
  applyPlanResult: function (plannedStops, totalDistance, estimatedTime) {
    var that = this;

    var mapStops = plannedStops.map(function (stop, index) {
      return {
        id: stop.attractionId || stop.id,
        name: stop.name,
        latitude: (stop.location && stop.location.latitude) || 0,
        longitude: (stop.location && stop.location.longitude) || 0,
        distance: stop.distanceFromPrev,
        icon: stop.icon || ''
      };
    });

    that.setData({
      routeCalculated: true,
      plannedStops: plannedStops,
      mapStops: mapStops,
      totalDistance: totalDistance ? parseFloat(totalDistance).toFixed(1) : '0.0',
      estimatedTime: estimatedTime ? parseFloat(estimatedTime).toFixed(1) : '0.0',
      currentStopIndex: 0,
      routeName: ''
    });

    // 通知地图组件
    var mapRoute = that.selectComponent('#planMapRoute');
    if (mapRoute) {
      setTimeout(function () {
        mapRoute.updateRoute(mapStops);
      }, 300);
    }
  },

  // 景点切换
  onStopChange: function (e) {
    this.setData({ currentStopIndex: e.detail.index });
  },

  onPlannedStopTap: function (e) {
    var index = e.currentTarget.dataset.index;
    this.setData({ currentStopIndex: index });

    var mapRoute = this.selectComponent('#planMapRoute');
    if (mapRoute) mapRoute.focusOnStop(index);
  },

  // 重新规划
  onResetRoute: function () {
    this.setData({
      routeCalculated: false,
      plannedStops: [],
      mapStops: [],
      totalDistance: 0,
      estimatedTime: 0,
      routeName: ''
    });
  },

  onRouteNameInput: function (e) {
    this.setData({ routeName: e.detail.value });
  },

  // ========== 保存路线 ==========
  onSaveRoute: async function () {
    var app = getApp();
    if (!app.checkLogin()) return;

    var routeName = this.data.routeName.trim();
    if (!routeName) {
      wx.showToast({ title: '请输入路线名称', icon: 'none' });
      return;
    }

    if (!wx.cloud) {
      wx.showToast({ title: '请先配置云开发环境', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    try {
      var res = await wx.cloud.callFunction({
        name: 'saveRoute',
        data: {
          name: routeName,
          description: routeName + ' - ' + this.data.plannedStops.length + '个景点',
          attractions: this.data.plannedStops.map(function (stop, index) {
            return {
              attractionId: stop.attractionId || stop.id,
              order: index,
              name: stop.name,
              location: stop.location
            };
          }),
          totalDistance: parseFloat(this.data.totalDistance),
          estimatedTime: parseFloat(this.data.estimatedTime),
          tags: []
        }
      });

      wx.hideLoading();

      if (res.result && res.result.success) {
        // 清除全局路线缓存（下次加载时刷新）
        app.refreshCache('routes');

        wx.showToast({ title: '路线保存成功', icon: 'success' });
        wx.removeStorageSync('selectedAttractionIds');

        setTimeout(function () {
          wx.redirectTo({
            url: '/pages/routes/detail/detail?id=' + res.result.routeId
          });
        }, 1500);
      } else {
        wx.showToast({ title: (res.result && res.result.error) || '保存失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('保存路线失败:', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  onShareAppMessage: function () {
    return {
      title: '去俺村 - 智能规划你的旅游路线',
      path: '/pages/routes/plan/plan'
    };
  }
});
