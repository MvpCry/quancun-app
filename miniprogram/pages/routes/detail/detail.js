// pages/routes/detail/detail.js - 路线详情页（云优先 + 本地回退）
// v1.2: 接入腾讯地图真实驾车路线展示

var mapService = require('../../../utils/map-service.js');

Page({
  data: {
    isAndroid: false,
    backIcon: '<',
    routeId: '',
    route: { attractions: [] },
    mapStops: [],
    routePolylines: [],
    currentStopIndex: 0,
    isFavorited: false,
    loading: true,
    loadError: ''            // 加载错误信息（空=无错误）
  },

  onLoad: function (options) {
    var sysInfo = wx.getSystemInfoSync();
    this.setData({ isAndroid: sysInfo.platform === 'android' });

    if (!options || !options.id) {
      this.setData({ loading: false, loadError: '缺少路线ID参数' });
      return;
    }
    this.setData({ routeId: options.id, loading: true, loadError: '' });
    this.loadRoute(options.id);
  },

  onShow: function () {
    // 保持简洁：不做复杂重载逻辑（参考景点详情页的 onShow 模式）
  },

  onNavBack: function () {
    wx.navigateBack({ delta: 1 });
  },

  onRetry: function () {
    this.loadRoute(this.data.routeId);
  },

  // ========== 主加载：云优先 → 缓存回退 → 本地兜底 ==========
  loadRoute: async function (id) {
    var that = this;
    that.setData({ loading: true, loadError: '' });

    // 1. 尝试云函数获取详情
    if (wx.cloud) {
      try {
        var res = await wx.cloud.callFunction({
          name: 'getRoutes',
          data: { action: 'detail', id: id }
        });

        if (res.result && res.result.route) {
          await that.renderRoute(res.result.route);
          return;
        }
        console.warn('云函数未返回路线数据:', res.result);
      } catch (err) {
        console.error('云函数调用失败:', err);
      }
    }

    // 2. 尝试从全局缓存查找
    var app = getApp();
    var cached = app.globalData.cachedRoutes;
    if (cached) {
      for (var i = 0; i < cached.length; i++) {
        if (cached[i]._id === id) {
          await that.renderRoute(cached[i]);
          return;
        }
      }
    }

    // 3. 回退本地数据
    var defaultData = require('../../../data/defaultData.js');
    var list = defaultData.defaultRoutes;
    for (var j = 0; j < list.length; j++) {
      if (list[j]._id === id) {
        await that.renderRoute(list[j]);
        return;
      }
    }

    // 4. 所有来源都未找到
    that.setData({
      loading: false,
      loadError: '路线不存在或已被删除'
    });
  },

  // 渲染路线数据
  renderRoute: async function (route) {
    // 对缺失坐标的站点，用地址实时解析
    if (route.attractions && route.attractions.length > 0) {
      var app = getApp();
      var resolveTasks = [];
      for (var s = 0; s < route.attractions.length; s++) {
        var stop = route.attractions[s];
        if (!stop.location || !stop.location.latitude) {
          // 构造地址：优先 stop 自带 address，无则拼 "村名，山东省泰安市"
          if (!stop.address) stop.address = stop.name + '，山东省泰安市';
          resolveTasks.push(
            app.resolveAttractionLocation(stop).catch(function () {})
          );
        }
      }
      if (resolveTasks.length > 0) {
        await Promise.all(resolveTasks);
      }
    }

    // 统计有效坐标的站点数
    var validStops = 0;
    var mapStops = (route.attractions || []).map(function (stop, index) {
      var hasLoc = !!(stop.location && stop.location.latitude);
      if (hasLoc) validStops++;
      return {
        id: stop.attractionId,
        name: stop.name,
        latitude: hasLoc ? stop.location.latitude : 0,
        longitude: hasLoc ? stop.location.longitude : 0,
        distance: stop.distanceFromPrev,
        hasLocation: hasLoc
      };
    });

    this.setData({
      route: route,
      mapStops: mapStops,
      hasMapData: validStops >= 2,
      attractionCount: route.attractions ? route.attractions.length : 0,
      isFavorited: route.isFavorited || false,
      loading: false
    });

    wx.setNavigationBarTitle({ title: route.name || '路线详情' });

    // 只有至少2个有效坐标时才获取驾车路线
    if (validStops >= 2) {
      this.fetchRoutePolylines(mapStops.filter(function (s) { return s.hasLocation; }));
    }
  },

  // 获取驾车路线 polyline 展示真实路线
  fetchRoutePolylines: async function (mapStops) {
    if (mapStops.length < 2) return;

    try {
      var segments = [];
      for (var i = 0; i < mapStops.length - 1; i++) {
        var route = await mapService.drivingRoute(
          { latitude: mapStops[i].latitude, longitude: mapStops[i].longitude },
          { latitude: mapStops[i + 1].latitude, longitude: mapStops[i + 1].longitude }
        );
        segments.push(route ? route.polyline : []);
      }

      this.setData({ routePolylines: segments });

      // 通知地图组件更新
      var mapRoute = this.selectComponent('#detailMapRoute');
      if (mapRoute) {
        mapRoute.updateRoute(this.data.mapStops, segments);
      }
    } catch (err) {
      console.error('获取驾车路线失败:', err);
    }
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

  // 开始导航 → 起点→途经点→终点 串联整条路线
  onNavigateAll: function () {
    var stops = this.data.route.attractions;
    if (!stops || stops.length === 0) {
      wx.showToast({ title: '暂无景点信息', icon: 'none' });
      return;
    }

    // 筛出有坐标的站点（保持路线原始顺序）
    var valid = stops.filter(function (s) {
      return s.location && s.location.latitude;
    });

    if (valid.length === 0) {
      wx.showToast({ title: '暂无可用坐标，无法导航', icon: 'none' });
      return;
    }

    // 单景点：直接 openLocation
    if (valid.length === 1) {
      wx.openLocation({
        latitude: valid[0].location.latitude,
        longitude: valid[0].location.longitude,
        name: valid[0].name,
        address: this.data.route.name,
        scale: 16
      });
      return;
    }

    // 多景点串联：起点=第一个景点，终点=最后一个景点，途经点=中间所有景点
    var start = valid[0];
    var end = valid[valid.length - 1];
    var waypoints = valid.slice(1, -1);

    // 途经点格式：lat,lng;lat,lng;...
    var passesStr = waypoints.map(function (s) {
      return s.location.latitude + ',' + s.location.longitude;
    }).join(';');

    // 路线描述（显示完整游览顺序）
    var routeDesc = valid.map(function (s, i) {
      return (i + 1) + '.' + s.name;
    }).join(' → ');

    var that = this;
    // 尝试跳转腾讯地图小程序进行多点路线规划
    wx.navigateToMiniProgram({
      appId: 'wx7643d5f831302ab0',
      path: 'modules/route/pages/index/index' +
        '?type=drive' +
        '&from=' + encodeURIComponent(start.name) +
        '&fromcoord=' + start.location.latitude + ',' + start.location.longitude +
        '&to=' + encodeURIComponent(end.name) +
        '&tocoord=' + end.location.latitude + ',' + end.location.longitude +
        (passesStr ? '&passes=' + encodeURIComponent(passesStr) : ''),
      success: function () {
        console.log('已打开腾讯地图：' + routeDesc);
      },
      fail: function () {
        // 腾讯地图不可用 → 打开微信内置地图导航到起点，并在 address 显示完整路线
        wx.openLocation({
          latitude: start.location.latitude,
          longitude: start.location.longitude,
          name: start.name + '（第1站/' + valid.length + '站）',
          address: that.data.route.name + '\n游览顺序：' + routeDesc,
          scale: 16
        });
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
