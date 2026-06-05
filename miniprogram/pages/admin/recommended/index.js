// pages/admin/recommended/index.js - 推荐路线管理（上架/下架）
Page({
  data: {
    routes: [],
    allRoutes: [],
    total: 0,
    loading: true,
    keyword: ''
  },

  onLoad: function () { this.loadList(); },
  onShow: function () { this.loadList(); },

  loadList: async function () {
    var that = this;
    that.setData({ loading: true });
    try {
      var res = await wx.cloud.callFunction({
        name: 'adminRoutes',
        data: { action: 'list', data: { page: 1, pageSize: 100 } }
      });
      if (res.result && res.result.list) {
        that.setData({
          routes: res.result.list,
          allRoutes: res.result.list,
          total: res.result.total || 0,
          loading: false
        });
      } else {
        that.setData({ loading: false });
      }
    } catch (err) {
      that.setData({ loading: false });
      console.error('adminRoutes加载失败:', err);
      wx.showModal({
        title: '加载失败',
        content: (err.errMsg || err.message || '云函数调用失败') + '\n\n请确认 adminRoutes 云函数已部署',
        showCancel: false
      });
    }
  },

  onSearchInput: function (e) {
    var kw = (e.detail.value || '').trim().toLowerCase();
    this.setData({ keyword: e.detail.value });
    if (!kw) {
      this.setData({ routes: this.data.allRoutes, total: this.data.allRoutes.length });
      return;
    }
    var filtered = this.data.allRoutes.filter(function (r) {
      return (r.name || '').toLowerCase().indexOf(kw) >= 0 ||
             (r.description || '').toLowerCase().indexOf(kw) >= 0;
    });
    this.setData({ routes: filtered, total: filtered.length });
  },

  onSearch: function () {
    // 触发搜索（与输入联动已实时过滤，此处兼容按钮点击）
    this.onSearchInput({ detail: { value: this.data.keyword } });
  },

  onToggle: function (e) {
    var that = this;
    var id = e.currentTarget.dataset.id;
    var name = e.currentTarget.dataset.name;
    var current = e.currentTarget.dataset.recommended;

    wx.showModal({
      title: current ? '下架推荐' : '上架推荐',
      content: '确定' + (current ? '下架' : '上架') + '「' + name + '」？',
      confirmText: current ? '下架' : '上架',
      confirmColor: current ? '#E53935' : '#2E7D32',
      success: async function (r) {
        if (!r.confirm) return;
        try {
          var res = await wx.cloud.callFunction({
            name: 'adminRoutes',
            data: { action: 'toggleRecommended', id: id }
          });
          if (res.result && res.result.success) {
            wx.showToast({ title: res.result.recommended ? '已上架' : '已下架', icon: 'success' });
            that.loadList();
          }
        } catch (err) {
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      }
    });
  }
});
