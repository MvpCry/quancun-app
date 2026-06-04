// pages/routes/plan/plan.js - 路线规划页（核心）
// Bug修复：移除景点使用 stable index + filter；增加本地数据回退
// v1.2: 接入腾讯地图真实驾车距离

var mapService = require('../../../utils/map-service.js');

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
    missingCoordNames: [],
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
      that.setData({ selectedAttractions: [], missingCoordNames: [] });
      return;
    }

    var foundList = null;

    // 1. 尝试云函数获取景点详情
    if (!foundList && wx.cloud) {
      try {
        var res = await wx.cloud.callFunction({
          name: 'getAttractions',
          data: { action: 'byIds', ids: selectedIds }
        });

        if (res.result && res.result.list) {
          foundList = res.result.list;
        }
      } catch (err) {
        console.error('加载景点失败:', err);
      }
    }

    // 2. 从全局缓存查找
    if (!foundList) {
      var app = getApp();
      var cached = app.globalData.cachedAttractions;
      if (cached) {
        foundList = selectedIds.map(function (id) {
          for (var i = 0; i < cached.length; i++) {
            if (cached[i]._id === id) return cached[i];
          }
          return null;
        }).filter(Boolean);
      }
    }

    // 3. 回退本地数据
    if (!foundList || foundList.length === 0) {
      var defaultData = require('../../../data/defaultData.js');
      foundList = selectedIds.map(function (id) {
        for (var j = 0; j < defaultData.defaultAttractions.length; j++) {
          if (defaultData.defaultAttractions[j]._id === id) return defaultData.defaultAttractions[j];
        }
        return null;
      }).filter(Boolean);
    }

    // 对缺失坐标的景点调用腾讯地图 geocoder 实时解析
    if (foundList && foundList.length > 0) {
      var app = getApp();
      var resolvePromises = [];
      for (var k = 0; k < foundList.length; k++) {
        var a = foundList[k];
        if (a.address && (!a.location || !a.location.latitude)) {
          resolvePromises.push(
            app.resolveAttractionLocation(a).catch(function () {})
          );
        }
      }
      if (resolvePromises.length > 0) {
        await Promise.all(resolvePromises);
      }
    }

    that.setData({ selectedAttractions: foundList || [] });
    that.checkMissingCoords(foundList || []);
  },

  // 检查缺失坐标的景点
  checkMissingCoords: function (attractions) {
    var missing = [];
    for (var i = 0; i < attractions.length; i++) {
      var a = attractions[i];
      if (!a.location || !a.location.latitude) {
        missing.push(a.name);
      }
    }
    this.setData({ missingCoordNames: missing });
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
            latitude: (s.location && s.location.latitude) || 0,
            longitude: (s.location && s.location.longitude) || 0,
            distance: s.distanceFromPrev
          };
        })
      });
    }
  },

  // ========== 智能路线规划 (v1.2：云→腾讯地图→本地) ==========
  onPlanRoute: async function () {
    var that = this;

    if (that.data.selectedAttractions.length < 2) {
      wx.showToast({ title: '至少选择2个景点', icon: 'none' });
      return;
    }

    // 检查有坐标的景点数量
    var withCoords = that.data.selectedAttractions.filter(function (a) {
      return a.location && a.location.latitude;
    });
    if (withCoords.length < 2) {
      wx.showModal({
        title: '无法规划路线',
        content: '已选景点中至少有' + (2 - withCoords.length) + '个尚未录入坐标，路线规划需要至少2个有效坐标。\n\n请通过后台管理页面设置景点坐标。',
        showCancel: false
      });
      return;
    }

    that.setData({ routeCalculating: true });

    // 整个规划流程硬性12秒超时保护
    try {
      await that.withTimeout(that.doPlanRoute(), 12000);
    } catch (e) {
      console.error('规划超时或失败:', e.message || e);
    }

    // 如果规划没有结果，回退本地
    if (!that.data.routeCalculated) {
      that.setData({ routeCalculating: false });
      var stops = that.data.selectedAttractions.map(function (a, i) {
        return {
          id: a._id,
          name: a.name,
          location: a.location || { latitude: 0, longitude: 0 },
          distanceFromPrev: 0
        };
      });
      that.applyPlanResult(stops, 0, 0, []);
    }
  },

  // 实际规划逻辑（被 onPlanRoute 超时保护包裹）
  doPlanRoute: async function () {
    var that = this;
    var currentLocation = null;

    // 并行获取定位（3秒超时）
    try {
      var locRes = await that.withTimeout(wx.getLocation({ type: 'gcj02' }), 3000);
      currentLocation = { latitude: locRes.latitude, longitude: locRes.longitude };
    } catch (e) {
      // 无定位也继续
    }

    // 尝试腾讯地图距离矩阵 + 本地Haversine回退（不浪费时间去试云函数）
    var mapPlanResult = await that.planWithMapService(currentLocation);
    if (mapPlanResult) {
      that.setData({ routeCalculating: false });
      that.applyPlanResult(
        mapPlanResult.stops,
        mapPlanResult.totalDistance,
        mapPlanResult.totalDuration,
        mapPlanResult.routePolylines || []
      );
    }
  },

  // ========== 腾讯地图服务规划（真实驾车距离） ==========
  planWithMapService: async function (startLocation) {
    var that = this;
    var attractions = this.data.selectedAttractions;

    var points = attractions.map(function (a) {
      return {
        latitude: (a.location && a.location.latitude) || 0,
        longitude: (a.location && a.location.longitude) || 0
      };
    });

    // 构建完整坐标列表（起点 + 所有景点）
    var allPoints = [];
    if (startLocation) {
      allPoints.push(startLocation);
    }
    allPoints = allPoints.concat(points);

    var numPoints = allPoints.length;

    // 步骤1: 构建距离矩阵（优先用腾讯地图，失败用本地直线距离）
    var matrix;
    var useRealDist = false;
    try {
      matrix = await mapService.distanceMatrix(allPoints, allPoints, 'driving');
      useRealDist = true;
    } catch (e) {
      console.warn('距离矩阵API不可用，使用本地直线距离:', e.message || e.code);
      matrix = that.buildLocalMatrix(allPoints);
      useRealDist = false;
    }

    if (!matrix || matrix.length === 0) return null;

    // 步骤2: 最近邻贪心算法优化路线
    var visited = new Array(numPoints).fill(false);
    var order = [];
    var totalDistanceM = 0;
    var totalDurationS = 0;

    if (startLocation) {
      visited[0] = true;  // 起点标记已访问
    } else {
      visited[0] = true;
      order.push(0);
    }

    while (order.length < points.length) {
      var lastIdx;
      if (startLocation) {
        lastIdx = order.length > 0 ? order[order.length - 1] + 1 : 0;
      } else {
        lastIdx = order.length > 0 ? order[order.length - 1] : 0;
      }

      var nearestIdx = -1;
      var nearestDist = Infinity;
      var nearestDur = 0;

      for (var i = 0; i < numPoints; i++) {
        if (visited[i]) continue;
        if (startLocation && i === 0) continue;

        var el = matrix[lastIdx] && matrix[lastIdx].elements && matrix[lastIdx].elements[i];
        var d = el ? el.distance : Infinity;
        if (d < nearestDist) {
          nearestDist = d;
          nearestDur = el ? el.duration : 0;
          nearestIdx = i;
        }
      }

      if (nearestIdx >= 0) {
        visited[nearestIdx] = true;
        order.push(startLocation ? nearestIdx - 1 : nearestIdx);
        totalDistanceM += nearestDist;
        totalDurationS += nearestDur;
      } else {
        break;
      }
    }

    if (order.length < 2) return null;

    // 步骤3: 获取驾车路线 polyline（仅当API可用时，节省配额）
    var plannedPoints = order.map(function (idx) { return points[idx]; });
    var routePolylines = [];

    if (useRealDist) {
      try {
        var routeResults = await mapService.multiDrivingRoutes(plannedPoints);
        routePolylines = routeResults.map(function (r) {
          return r ? r.polyline : [];
        });
      } catch (e) {
        console.warn('获取驾车路线失败（将继续使用直线展示）:', e.message || e.code);
      }
    }

    // 构建 stops
    var stops = order.map(function (idx, i) {
      var a = attractions[idx];
      var prevDist = 0;
      if (i > 0) {
        var fromIdx = startLocation ? order[i - 1] + 1 : order[i - 1];
        var toIdx = startLocation ? idx + 1 : idx;
        if (matrix[fromIdx] && matrix[fromIdx].elements) {
          prevDist = matrix[fromIdx].elements[toIdx] ? matrix[fromIdx].elements[toIdx].distance : 0;
        }
      }

      return {
        id: a._id,
        name: a.name,
        location: a.location || { latitude: 0, longitude: 0 },
        distanceFromPrev: prevDist
      };
    });

    return {
      stops: stops,
      totalDistance: (totalDistanceM / 1000).toFixed(1),
      totalDuration: useRealDist ? (totalDurationS / 3600).toFixed(1) : '0.0',
      routePolylines: routePolylines
    };
  },

  // 本地距离矩阵（Haversine 公式，不需要 API Key）
  buildLocalMatrix: function (points) {
    var n = points.length;
    var rows = [];
    for (var i = 0; i < n; i++) {
      var elements = [];
      for (var j = 0; j < n; j++) {
        var d = this.haversineDistance(points[i], points[j]);
        elements.push({ distance: d, duration: 0 });
      }
      rows.push({ elements: elements });
    }
    return rows;
  },

  // Haversine 球面距离（米）
  haversineDistance: function (p1, p2) {
    var R = 6371000;
    var dLat = (p2.latitude - p1.latitude) * Math.PI / 180;
    var dLon = (p2.longitude - p1.longitude) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(p1.latitude * Math.PI / 180) * Math.cos(p2.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  },

  // 应用规划结果
  applyPlanResult: function (plannedStops, totalDistance, estimatedTime, routePolylines) {
    var that = this;
    routePolylines = routePolylines || [];

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
      routePolylines: routePolylines,
      totalDistance: totalDistance ? parseFloat(totalDistance).toFixed(1) : '0.0',
      estimatedTime: estimatedTime ? parseFloat(estimatedTime).toFixed(1) : '0.0',
      currentStopIndex: 0,
      routeName: ''
    });

    // 通知地图组件
    var mapRoute = that.selectComponent('#planMapRoute');
    if (mapRoute) {
      setTimeout(function () {
        mapRoute.updateRoute(mapStops, routePolylines);
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
  },

  // 工具：给 Promise 加超时保护，超时后自动 reject
  withTimeout: function (promise, ms) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        reject({ code: -1, message: '操作超时(' + ms + 'ms)', isTimeout: true });
      }, ms);

      promise.then(function (res) {
        clearTimeout(timer);
        resolve(res);
      }).catch(function (err) {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
});
