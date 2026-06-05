// pages/admin/featured/index.js - 精选景点管理（上架/下架）
Page({
  data: {
    attractions: [],
    allAttractions: [],
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
        name: 'adminAttractions',
        data: { action: 'list', data: { page: 1, pageSize: 100 } }
      });
      if (res.result && res.result.list) {
        that.setData({
          attractions: res.result.list,
          allAttractions: res.result.list,
          total: res.result.total || 0,
          loading: false
        });
      } else {
        that.setData({ loading: false });
      }
    } catch (err) {
      that.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onSearchInput: function (e) {
    var kw = (e.detail.value || '').trim().toLowerCase();
    this.setData({ keyword: e.detail.value });
    if (!kw) {
      this.setData({ attractions: this.data.allAttractions, total: this.data.allAttractions.length });
      return;
    }
    var filtered = this.data.allAttractions.filter(function (a) {
      return (a.name || '').toLowerCase().indexOf(kw) >= 0 ||
             (a.address || '').toLowerCase().indexOf(kw) >= 0;
    });
    this.setData({ attractions: filtered, total: filtered.length });
  },

  onSearch: function () {
    this.onSearchInput({ detail: { value: this.data.keyword } });
  },

  onToggle: function (e) {
    var that = this;
    var id = e.currentTarget.dataset.id;
    var name = e.currentTarget.dataset.name;
    var current = e.currentTarget.dataset.featured;

    wx.showModal({
      title: current ? '下架精选' : '上架精选',
      content: '确定' + (current ? '下架' : '上架') + '「' + name + '」？',
      confirmText: current ? '下架' : '上架',
      confirmColor: current ? '#E53935' : '#2E7D32',
      success: async function (r) {
        if (!r.confirm) return;
        try {
          var res = await wx.cloud.callFunction({
            name: 'adminAttractions',
            data: { action: 'toggleFeatured', id: id }
          });
          if (res.result && res.result.success) {
            wx.showToast({ title: res.result.featured ? '已上架' : '已下架', icon: 'success' });
            that.loadList();
          }
        } catch (err) {
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      }
    });
  }
});
