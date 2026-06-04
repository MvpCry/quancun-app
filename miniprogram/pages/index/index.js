// pages/index/index.js - 首页
// 数据通过 app.fetchAttractions/fetchRoutes 获取，自动与底部Tab模块同步缓存

Page({
  data: {
    banners: [],
    categories: [],
    hotAttractions: [],
    recommendRoutes: [],
    featuredAttractions: [],
    searchKeyword: '',
    loading: true,
    loadError: false
  },

  onLoad: function () {
    var app = getApp();
    this.setData({ categories: app.globalData.categories });
    this.loadData();
  },

  onShow: function () {
    // 每次显示时从缓存刷新（其他页面可能更新了数据）
    this.refreshFromCache();
  },

  // ========== 主加载：云优先 ==========
  loadData: async function () {
    var that = this;
    var app = getApp();

    that.setData({ loading: true, loadError: false });

    try {
      // 并行加载景点和路线（共享 app 缓存，Tab 页面直接复用）
      var attractionPromise = app.fetchAttractions({ sortBy: 'rating', pageSize: 6 });
      var routePromise = app.fetchRoutes({ action: 'recommend', limit: 3 });

      var results = await Promise.all([attractionPromise, routePromise]);
      var attractionResult = results[0];
      var routeResult = results[1];

      var attractions = attractionResult ? attractionResult.list : [];
      var routes = routeResult ? routeResult.list : [];

      // 构建 Banner（从景点数据中取前几个）
      var banners = that.buildBanners(attractions);

      that.setData({
        banners: banners,
        hotAttractions: attractions,
        recommendRoutes: routes,
        featuredAttractions: attractions,   // 精选 = 热门景点（可后续区分）
        loading: false
      });
    } catch (err) {
      console.error('首页加载失败:', err);
      that.setData({ loading: false, loadError: true });
      // 兜底：尝试从全局缓存读取
      that.refreshFromCache();
    }
  },

  // ========== 从全局缓存刷新（onShow 触发） ==========
  refreshFromCache: function () {
    var app = getApp();
    var attractions = app.globalData.cachedAttractions;
    var routes = app.globalData.cachedRoutes;

    if (attractions && attractions.length > 0) {
      this.setData({
        hotAttractions: attractions,
        featuredAttractions: attractions,
        banners: this.buildBanners(attractions)
      });
    }
    if (routes && routes.length > 0) {
      this.setData({ recommendRoutes: routes });
    }
  },

  // ========== 构建 Banner ==========
  buildBanners: function (attractions) {
    if (!attractions || attractions.length === 0) return [];
    return attractions.slice(0, 4).map(function (item) {
      return {
        id: item._id,
        type: 'attraction',
        image: item.images && item.images[0] ? item.images[0] : (item.coverImage || ''),
        title: item.name || '',
        desc: item.introduction ? item.introduction.substring(0, 30) + '...' : (item.description || '').substring(0, 30) + '...'
      };
    });
  },

  onPullDownRefresh: function () {
    var app = getApp();
    app.refreshCache('all');  // 清除缓存，强制重新拉取
    this.loadData().then(function () {
      wx.stopPullDownRefresh();
    });
  },

  // ========== 交互事件 ==========

  onSearchInput: function (e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  onSearch: function () {
    var keyword = (this.data.searchKeyword || '').trim();
    if (!keyword) {
      wx.navigateTo({ url: '/pages/search/index/index' });
      return;
    }
    wx.navigateTo({ url: '/pages/search/index/index?keyword=' + encodeURIComponent(keyword) });
  },

  onClearSearch: function () {
    this.setData({ searchKeyword: '' });
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
    var category = e.currentTarget.dataset.category;
    if (category === 'diy') {
      wx.navigateTo({ url: '/pages/routes/diy/index/index' });
    } else {
      // 红游/乡村游/亲子游/文化游 → 路线Tab（switchTab 不支持 URL 参数，用全局变量传参）
      var app = getApp();
      app.globalData.pendingRouteTag = category;
      wx.switchTab({ url: '/pages/routes/list/list' });
    }
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

  // 图片加载失败兜底
  onImageError: function (e) {
    // 真机 WebP 解码失败时，不会自动显示空白
    // 此处记录日志，如需替换可在 setData 中改成默认图
    console.warn('图片加载失败:', e.detail.errMsg);
  },

  onShareAppMessage: function () {
    return { title: '去俺村 - 发现最美乡村旅游路线', path: '/pages/index/index' };
  }
});
