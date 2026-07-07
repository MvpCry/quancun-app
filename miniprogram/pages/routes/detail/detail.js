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
    loadError: '',

    // 导航
    showNavResult: false,
    isPlanning: false,
    navMode: 'driving',
    navInfo: { distance: '', duration: '' },
    startLocation: null
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
    var attractionCount = route.attractions ? route.attractions.length : 0;
    var mapStops = (route.attractions || []).map(function (stop, index) {
      var hasLoc = !!(stop.location && stop.location.latitude);
      if (hasLoc) validStops++;
      var isEnd = index === attractionCount - 1;
      stop.displayName = stop.name + (isEnd ? '（终点）' : '（第' + (index + 1) + '站）');
      return {
        id: stop.attractionId,
        name: stop.name,
        displayName: stop.displayName,
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
      attractionCount: attractionCount,
      isFavorited: route.isFavorited || false,
      loading: false
    });

    // 保存原始数据用于退出导航时恢复
    this._origStops = mapStops.slice();
    this._origPolylines = [];

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
      this._origPolylines = segments.slice();

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

  // ===== 开始导航：多点路线规划 =====
  onNavigateAll: async function () {
    var that = this;
    var stops = this.data.route.attractions;
    if (!stops || stops.length === 0) {
      wx.showToast({ title: '暂无景点信息', icon: 'none' });
      return;
    }

    var valid = stops.filter(function (s) {
      return s.location && s.location.latitude;
    });

    if (valid.length < 2) {
      wx.showToast({ title: '至少需要2个有坐标的景点', icon: 'none' });
      return;
    }

    that.setData({ isPlanning: true, showNavResult: false });

    // 起点 = 第一个景点
    var start = { latitude: Number(valid[0].location.latitude), longitude: Number(valid[0].location.longitude) };
    that.setData({ startLocation: start });

    // 途经点 = 第二个景点起（第一个作为起点传给 from 参数）
    var waypoints = valid.slice(1).map(function (s) {
      return { latitude: Number(s.location.latitude), longitude: Number(s.location.longitude) };
    });

    try {
      var route = await mapService.drivingRouteWithWaypoints(start, waypoints, that.data.navMode);

      // 构建 markers：起点(绿) + 途经点(橙) + 终点(红)
      var markers = [];

      valid.forEach(function (s, idx) {
        var isStart = idx === 0;
        var isEnd = idx === valid.length - 1;
        markers.push({
          id: idx,
          latitude: Number(s.location.latitude),
          longitude: Number(s.location.longitude),
          title: s.displayName || s.name,
          color: isStart ? '#00C853' : (isEnd ? '#F44336' : '#FF9800'),
          width: (isStart || isEnd) ? 32 : 28,
          height: (isStart || isEnd) ? 32 : 28,
          callout: { content: s.displayName || s.name, color: '#333', fontSize: 12, borderRadius: 6, padding: 6, display: 'BYCLICK' },
          label: isStart ? { content: '起', color: '#fff', fontSize: 12, borderRadius: 10, bgColor: '#00C853', padding: 4 }
               : isEnd ? { content: '终', color: '#fff', fontSize: 12, borderRadius: 10, bgColor: '#F44336', padding: 4 }
               : { content: String(idx + 1), color: '#fff', fontSize: 12, borderRadius: 10, bgColor: '#FF9800', padding: 4 }
        });
      });

      var polyline = [{
        points: route.polyline,
        color: '#2979FF',
        width: 6,
        arrowLine: true,
        borderColor: '#1A5FCC',
        borderWidth: 2
      }];

      // 格式化时间距离
      var distKm = (route.distance / 1000).toFixed(1);
      var durMin = Math.round(route.duration / 60);
      var durText = durMin >= 60
        ? Math.floor(durMin / 60) + '小时' + (durMin % 60) + '分'
        : durMin + '分钟';

      that.setData({
        polyline: polyline,
        markers: markers,
        showNavResult: true,
        isPlanning: false,
        navInfo: { distance: distKm + '公里', duration: durText }
      });

      // 地图自适应
      var mapCtx = wx.createMapContext('routeMap');
      setTimeout(function () {
        mapCtx.includePoints({
          points: markers.map(function (m) { return { latitude: m.latitude, longitude: m.longitude }; }),
          padding: [80, 60, 80, 60]
        });
      }, 400);

    } catch (e) {
      that.setData({ isPlanning: false });
      console.error('路线规划失败:', e);
      wx.showToast({ title: '路线规划失败，请重试', icon: 'none' });
    }
  },

  // 切换导航模式
  switchNavMode: function (e) {
    var mode = e.currentTarget.dataset.mode;
    if (mode === this.data.navMode) return;
    this.setData({ navMode: mode, showNavResult: false }, function () {
      this.onNavigateAll();
    });
  },

  // 关闭导航结果
  closeNavResult: function () {
    this.setData({ showNavResult: false, polyline: [], markers: [], startLocation: null });
    if (this._origStops && this._origPolylines) {
      this.setData({ mapStops: this._origStops, routePolylines: this._origPolylines });
      var mapRoute = this.selectComponent('#detailMapRoute');
      if (mapRoute) mapRoute.updateRoute(this._origStops, this._origPolylines);
    }
  },

  // 分段导航：我的位置 → 每个景点
  goToTencentMap: function () {
    var stops = this.data.route.attractions;
    if (!stops || stops.length === 0) return;

    var valid = stops.filter(function (s) {
      return s.location && s.location.latitude;
    });
    if (valid.length === 0) return;

    var itemList = valid.map(function (s, i) {
      var isEnd = i === valid.length - 1;
      return s.name + (isEnd ? '（终点）' : '（第' + (i + 1) + '站）');
    });

    var that = this;
    wx.showActionSheet({
      itemList: itemList,
      success: function (res) {
        that._openTencentMap(valid[res.tapIndex]);
      }
    });
  },

  // 跳腾讯地图单段导航
  _openTencentMap: function (endPoint) {
    var TENCENT_MAP_APPID = 'wx7643d5f831302ab0';

    var end = JSON.stringify({
      name: endPoint.name,
      location: { lat: Number(endPoint.location.latitude), lng: Number(endPoint.location.longitude) }
    });

    wx.navigateToMiniProgram({
      appId: TENCENT_MAP_APPID,
      path: 'pages/multiScheme/multiScheme?endLoc=' + encodeURIComponent(end) + '&qbMode=0',
      fail: function () {
        wx.openLocation({
          latitude: Number(endPoint.location.latitude),
          longitude: Number(endPoint.location.longitude),
          name: endPoint.name
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
