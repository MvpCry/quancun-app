// components/map-route/map-route.js
// v1.2: 支持腾讯地图真实驾车路线 polyline
Component({
  properties: {
    // 景点列表 [{id, name, latitude, longitude, icon}]
    stops: {
      type: Array,
      value: [],
      observer: function (newVal) {
        if (newVal && newVal.length > 0) {
          this.buildMapData(newVal, this.data.routePolylines);
        }
      }
    },
    // 驾车路线 polyline 数据 [[{latitude, longitude}, ...], ...]
    // 每个元素是一段路线的点数组，与 stops 顺序对应
    routePolylines: {
      type: Array,
      value: [],
      observer: function (newVal) {
        if (this.data.stops.length > 0) {
          this.buildMapData(this.data.stops, newVal || []);
        }
      }
    },
    // 地图高度
    height: {
      type: Number,
      value: 500
    },
    // 是否显示当前位置
    showLocation: {
      type: Boolean,
      value: true
    },
    // 是否显示底部景点选择器
    showStops: {
      type: Boolean,
      value: true
    },
    // 当前选中的景点索引
    currentIndex: {
      type: Number,
      value: 0
    }
  },

  data: {
    centerLat: 30.5,
    centerLng: 114.3,
    scale: 13,
    markers: [],
    polylines: [],
    currentStopIndex: 0,
    // 地图上下文
    mapCtx: null
  },

  lifetimes: {
    attached: function () {
      if (this.data.stops.length > 0) {
        this.buildMapData(this.data.stops, this.data.routePolylines);
      }
    },

    ready: function () {
      // 获取地图上下文
      this.data.mapCtx = wx.createMapContext('routeMap', this);
    }
  },

  methods: {
    // 构建地图数据
    buildMapData: function (stops, routePolylines) {
      if (!stops || stops.length === 0) return;
      routePolylines = routePolylines || [];

      // 构建 markers
      const markers = stops.map((stop, index) => ({
        id: index,
        latitude: stop.latitude,
        longitude: stop.longitude,
        title: stop.name,
        iconPath: stop.icon || '/images/marker-village.png',
        width: 48,
        height: 42,
        callout: {
          content: stop.displayName || stop.name,
          color: '#333333',
          fontSize: 13,
          borderRadius: 8,
          padding: 8,
          display: 'ALWAYS',
          textAlign: 'center'
        },
        label: {
          content: `${index + 1}`,
          color: '#FFFFFF',
          fontSize: 12,
          x: 16,
          y: -8,
          borderRadius: 12,
          bgColor: index === 0 ? '#FF9800' : '#2E7D32',
          borderWidth: 1,
          borderColor: '#FFFFFF',
          padding: 4
        }
      }));

      // 构建 polylines
      var polylines = [];

      // 如果有真实驾车路线数据，使用驾车路线
      if (routePolylines.length > 0) {
        for (var r = 0; r < routePolylines.length; r++) {
          if (routePolylines[r] && routePolylines[r].length > 0) {
            polylines.push({
              points: routePolylines[r],
              color: '#2E7D32',
              width: 8,
              borderColor: '#1B5E20',
              borderWidth: 2,
              arrowLine: true,
              dottedLine: false
            });
          }
        }
      } else {
        // 回退：直线连线
        var linePoints = stops.map(function (s) {
          return { latitude: s.latitude, longitude: s.longitude };
        });

        polylines = [{
          points: linePoints,
          color: '#2E7D32CC',
          width: 4,
          borderColor: '#FFFFFF',
          borderWidth: 2,
          arrowLine: true,
          dottedLine: true
        }];
      }

      // 计算中心点
      const centerLat = stops.reduce((sum, s) => sum + s.latitude, 0) / stops.length;
      const centerLng = stops.reduce((sum, s) => sum + s.longitude, 0) / stops.length;

      // 计算合适的缩放级别（根据点位范围）
      const lats = stops.map(s => s.latitude);
      const lngs = stops.map(s => s.longitude);
      const latRange = Math.max(...lats) - Math.min(...lats);
      const lngRange = Math.max(...lngs) - Math.min(...lngs);
      const maxRange = Math.max(latRange, lngRange);

      let scale = 13;
      if (maxRange < 0.01) scale = 16;
      else if (maxRange < 0.05) scale = 14;
      else if (maxRange < 0.1) scale = 13;
      else if (maxRange < 0.3) scale = 11;
      else scale = 9;

      this.setData({
        markers,
        polylines,
        centerLat,
        centerLng,
        scale,
        currentStopIndex: this.data.currentIndex
      });

      // 延迟执行 includePoints 让所有点都在视野内
      var includePts = stops.map(function (s) {
        return { latitude: s.latitude, longitude: s.longitude };
      });
      setTimeout(() => {
        if (this.data.mapCtx) {
          this.data.mapCtx.includePoints({
            points: includePts,
            padding: [60, 40, 60, 40]
          });
        }
      }, 300);
    },

    // 聚焦到某个景点
    focusOnStop: function (index) {
      if (index >= 0 && index < this.data.stops.length) {
        this.setData({ currentStopIndex: index });

        const stop = this.data.stops[index];
        if (this.data.mapCtx && stop) {
          this.data.mapCtx.moveToLocation({
            latitude: stop.latitude,
            longitude: stop.longitude
          });
        }
      }
    },

    // Marker点击
    onMarkerTap: function (e) {
      const markerId = e.detail.markerId;
      this.setData({ currentStopIndex: markerId });
      this.triggerEvent('stopchange', { index: markerId });
    },

    // 底部景点chip点击
    onStopChipTap: function (e) {
      const index = e.currentTarget.dataset.index;
      this.focusOnStop(index);
      this.triggerEvent('stopchange', { index });
    },

    // 地图区域变化
    onRegionChange: function (e) {
      if (e.type === 'end') {
        // 可记录当前视野
      }
    },

    // 缩放控制
    onZoomIn: function () {
      const newScale = Math.min(this.data.scale + 2, 18);
      this.setData({ scale: newScale });
    },

    onZoomOut: function () {
      const newScale = Math.max(this.data.scale - 2, 3);
      this.setData({ scale: newScale });
    },

    onRecenter: function () {
      this.buildMapData(this.data.stops);
    },

    // 外部调用：更新路线（支持 polyline）
    updateRoute: function (stops, routePolylines) {
      this.buildMapData(stops, routePolylines || []);
    }
  }
});
