// pages/index/index.js - 首页
var defaultData = require('../../data/defaultData.js');

Page({
  data: {
    banners: [],
    categories: [],
    hotAttractions: [],
    recommendRoutes: [],
    featuredAttractions: [],
    loading: true
  },

  onLoad: function () {
    var app = getApp();  // ← 移到 onLoad 内部
    this.setData({ categories: app.globalData.categories });
    this.loadLocalData();
    this.tryCloudLoad();
  },

  // 从本地数据加载（立即显示，不等待云函数）
  loadLocalData: function () {
    var attractions = defaultData.defaultAttractions;
    var routes = defaultData.defaultRoutes;

    this.setData({
      banners: defaultData.buildBanners(attractions),
      hotAttractions: attractions,
      recommendRoutes: routes,
      featuredAttractions: attractions,
      loading: false
    });
  },

  // 后台尝试云函数（有数据则更新）
  tryCloudLoad: function () {
    if (typeof wx.cloud === 'undefined') return;
    var that = this;

    wx.cloud.callFunction({
      name: 'getAttractions',
      data: { action: 'list', sortBy: 'rating', limit: 6 },
      success: function (res) {
        if (res.result && res.result.list && res.result.list.length > 0) {
          that.setData({ hotAttractions: res.result.list, featuredAttractions: res.result.list });
        }
      },
      fail: function () {}
    });

    wx.cloud.callFunction({
      name: 'getRoutes',
      data: { action: 'recommend', limit: 3 },
      success: function (res) {
        if (res.result && res.result.list && res.result.list.length > 0) {
          that.setData({ recommendRoutes: res.result.list });
        }
      },
      fail: function () {}
    });
  },

  onPullDownRefresh: function () {
    this.loadLocalData();
    wx.stopPullDownRefresh();
  },

  getDefaultBanners: function () {
    return defaultData.buildBanners(defaultData.defaultAttractions);
  },

  onSearchTap: function () {
    wx.navigateTo({ url: '/pages/attractions/list/list?focusSearch=1' });
  },

  onBannerTap: function (e) {
    var dataset = e.currentTarget.dataset;
    if (dataset.type === 'attraction') {
      wx.navigateTo({ url: '/pages/attractions/detail/detail?id=' + dataset.id });
    } else if (dataset.type === 'route') {
      wx.navigateTo({ url: '/pages/routes/detail/detail?id=' + dataset.id });
    }
  },

  onCategoryTap: function (e) {
    wx.navigateTo({ url: '/pages/attractions/list/list?category=' + e.currentTarget.dataset.category });
  },

  onAttractionTap: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/attractions/detail/detail?id=' + id });
  },

  onRouteTap: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/routes/detail/detail?id=' + id });
  },

  onMoreAttractions: function () {
    wx.switchTab({ url: '/pages/attractions/list/list' });
  },

  onMoreRoutes: function () {
    wx.switchTab({ url: '/pages/routes/list/list' });
  },

  onShareAppMessage: function () {
    return { title: '去俺村 - 发现最美乡村旅游路线', path: '/pages/index/index' };
  }
});
