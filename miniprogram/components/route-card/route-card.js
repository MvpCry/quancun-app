// components/route-card/route-card.js
Component({
  properties: {
    route: {
      type: Object,
      value: {},
      observer: function (newVal) {
        if (newVal && newVal.attractions) {
          var that = this;
          var len = newVal.attractions.length;
          var stops = newVal.attractions.map(function (stop, i) {
            var isEnd = i === len - 1;
            return {
              attractionId: stop.attractionId,
              order: stop.order,
              name: stop.name,
              displayName: stop.name + (isEnd ? '（终点）' : '（第' + (i + 1) + '站）'),
              location: stop.location,
              shortLocation: that.extractShortLocation(stop.address || ''),
              address: stop.address || ''
            };
          });
          this.setData({
            attractionCount: stops.length,
            formattedStops: stops
          });
        }
      }
    }
  },

  data: {
    attractionCount: 0,
    formattedStops: []
  },

  methods: {
    // 从完整地址中提取省市区的缩写
    extractShortLocation: function (address) {
      if (!address) return '';
      var parts = [];
      var prov = address.match(/([一-龥]+省)/);
      var city = address.match(/([一-龥]+市)/g);
      var district = address.match(/([一-龥]+区)/);
      var county = address.match(/([一-龥]+县)/);

      if (prov) parts.push(prov[1]);
      if (city && city.length >= 1) {
        // 取第一个"市"（通常是地级市），跳过"县级市"的情况
        parts.push(city[0]);
      }
      if (district) parts.push(district[1]);
      else if (county) parts.push(county[1]);

      return parts.join(' ');
    },

    onCoverError: function () {
      // WebP 解码失败兜底
    },

    onTap: function () {
      this.triggerEvent('tap', { id: this.data.route._id });
    },

    // 点击导航按钮 → 打开腾讯地图（使用路线第一个有坐标的景点）
    onNavigate: function () {
      var route = this.data.route;
      if (!route || !route.attractions || route.attractions.length === 0) {
        wx.showToast({ title: '暂无景点坐标', icon: 'none' });
        return;
      }

      // 取第一个有有效坐标的景点作为导航终点
      var dest = null;
      var stops = route.attractions;
      for (var i = 0; i < stops.length; i++) {
        var s = stops[i];
        if (s.location && s.location.latitude) {
          dest = s;
          break;
        }
      }

      if (!dest) {
        wx.showToast({ title: '暂无景点坐标', icon: 'none' });
        return;
      }

      wx.openLocation({
        latitude: dest.location.latitude,
        longitude: dest.location.longitude,
        name: dest.name,
        address: dest.address || '',
        scale: 14
      });
    }
  }
});
