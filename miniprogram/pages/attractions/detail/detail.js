// pages/attractions/detail/detail.js
// 数据优先从云数据库获取，回退到本地默认数据

Page({
  data: {
    attractionId: '',
    attraction: { images: [], location: {} },
    currentImageIndex: 0,
    markers: [],
    reviews: [],
    totalReviews: 0,
    loading: true
  },

  onLoad: function (options) {
    if (!options.id) {
      wx.showToast({ title: '缺少景点ID', icon: 'none' });
      return;
    }
    this.setData({ attractionId: options.id });
    this.loadAttraction(options.id);

    // 记录浏览历史
    this.recordHistory(options.id);
  },

  // ========== 主加载：云优先 ==========
  loadAttraction: async function (id) {
    var that = this;

    that.setData({ loading: true });

    // 1. 尝试云函数获取详情
    if (wx.cloud) {
      try {
        var res = await wx.cloud.callFunction({
          name: 'getAttractionDetail',
          data: { id: id }
        });

        if (res.result && res.result.attraction) {
          var attraction = res.result.attraction;
          // 确保兼容字段
          if (!attraction.introduction) {
            attraction.introduction = attraction.description || '';
          }

          that.renderAttraction(attraction, res.result.recentReviews || []);
          return;
        }
      } catch (err) {
        console.error('云函数获取景点详情失败:', err);
      }
    }

    // 2. 尝试从全局缓存查找
    var app = getApp();
    var cached = app.globalData.cachedAttractions;
    if (cached) {
      for (var i = 0; i < cached.length; i++) {
        if (cached[i]._id === id) {
          var found = cached[i];
          if (!found.introduction) found.introduction = found.description || '';
          that.renderAttraction(found, []);
          return;
        }
      }
    }

    // 3. 回退本地数据
    var defaultData = require('../../../data/defaultData.js');
    var list = defaultData.defaultAttractions;
    for (var j = 0; j < list.length; j++) {
      if (list[j]._id === id) {
        var localFound = list[j];
        if (!localFound.introduction) localFound.introduction = localFound.description || '';
        that.renderAttraction(localFound, defaultData.defaultReviews);
        return;
      }
    }

    // 4. 未找到
    that.setData({ loading: false });
    wx.showToast({ title: '景点不存在', icon: 'none' });
  },

  // 渲染景点数据
  renderAttraction: function (attraction, reviews) {
    // 构建地图标记
    var markers = [];
    if (attraction.location && attraction.location.latitude) {
      markers.push({
        id: 0,
        latitude: attraction.location.latitude,
        longitude: attraction.location.longitude,
        title: attraction.name,
        iconPath: '/images/marker-attraction.png',
        width: 36,
        height: 48,
        callout: {
          content: attraction.name,
          color: '#333',
          fontSize: 13,
          borderRadius: 8,
          padding: 8,
          display: 'ALWAYS'
        }
      });
    }

    this.setData({
      attraction: attraction,
      markers: markers,
      reviews: reviews.length > 0 ? reviews : (attraction.reviews || []),
      totalReviews: attraction.reviewCount || (reviews ? reviews.length : 0),
      loading: false
    });

    wx.setNavigationBarTitle({ title: attraction.name || '景点详情' });
  },

  // 记录浏览历史
  recordHistory: function (id) {
    var history = wx.getStorageSync('browseHistory') || [];
    // 去重
    var idx = history.indexOf(id);
    if (idx >= 0) history.splice(idx, 1);
    history.unshift(id);
    // 最多保留20条
    if (history.length > 20) history.pop();
    wx.setStorageSync('browseHistory', history);
  },

  // ========== 交互事件 ==========

  onSwiperChange: function (e) {
    this.setData({ currentImageIndex: e.detail.current });
  },

  onPreviewImage: function (e) {
    wx.previewImage({
      urls: this.data.attraction.images,
      current: e.currentTarget.dataset.url
    });
  },

  onNavigate: function () {
    var loc = this.data.attraction.location;
    if (!loc || !loc.latitude) {
      wx.showToast({ title: '暂无位置信息', icon: 'none' });
      return;
    }
    wx.openLocation({
      latitude: loc.latitude,
      longitude: loc.longitude,
      name: this.data.attraction.name,
      address: this.data.attraction.address || '',
      scale: 16
    });
  },

  onOpenMap: function () { this.onNavigate(); },

  onAddToRoute: function () {
    var ids = wx.getStorageSync('selectedAttractionIds') || [];
    if (ids.indexOf(this.data.attractionId) === -1) {
      ids.push(this.data.attractionId);
    }
    wx.setStorageSync('selectedAttractionIds', ids);
    wx.navigateTo({ url: '/pages/routes/plan/plan' });
  },

  onShareAppMessage: function () {
    return {
      title: '去俺村 - ' + this.data.attraction.name,
      path: '/pages/attractions/detail/detail?id=' + this.data.attractionId
    };
  }
});
