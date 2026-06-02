// pages/routes/plan/plan.js - 路线规划页逻辑（核心）
const app = getApp();

Page({
  data: {
    // 已选景点
    selectedAttractions: [],
    // 是否已计算路线
    routeCalculated: false,
    routeCalculating: false,
    // 规划后的有序景点
    plannedStops: [],
    // 地图显示用
    mapStops: [],
    // 地图高度
    mapHeight: 500,
    // 当前选中景点
    currentStopIndex: 0,
    // 路线统计
    totalDistance: 0,
    estimatedTime: 0,
    // 路线名称
    routeName: '',
    // 系统信息
    systemInfo: {}
  },

  onLoad: function (options) {
    // 获取系统信息用于计算地图高度
    const sysInfo = wx.getSystemInfoSync();
    this.setData({
      systemInfo: sysInfo,
      mapHeight: Math.floor(sysInfo.windowHeight * 0.45)
    });

    // 加载已选景点（从缓存或跳转参数）
    this.loadSelectedAttractions();
  },

  onShow: function () {
    // 每次显示时重新加载（可能从景点选择页返回）
    this.loadSelectedAttractions();
  },

  // 加载已选景点
  loadSelectedAttractions: function () {
    const selectedIds = wx.getStorageSync('selectedAttractionIds') || [];

    if (selectedIds.length === 0) {
      this.setData({ selectedAttractions: [] });
      return;
    }

    // 从云函数获取景点详情
    wx.showLoading({ title: '加载中...' });

    wx.cloud.callFunction({
      name: 'getAttractions',
      data: {
        action: 'byIds',
        ids: selectedIds
      }
    }).then(res => {
      wx.hideLoading();
      if (res.result && res.result.list) {
        this.setData({
          selectedAttractions: res.result.list
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('加载景点失败:', err);
    });
  },

  // 添加景点（跳转到景点列表选择）
  onAddAttraction: function () {
    // 将当前已选ID传入景点列表页
    const currentIds = this.data.selectedAttractions.map(a => a._id);
    wx.setStorageSync('selectedAttractionIds', currentIds);
    wx.navigateTo({
      url: '/pages/attractions/list/list?mode=select'
    });
  },

  // 移除景点
  onRemoveAttraction: function (e) {
    const index = e.currentTarget.dataset.index;
    const selectedAttractions = [...this.data.selectedAttractions];
    selectedAttractions.splice(index, 1);

    this.setData({ selectedAttractions });

    // 更新缓存
    const ids = selectedAttractions.map(a => a._id);
    wx.setStorageSync('selectedAttractionIds', ids);

    // 如果已规划路线，也移除对应景点
    if (this.data.routeCalculated) {
      const plannedStops = this.data.plannedStops.filter(
        stop => stop.id !== this.data.selectedAttractions[index]?._id
      );
      this.setData({
        plannedStops,
        mapStops: plannedStops.map((s, i) => ({ ...s, order: i }))
      });
    }
  },

  // 智能路线规划（核心算法）
  onPlanRoute: async function () {
    if (this.data.selectedAttractions.length < 2) {
      wx.showToast({ title: '至少选择2个景点', icon: 'none' });
      return;
    }

    this.setData({ routeCalculating: true });

    try {
      // 获取用户当前位置
      let currentLocation = null;
      try {
        const locRes = await wx.getLocation({ type: 'gcj02' });
        currentLocation = {
          latitude: locRes.latitude,
          longitude: locRes.longitude
        };
      } catch (e) {
        // 用户拒绝位置授权也继续规划
        console.log('未获取到位置');
      }

      // 调用云函数计算最优路线
      const res = await wx.cloud.callFunction({
        name: 'planRoute',
        data: {
          attractionIds: this.data.selectedAttractions.map(a => a._id),
          startLocation: currentLocation
        }
      });

      this.setData({ routeCalculating: false });

      if (res.result && res.result.plannedStops) {
        const plannedStops = res.result.plannedStops;
        const totalDistance = res.result.totalDistance || 0;
        const estimatedTime = res.result.estimatedTime || 0;

        // 构建地图数据
        const mapStops = plannedStops.map((stop, index) => ({
          id: stop.attractionId || stop.id,
          name: stop.name,
          latitude: stop.location.latitude,
          longitude: stop.location.longitude,
          distance: stop.distanceFromPrev,
          icon: stop.icon || ''
        }));

        this.setData({
          routeCalculated: true,
          plannedStops,
          mapStops,
          totalDistance: totalDistance.toFixed(1),
          estimatedTime: estimatedTime.toFixed(1),
          currentStopIndex: 0,
          routeName: ''
        });

        // 通知地图组件更新
        const mapRoute = this.selectComponent('#planMapRoute');
        if (mapRoute) {
          setTimeout(() => {
            mapRoute.updateRoute(mapStops);
          }, 300);
        }

        wx.showToast({ title: '路线规划完成', icon: 'success' });
      }
    } catch (err) {
      console.error('路线规划失败:', err);
      this.setData({ routeCalculating: false });
      wx.showToast({ title: '规划失败，请重试', icon: 'none' });
    }
  },

  // 景点切换
  onStopChange: function (e) {
    this.setData({ currentStopIndex: e.detail.index });
  },

  // 点击已规划景点
  onPlannedStopTap: function (e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ currentStopIndex: index });

    const mapRoute = this.selectComponent('#planMapRoute');
    if (mapRoute) {
      mapRoute.focusOnStop(index);
    }
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

  // 路线名称输入
  onRouteNameInput: function (e) {
    this.setData({ routeName: e.detail.value });
  },

  // 保存路线
  onSaveRoute: async function () {
    if (!app.checkLogin()) return;

    const routeName = this.data.routeName.trim();
    if (!routeName) {
      wx.showToast({ title: '请输入路线名称', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'saveRoute',
        data: {
          name: routeName,
          description: `${routeName} - ${this.data.plannedStops.length}个景点`,
          attractions: this.data.plannedStops.map((stop, index) => ({
            attractionId: stop.attractionId || stop.id,
            order: index,
            name: stop.name,
            location: stop.location
          })),
          totalDistance: parseFloat(this.data.totalDistance),
          estimatedTime: parseFloat(this.data.estimatedTime),
          tags: []
        }
      });

      wx.hideLoading();

      if (res.result && res.result.success) {
        wx.showToast({ title: '路线保存成功', icon: 'success' });

        // 清除缓存
        wx.removeStorageSync('selectedAttractionIds');

        // 跳转到路线详情
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/routes/detail/detail?id=${res.result.routeId}`
          });
        }, 1500);
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
