// pages/routes/list/list.js - 路线列表页
var defaultData = require('../../data/defaultData.js');

Page({
  data: {
    routeTags: [],
    activeTag: '',
    routes: [],
    loading: true
  },

  onLoad: function () {
    var app = getApp();  // ← 移到 onLoad 内部，确保 App() 已初始化
    this.setData({ routeTags: app.globalData.routeTags });
    this.loadLocalData();
    this.tryCloudLoad();
  },

  // 从本地数据加载（立即显示）
  loadLocalData: function () {
    var list = defaultData.defaultRoutes;
    var tag = this.data.activeTag;
    if (tag) {
      list = list.filter(function (r) {
        return r.tags && r.tags.indexOf(tag) >= 0;
      });
    }
    this.setData({ routes: list, hasMore: false, loading: false });
  },

  // 后台尝试云函数
  tryCloudLoad: function () {
    if (typeof wx.cloud === 'undefined') return;
    var that = this;
    wx.cloud.callFunction({
      name: 'getRoutes',
      data: { action: 'list', page: 1, pageSize: 20 },
      success: function (res) {
        if (res.result && res.result.list && res.result.list.length > 0) {
          that.setData({ routes: res.result.list });
        }
      },
      fail: function () {}
    });
  },

  onPullDownRefresh: function () {
    this.loadLocalData();
    wx.stopPullDownRefresh();
  },

  onTagChange: function (e) {
    this.setData({ activeTag: e.currentTarget.dataset.tag });
    this.loadLocalData();
  },

  onRouteTap: function (e) {
    var id = e.detail ? e.detail.id : e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/routes/detail/detail?id=' + id });
  },

  onCreateRoute: function () {
    wx.navigateTo({ url: '/pages/routes/plan/plan' });
  },

  onShareAppMessage: function () {
    return { title: '去俺村 - 发现最美旅游路线', path: '/pages/routes/list/list' };
  }
});
