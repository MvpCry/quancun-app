// pages/attractions/detail/detail.js
// 直接显示数据，不依赖云函数
var defaultData = require('../../data/defaultData.js');

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
    this.showAttraction(options.id);
  },

  // 显示景点（直接从本地数据取）
  showAttraction: function (id) {
    var list = defaultData.defaultAttractions;
    var found = null;

    for (var i = 0; i < list.length; i++) {
      if (list[i]._id === id) {
        found = list[i];
        break;
      }
    }

    if (!found) {
      this.setData({ loading: false });
      wx.showToast({ title: '景点不存在', icon: 'none' });
      return;
    }

    // 兼容字段：确保 introduction 存在
    if (!found.introduction) {
      found.introduction = found.description || '';
    }

    // 构建地图标记
    var markers = [];
    if (found.location && found.location.latitude) {
      markers.push({
        id: 0,
        latitude: found.location.latitude,
        longitude: found.location.longitude,
        title: found.name,
        iconPath: '/images/marker-attraction.png',
        width: 36,
        height: 48,
        callout: {
          content: found.name,
          color: '#333',
          fontSize: 13,
          borderRadius: 8,
          padding: 8,
          display: 'ALWAYS'
        }
      });
    }

    this.setData({
      attraction: found,
      markers: markers,
      reviews: defaultData.defaultReviews,
      totalReviews: defaultData.defaultReviews.length,
      loading: false
    });

    wx.setNavigationBarTitle({ title: found.name || '景点详情' });

    // 后台尝试云函数更新（可选，有则更新无则忽略）
    this.tryCloudUpdate(id);
  },

  // 后台尝试云函数（不阻塞页面显示）
  tryCloudUpdate: function (id) {
    if (typeof wx.cloud === 'undefined') return;
    wx.cloud.callFunction({
      name: 'getAttractionDetail',
      data: { id: id },
      success: function (res) {
        // 云函数有数据时可以更新，但不影响已显示的内容
        console.log('云函数返回:', res);
      },
      fail: function () {}
    });
  },

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
