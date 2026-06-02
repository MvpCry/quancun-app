// pages/routes/detail/detail.js - 路线详情页（云优先 + 本地回退）

Page({
  data: {
    routeId: '',
    route: { attractions: [] },
    mapStops: [],
    currentStopIndex: 0,
    isFavorited: false,
    loading: true
  },

  onLoad: function (options) {
    if (!options.id) {
      wx.showToast({ title: '缺少路线ID', icon: 'none' });
      return;
    }
    this.setData({ routeId: options.id });
    this.loadRoute(options.id);
  },

  // ========== 主加载：云优先 ==========
  loadRoute: async function (id) {
    var that = this;

    that.setData({ loading: true });

    // 1. 尝试云函数获取详情
    if (wx.cloud) {
      try {
        var res = await wx.cloud.callFunction({
          name: 'getRoutes',
          data: { action: 'detail', id: id }
        });

        if (res.result && res.result.route) {
          that.renderRoute(res.result.route);
          return;
        }
      } catch (err) {
        console.error('云函数获取路线详情失败:', err);
      }
    }

    // 2. 尝试从全局缓存查找
    var app = getApp();
    var cached = app.globalData.cachedRoutes;
    if (cached) {
      for (var i = 0; i < cached.length; i++) {
        if (cached[i]._id === id) {
          that.renderRoute(cached[i]);
          return;
        }
      }
    }

    // 3. 回退本地数据
    var defaultData = require('../../../data/defaultData.js');
    var list = defaultData.defaultRoutes;
    for (var j = 0; j < list.length; j++) {
      if (list[j]._id === id) {
        that.renderRoute(list[j]);
        return;
      }
    }

    // 4. 未找到
    that.setData({ loading: false });
    wx.showToast({ title: '路线不存在', icon: 'none' });
  },

  // 渲染路线数据
  renderRoute: function (route) {
    // 构建地图数据
    var mapStops = (route.attractions || []).map(function (stop, index) {
      return {
        id: stop.attractionId,
        name: stop.name,
        latitude: stop.location ? stop.location.latitude : 30.5,
        longitude: stop.location ? stop.location.longitude : 114.3,
        distance: stop.distanceFromPrev
      };
    });

    this.setData({
      route: route,
      mapStops: mapStops,
      attractionCount: route.attractions ? route.attractions.length : 0,
      isFavorited: route.isFavorited || false,
      loading: false
    });

    wx.setNavigationBarTitle({ title: route.name || '路线详情' });
  },

  // ========== 交互事件 ==========

  onStopChange: function (e) {
    this.setData({ currentStopIndex: e.detail.index });
  },

  onStopRowTap: function (e) {
    var index = e.currentTarget.dataset.index;
    this.setData({ currentStopIndex: index });

    var mapRoute = this.selectComponent('#detailMapRoute');
    if (mapRoute) mapRoute.focusOnStop(index);

    var stop = this.data.route.attractions[index];
    if (stop && stop.attractionId) {
      wx.navigateTo({ url: '/pages/attractions/detail/detail?id=' + stop.attractionId });
    }
  },

  // 收藏/取消收藏
  onToggleFavorite: function () {
    var app = getApp();
    if (!app.checkLogin()) return;

    var that = this;
    var isFav = !that.data.isFavorited;

    if (!wx.cloud) {
      // 无云函数时本地切换
      that.setData({ isFavorited: isFav });
      wx.showToast({ title: isFav ? '已收藏' : '已取消收藏', icon: 'success' });
      return;
    }

    wx.cloud.callFunction({
      name: 'toggleFavorite',
      data: {
        type: 'route',
        targetId: that.data.routeId,
        isFavorited: isFav
      },
      success: function () {
        that.setData({ isFavorited: isFav });
        wx.showToast({ title: isFav ? '已收藏' : '已取消收藏', icon: 'success' });
      },
      fail: function () {
        wx.showToast({ title: '操作失败，请重试', icon: 'none' });
      }
    });
  },

  onShareTap: function () {
    // 触发分享
  },

  onNavigateAll: function () {
    var stops = this.data.route.attractions;
    if (!stops || stops.length === 0) {
      wx.showToast({ title: '暂无景点信息', icon: 'none' });
      return;
    }
    var names = stops.map(function (s, i) { return (i + 1) + '. ' + s.name; });
    var that = this;
    wx.showActionSheet({
      itemList: names,
      success: function (res) {
        var stop = stops[res.tapIndex];
        if (stop.location && stop.location.latitude) {
          wx.openLocation({
            latitude: stop.location.latitude,
            longitude: stop.location.longitude,
            name: stop.name,
            scale: 16
          });
        }
      }
    });
  },

  onShareAppMessage: function () {
    return {
      title: '去俺村 - ' + this.data.route.name,
      path: '/pages/routes/detail/detail?id=' + this.data.routeId
    };
  }
});
