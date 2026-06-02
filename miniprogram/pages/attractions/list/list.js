// pages/attractions/list/list.js - 景点列表页
var defaultData = require('../../data/defaultData.js');

Page({
  data: {
    categories: [],
    activeCategory: '',
    keyword: '',
    sortBy: 'rating',
    attractions: [],
    page: 1,
    hasMore: false,
    loading: true
  },

  onLoad: function (options) {
    var app = getApp();  // ← 移到 onLoad 内部，确保 App() 已初始化
    this.setData({ categories: app.globalData.categories });
    if (options.category) this.setData({ activeCategory: options.category });
    // 先加载本地数据，再尝试云函数
    this.loadLocalData();
    this.tryCloudLoad();
  },

  // 从本地数据加载（立即显示）
  loadLocalData: function () {
    var list = defaultData.defaultAttractions;
    var category = this.data.activeCategory;
    var keyword = this.data.keyword;

    // 分类筛选
    if (category) {
      list = list.filter(function (a) { return a.category === category; });
    }
    // 关键词搜索
    if (keyword) {
      list = list.filter(function (a) {
        return a.name.indexOf(keyword) >= 0 ||
               (a.description && a.description.indexOf(keyword) >= 0);
      });
    }
    // 排序
    if (this.data.sortBy === 'rating') {
      list.sort(function (a, b) { return b.rating - a.rating; });
    }

    this.setData({
      attractions: list,
      hasMore: false,
      loading: false
    });
  },

  // 后台尝试云函数
  tryCloudLoad: function () {
    if (typeof wx.cloud === 'undefined') return;
    var that = this;
    wx.cloud.callFunction({
      name: 'getAttractions',
      data: { action: 'list', page: 1, pageSize: 20 },
      success: function (res) {
        if (res.result && res.result.list && res.result.list.length > 0) {
          that.setData({ attractions: res.result.list });
        }
      },
      fail: function () {}
    });
  },

  onPullDownRefresh: function () {
    this.loadLocalData();
    wx.stopPullDownRefresh();
  },

  onSearchInput: function (e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearch: function () {
    this.loadLocalData();
  },

  onClearSearch: function () {
    this.setData({ keyword: '' });
    this.loadLocalData();
  },

  onCategoryChange: function (e) {
    this.setData({ activeCategory: e.currentTarget.dataset.category });
    this.loadLocalData();
  },

  onSortChange: function (e) {
    this.setData({ sortBy: e.currentTarget.dataset.sort });
    this.loadLocalData();
  },

  onAttractionTap: function (e) {
    var id = e.detail ? e.detail.id : e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/attractions/detail/detail?id=' + id });
  },

  onShareAppMessage: function () {
    return { title: '去俺村 - 发现最美景点', path: '/pages/attractions/list/list' };
  }
});
