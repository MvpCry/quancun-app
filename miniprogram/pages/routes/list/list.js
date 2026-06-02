// pages/routes/list/list.js - 路线列表页
// 数据通过 app.fetchRoutes 获取，与首页共享缓存

Page({
  data: {
    routeTags: [],
    activeTag: '',
    routes: [],
    page: 1,
    hasMore: false,
    loading: true,
    loadingMore: false
  },

  onLoad: function () {
    var app = getApp();
    this.setData({ routeTags: app.globalData.routeTags });
    this.loadData();
  },

  onShow: function () {
    // 每次显示时从缓存刷新
    this.refreshFromCache();
  },

  // ========== 主加载：云优先 ==========
  loadData: async function () {
    var that = this;
    var app = getApp();

    that.setData({ loading: true });

    try {
      var result = await app.fetchRoutes({
        tag: that.data.activeTag || undefined
      });

      that.setData({
        routes: result ? result.list : [],
        hasMore: result ? result.hasMore : false,
        loading: false
      });
    } catch (err) {
      console.error('加载路线列表失败:', err);
      that.setData({ loading: false, routes: [], hasMore: false });
      that.refreshFromCache();
    }
  },

  // 从全局缓存刷新
  refreshFromCache: function () {
    var app = getApp();
    var routes = app.globalData.cachedRoutes;

    if (routes && routes.length > 0) {
      var tag = this.data.activeTag;
      var list = routes;
      if (tag) {
        list = routes.filter(function (r) {
          return r.tags && r.tags.indexOf(tag) >= 0;
        });
      }
      this.setData({ routes: list });
    }
  },

  // 加载更多
  loadMore: async function () {
    if (this.data.loadingMore || !this.data.hasMore) return;

    var that = this;
    var app = getApp();

    that.setData({ loadingMore: true });

    try {
      var nextPage = that.data.page + 1;
      var result = await app.fetchRoutes({
        tag: that.data.activeTag || undefined,
        page: nextPage
      });

      if (result && result.list.length > 0) {
        that.setData({
          routes: that.data.routes.concat(result.list),
          page: nextPage,
          hasMore: result.hasMore,
          loadingMore: false
        });
      } else {
        that.setData({ hasMore: false, loadingMore: false });
      }
    } catch (err) {
      that.setData({ loadingMore: false });
    }
  },

  // ========== 下拉刷新 ==========
  onPullDownRefresh: function () {
    var app = getApp();
    app.refreshCache('routes');
    this.setData({ page: 1 });
    this.loadData().then(function () {
      wx.stopPullDownRefresh();
    });
  },

  // 标签切换
  onTagChange: function (e) {
    this.setData({ activeTag: e.currentTarget.dataset.tag, page: 1 });
    this.loadData();
  },

  // 路线点击
  onRouteTap: function (e) {
    var id = e.detail ? e.detail.id : e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/routes/detail/detail?id=' + id });
  },

  // 创建路线
  onCreateRoute: function () {
    wx.navigateTo({ url: '/pages/routes/plan/plan' });
  },

  onShareAppMessage: function () {
    return { title: '去俺村 - 发现最美旅游路线', path: '/pages/routes/list/list' };
  }
});
