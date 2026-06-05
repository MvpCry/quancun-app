// pages/index/index.js - 首页
// 数据通过 app.fetchAttractions/fetchRoutes 获取，自动与底部Tab模块同步缓存

Page({
  data: {
    banners: [],
    categories: [],
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
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    this.refreshFromCache();
  },

  // ========== 主加载：云优先 ==========
  loadData: async function () {
    var that = this;
    var app = getApp();

    that.setData({ loading: true, loadError: false });

    try {
      // 精选景点：从云数据库 featured 字段筛选
      var featuredPromise = app.callCloud('getAttractions', { action: 'featured', limit: 20 }, 8000)
        .then(function (res) { return (res.result && res.result.list) ? res.result.list : []; })
        .catch(function () { return []; });

      // 推荐路线：从云数据库 recommended 字段筛选
      var routePromise = app.callCloud('getRoutes', { action: 'recommend', limit: 20 }, 8000)
        .then(function (res) { return (res.result && res.result.list) ? res.result.list : []; })
        .catch(function () { return []; });

      // Banner：从后台banners集合读取
      var bannerPromise = app.callCloud('manageBanners', { action: 'list' }, 8000)
        .then(function (res) { return (res.result && res.result.list) ? res.result.list : []; })
        .catch(function () { return []; });

      var results = await Promise.all([featuredPromise, routePromise, bannerPromise]);
      var featured = results[0];
      var routes = results[1];
      var banners = results[2];

      // 如果精选景点为空，回退取评分最高的前6个
      if (featured.length === 0) {
        try {
          var fallbackRes = await app.fetchAttractions({ sortBy: 'rating', pageSize: 6 });
          featured = fallbackRes.list || [];
        } catch (e) { featured = []; }
      }

      // 如果推荐路线为空，回退取全部路线
      if (routes.length === 0) {
        try {
          var fallbackRoutes = await app.fetchRoutes({ limit: 20 });
          routes = fallbackRoutes.list || [];
        } catch (e) { routes = []; }
      }

      // 如果 Banner 为空，从精选景点构建
      if (banners.length === 0) {
        banners = that.buildBanners(featured);
      }

      that.setData({
        banners: banners,
        featuredAttractions: featured,
        recommendRoutes: routes,
        loading: false
      });
    } catch (err) {
      console.error('首页加载失败:', err);
      that.setData({ loading: false, loadError: true });
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
