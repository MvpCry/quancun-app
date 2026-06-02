// pages/routes/detail/detail.js - 路线详情页（直接本地加载）
var defaultData = require('../../data/defaultData.js');

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
    this.showRoute(options.id);
  },

  // 直接从本地数据加载（不等待云函数）
  showRoute: function (id) {
    var list = defaultData.defaultRoutes;
    var found = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i]._id === id) {
        found = list[i];
        break;
      }
    }

    if (!found) {
      this.setData({ loading: false });
      wx.showToast({ title: '路线不存在', icon: 'none' });
      return;
    }

    // 构建地图数据
    var mapStops = (found.attractions || []).map(function (stop, index) {
      return {
        id: stop.attractionId,
        name: stop.name,
        latitude: stop.location ? stop.location.latitude : 30.5,
        longitude: stop.location ? stop.location.longitude : 114.3,
        distance: stop.distanceFromPrev
      };
    });

    this.setData({
      route: found,
      mapStops: mapStops,
      attractionCount: found.attractions ? found.attractions.length : 0,
      loading: false
    });

    wx.setNavigationBarTitle({ title: found.name || '路线详情' });

    // 后台尝试云函数更新
    this.tryCloudUpdate(id);
  },

  tryCloudUpdate: function (id) {
    if (typeof wx.cloud === 'undefined') return;
    var that = this;
    wx.cloud.callFunction({
      name: 'getRoutes',
      data: { action: 'detail', id: id },
      success: function (res) {
        if (res.result && res.result.route) {
          var route = res.result.route;
          var mapStops = (route.attractions || []).map(function (stop) {
            return {
              id: stop.attractionId,
              name: stop.name,
              latitude: stop.location ? stop.location.latitude : 30.5,
              longitude: stop.location ? stop.location.longitude : 114.3
            };
          });
          that.setData({
            route: route,
            mapStops: mapStops,
            attractionCount: route.attractions ? route.attractions.length : 0
          });
        }
      },
      fail: function () {}
    });
  },

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

  onToggleFavorite: function () {
    wx.showToast({ title: '请先配置云开发环境', icon: 'none' });
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
