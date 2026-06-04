// pages/attractions/list/list.js - 景点列表页
// 数据通过 app.fetchAttractions 获取，与首页共享缓存

Page({
  data: {
    categories: [],
    activeCategory: '',
    keyword: '',
    sortBy: 'rating',
    attractions: [],
    page: 1,
    hasMore: false,
    loading: true,
    loadingMore: false,

    // 选择模式（从路线规划页跳转过来时 mode=select）
    selectMode: false,
    selectedIds: [],       // 已选的景点ID列表
    focusSearch: false     // 是否自动聚焦搜索框
  },

  onLoad: function (options) {
    var app = getApp();
    this.setData({ categories: app.globalData.categories });

    // 选择模式
    if (options && options.mode === 'select') {
      this.setData({ selectMode: true });
      var storedIds = wx.getStorageSync('selectedAttractionIds') || [];
      this.setData({ selectedIds: storedIds });
    }

    // 分类筛选（从首页点分类跳转）
    if (options && options.category) {
      this.setData({ activeCategory: options.category });
    }

    // 自动聚焦搜索
    if (options && options.focusSearch === '1') {
      this.setData({ focusSearch: true });
    }

    // 直接传入关键词（从首页搜索栏跳转）
    if (options && options.keyword) {
      var decoded = decodeURIComponent(options.keyword);
      this.setData({ keyword: decoded });
    }

    this.loadData();
  },

  onShow: function () {
    // 选择模式下刷新已选状态
    if (this.data.selectMode) {
      var storedIds = wx.getStorageSync('selectedAttractionIds') || [];
      this.setData({ selectedIds: storedIds });
    }
  },

  // ========== 主加载：云优先 + 缓存复用 ==========
  loadData: async function () {
    var that = this;
    var app = getApp();

    that.setData({ loading: true });

    try {
      var result = await app.fetchAttractions({
        category: that.data.activeCategory || undefined,
        keyword: that.data.keyword || undefined,
        sortBy: that.data.sortBy
      });

      var list = result ? result.list : [];
      // 选择模式下标记已选景点
      if (that.data.selectMode) {
        list = list.map(function (a) {
          a._selected = that.data.selectedIds.indexOf(a._id) >= 0;
          return a;
        });
      }

      that.setData({
        attractions: list,
        hasMore: result ? result.hasMore : false,
        loading: false
      });
    } catch (err) {
      console.error('加载景点列表失败:', err);
      that.setData({ loading: false, attractions: [], hasMore: false });
    }
  },

  // 加载更多（分页）
  loadMore: async function () {
    if (this.data.loadingMore || !this.data.hasMore) return;

    var that = this;
    var app = getApp();

    that.setData({ loadingMore: true });

    try {
      var nextPage = that.data.page + 1;
      var result = await app.fetchAttractions({
        category: that.data.activeCategory || undefined,
        keyword: that.data.keyword || undefined,
        sortBy: that.data.sortBy,
        page: nextPage
      });

      if (result && result.list.length > 0) {
        var list = that.data.attractions.concat(result.list);
        that.setData({
          attractions: list,
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
    app.refreshCache('attractions');
    this.setData({ page: 1 });
    this.loadData().then(function () {
      wx.stopPullDownRefresh();
    });
  },

  // ========== 搜索 ==========
  onSearchInput: function (e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearch: function () {
    this.setData({ page: 1 });
    this.loadData();
  },

  onClearSearch: function () {
    this.setData({ keyword: '', page: 1 });
    this.loadData();
  },

  // ========== 分类筛选 ==========
  onCategoryChange: function (e) {
    var category = e.currentTarget.dataset.category;
    this.setData({
      activeCategory: category,
      page: 1
    });
    this.loadData();
  },

  // ========== 排序 ==========
  onSortChange: function (e) {
    this.setData({
      sortBy: e.currentTarget.dataset.sort,
      page: 1
    });
    this.loadData();
  },

  // ========== 景点点击 ==========
  onAttractionTap: function (e) {
    var id = e.detail ? e.detail.id : e.currentTarget.dataset.id;

    // 选择模式：切换选中状态
    if (this.data.selectMode) {
      this.toggleSelect(id);
      return;
    }

    // 正常模式：跳转详情
    wx.navigateTo({ url: '/pages/attractions/detail/detail?id=' + id });
  },

  // ========== 选择模式（路线规划用） ==========
  toggleSelect: function (id) {
    var selectedIds = this.data.selectedIds.slice();
    var idx = selectedIds.indexOf(id);

    if (idx >= 0) {
      selectedIds.splice(idx, 1);
    } else {
      selectedIds.push(id);
    }

    // 更新本地景点列表的选中状态
    var attractions = this.data.attractions.map(function (a) {
      a._selected = selectedIds.indexOf(a._id) >= 0;
      return a;
    });

    this.setData({
      selectedIds: selectedIds,
      attractions: attractions
    });

    // 同步到缓存
    wx.setStorageSync('selectedAttractionIds', selectedIds);
  },

  // 完成选择 → 跳转路线规划
  onConfirmSelect: function () {
    if (this.data.selectedIds.length < 2) {
      wx.showToast({ title: '请至少选择2个景点', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/routes/plan/plan' });
  },

  // 取消选择 → 返回上一页
  onCancelSelect: function () {
    wx.removeStorageSync('selectedAttractionIds');
    wx.navigateBack();
  },

  // ========== 分享 ==========
  onShareAppMessage: function () {
    return { title: '去俺村 - 发现最美景点', path: '/pages/attractions/list/list' };
  }
});
