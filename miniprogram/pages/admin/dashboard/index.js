// pages/admin/dashboard/index.js - 管理仪表盘
var app = getApp();

Page({
  data: {
    stats: null,
    loading: true,
    isAdmin: false,
    isAndroid: false,
    backIcon: '<',
    myOpenid: ''
  },

  onLoad: function () {
    this.setData({ isAndroid: wx.getSystemInfoSync().platform === 'android' });
    this.checkAdmin();
  },

  onShow: function () {
    if (this.data.isAdmin) this.loadStats();
  },

  checkAdmin: async function () {
    var that = this;
    if (!wx.cloud) { that.setData({ loading: false }); return; }

    // 先拿到自己的 openid，方便加入 admins
    var myOpenid = wx.getStorageSync('openid') || '';

    try {
      var res = await wx.cloud.callFunction({ name: 'getAdminStats', data: {} });
      if (res.result && res.result.success) {
        that.setData({ stats: res.result.stats, isAdmin: true, loading: false });
      } else {
        // 如果本地没有 openid，调云函数获取
        if (!myOpenid) {
          try {
            var loginRes = await wx.cloud.callFunction({ name: 'login', data: {} });
            if (loginRes.result && loginRes.result.openid) {
              myOpenid = loginRes.result.openid;
              wx.setStorageSync('openid', myOpenid);
            }
          } catch (e) {}
        }
        that.setData({ loading: false, isAdmin: false, myOpenid: myOpenid || '获取失败，请先登录' });
      }
    } catch (err) {
      that.setData({ loading: false, isAdmin: false, myOpenid: '获取失败，请先登录' });
    }
  },

  loadStats: async function () {
    var that = this;
    try {
      var res = await wx.cloud.callFunction({ name: 'getAdminStats', data: {} });
      if (res.result && res.result.success) {
        that.setData({ stats: res.result.stats });
      }
    } catch (err) { console.error('刷新统计失败:', err); }
  },

  onPullDownRefresh: function () {
    this.loadStats().then(function () { wx.stopPullDownRefresh(); });
  },

  onNavTo: function (e) {
    wx.navigateTo({ url: e.currentTarget.dataset.url });
  },

  onNavBack: function () {
    wx.navigateBack();
  },

  onStatTap: function (e) {
    var tab = e.currentTarget.dataset.tab;
    wx.navigateTo({ url: '/pages/admin/reports/index?tab=' + tab });
  }
});
