// pages/mine/index/index.js - 我的页面逻辑
const app = getApp();

Page({
  data: {
    isLogin: false,
    userInfo: {},
    favoriteCount: 0,
    myRouteCount: 0,
    myReviewCount: 0,
    // 当前展开的tab（favorites/routes/reviews/history）
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
    // 如果正在展示某个tab，刷新数据
    if (this.data.activeTab) {
      this.loadTabData(this.data.activeTab);
    }
  },

  // 检查登录状态
  checkLoginState: function () {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && app.globalData.isLogin) {
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
    try {
      const res = await wx.cloud.callFunction({
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

  // 登录
  onLogin: function () {
    app.getUserProfile();
    // 延迟检查登录状态
    setTimeout(() => {
      this.checkLoginState();
      if (this.data.isLogin) {
        this.loadUserStats();
      }
    }, 800);
  },

  // 退出登录
  onLogout: function () {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: res => {
        if (res.confirm) {
          wx.removeStorageSync('userInfo');
          app.globalData.userInfo = null;
          app.globalData.isLogin = false;
          this.setData({
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
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    this.loadTabData(tab);
  },

  // 关闭tab
  onCloseTab: function () {
    this.setData({ activeTab: '', tabList: [] });
  },

  // 加载tab数据
  loadTabData: async function (tab) {
    wx.showLoading({ title: '加载中...' });

    try {
      switch (tab) {
        case 'favorites':
          const favRes = await wx.cloud.callFunction({
            name: 'getFavorites',
            data: { action: 'list' }
          });
          this.setData({
            tabList: (favRes.result && favRes.result.list) || []
          });
          break;

        case 'routes':
          const routeRes = await wx.cloud.callFunction({
            name: 'getRoutes',
            data: { action: 'myRoutes' }
          });
          this.setData({
            tabList: (routeRes.result && routeRes.result.list) || []
          });
          break;

        case 'reviews':
          const reviewRes = await wx.cloud.callFunction({
            name: 'getReviews',
            data: { action: 'myReviews' }
          });
          this.setData({
            tabList: (reviewRes.result && reviewRes.result.list) || []
          });
          break;

        case 'history':
          const history = wx.getStorageSync('browseHistory') || [];
          if (history.length > 0) {
            const historyRes = await wx.cloud.callFunction({
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
    } catch (err) {
      console.error('加载数据失败:', err);
      this.setData({ tabList: [] });
    }

    wx.hideLoading();
  },

  // 收藏项点击
  onFavItemTap: function (e) {
    const item = e.currentTarget.dataset.item;
    if (item.favType === 'attraction' || item.type === 'attraction') {
      wx.navigateTo({
        url: `/pages/attractions/detail/detail?id=${item.targetId || item._id}`
      });
    } else {
      wx.navigateTo({
        url: `/pages/routes/detail/detail?id=${item.targetId || item._id}`
      });
    }
  },

  // 路线点击
  onRouteTap: function (e) {
    const id = e.detail.id || e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/routes/detail/detail?id=${id}` });
  },

  // 景点点击
  onAttractionTap: function (e) {
    const id = e.detail.id || e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/attractions/detail/detail?id=${id}` });
  },

  // 创建路线
  onCreateRoute: function () {
    wx.navigateTo({ url: '/pages/routes/plan/plan' });
  },

  // 导航跳转
  onNavigateTo: function (e) {
    const url = e.currentTarget.dataset.url;
    wx.navigateTo({ url });
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
      success: res => {
        if (res.confirm && res.content) {
          // 可以通过云函数保存反馈
          wx.showToast({ title: '感谢反馈！', icon: 'success' });
        }
      }
    });
  }
});
