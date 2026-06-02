// pages/mine/index/index.js - 我的页面逻辑
// 修复：getApp() 移到 onLoad 内部，避免模块顶层调用

Page({
  data: {
    isLogin: false,
    userInfo: {},
    favoriteCount: 0,
    myRouteCount: 0,
    myReviewCount: 0,
    activeTab: '',
    tabList: []
  },

  onLoad: function () {
    this.checkLoginState();
  },

  onShow: function () {
    this.checkLoginState();
    if (this.data.isLogin) {
      this.loadUserStats();
    }
    if (this.data.activeTab) {
      this.loadTabData(this.data.activeTab);
    }
  },

  // 检查登录状态
  checkLoginState: function () {
    var app = getApp();
    var userInfo = wx.getStorageSync('userInfo');

    if (userInfo && (app.globalData.isLogin || userInfo.nickName)) {
      this.setData({
        isLogin: true,
        userInfo: userInfo
      });
    } else {
      this.setData({
        isLogin: false,
        userInfo: {}
      });
    }
  },

  // 加载用户统计
  loadUserStats: async function () {
    if (!wx.cloud) return;

    try {
      var res = await wx.cloud.callFunction({
        name: 'getProfile',
        data: { action: 'stats' }
      });
      if (res.result) {
        this.setData({
          favoriteCount: res.result.favoriteCount || 0,
          myRouteCount: res.result.routeCount || 0,
          myReviewCount: res.result.reviewCount || 0
        });
      }
    } catch (err) {
      console.error('加载统计失败:', err);
    }
  },

  // 登录（兼容新版微信）
  onLogin: function () {
    var app = getApp();
    var that = this;

    app.getUserProfile(function (userInfo) {
      that.checkLoginState();
      if (that.data.isLogin) {
        that.loadUserStats();
      }
    });
  },

  // 退出登录
  onLogout: function () {
    var that = this;
    var app = getApp();

    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: function (modalRes) {
        if (modalRes.confirm) {
          wx.removeStorageSync('userInfo');
          app.globalData.userInfo = null;
          app.globalData.isLogin = false;
          app.refreshCache('all');
          that.setData({
            isLogin: false,
            userInfo: {},
            favoriteCount: 0,
            myRouteCount: 0,
            myReviewCount: 0
          });
          wx.showToast({ title: '已退出登录', icon: 'success' });
        }
      }
    });
  },

  // 点击功能tab
  onTabTap: function (e) {
    var tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    this.loadTabData(tab);
  },

  // 关闭tab
  onCloseTab: function () {
    this.setData({ activeTab: '', tabList: [] });
  },

  // 加载tab数据
  loadTabData: async function (tab) {
    if (!wx.cloud) {
      this.setData({ tabList: [] });
      return;
    }

    wx.showLoading({ title: '加载中...' });

    try {
      switch (tab) {
        case 'favorites': {
          var favRes = await wx.cloud.callFunction({
            name: 'getFavorites',
            data: { action: 'list' }
          });
          this.setData({
            tabList: (favRes.result && favRes.result.list) || []
          });
          break;
        }

        case 'routes': {
          var routeRes = await wx.cloud.callFunction({
            name: 'getRoutes',
            data: { action: 'myRoutes' }
          });
          this.setData({
            tabList: (routeRes.result && routeRes.result.list) || []
          });
          break;
        }

        case 'reviews': {
          var reviewRes = await wx.cloud.callFunction({
            name: 'getReviews',
            data: { action: 'myReviews' }
          });
          this.setData({
            tabList: (reviewRes.result && reviewRes.result.list) || []
          });
          break;
        }

        case 'history': {
          var history = wx.getStorageSync('browseHistory') || [];
          if (history.length > 0) {
            var historyRes = await wx.cloud.callFunction({
              name: 'getAttractions',
              data: { action: 'byIds', ids: history }
            });
            this.setData({
              tabList: (historyRes.result && historyRes.result.list) || []
            });
          } else {
            this.setData({ tabList: [] });
          }
          break;
        }
      }
    } catch (err) {
      console.error('加载数据失败:', err);
      this.setData({ tabList: [] });
    }

    wx.hideLoading();
  },

  // 收藏项点击
  onFavItemTap: function (e) {
    var item = e.currentTarget.dataset.item;
    if (item.favType === 'attraction' || item.type === 'attraction') {
      wx.navigateTo({
        url: '/pages/attractions/detail/detail?id=' + (item.targetId || item._id)
      });
    } else {
      wx.navigateTo({
        url: '/pages/routes/detail/detail?id=' + (item.targetId || item._id)
      });
    }
  },

  // 路线点击
  onRouteTap: function (e) {
    var id = e.detail ? e.detail.id : e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/routes/detail/detail?id=' + id });
  },

  // 景点点击
  onAttractionTap: function (e) {
    var id = e.detail ? e.detail.id : e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/attractions/detail/detail?id=' + id });
  },

  // 创建路线
  onCreateRoute: function () {
    wx.navigateTo({ url: '/pages/routes/plan/plan' });
  },

  // 导航跳转
  onNavigateTo: function (e) {
    var url = e.currentTarget.dataset.url;
    wx.navigateTo({ url: url });
  },

  // 关于
  onAbout: function () {
    wx.showModal({
      title: '关于去俺村',
      content: '去俺村是一款乡村旅游路线串联小程序，帮助游客发现最美乡村景点，智能规划最优游览路线，让每一次出游都更加便捷高效。\n\n版本：1.0.0',
      showCancel: false
    });
  },

  // 意见反馈
  onFeedback: function () {
    wx.showModal({
      title: '意见反馈',
      editable: true,
      placeholderText: '请输入你的建议或遇到的问题...',
      success: function (res) {
        if (res.confirm && res.content) {
          wx.showToast({ title: '感谢反馈！', icon: 'success' });
        }
      }
    });
  }
});
