// pages/admin/banners/index.js - 首页轮播Banner管理（列出所有村落开关）
Page({
  data: {
    attractions: [],
    allAttractions: [],
    total: 0,
    loading: true,
    keyword: '',
    isAndroid: false,
    backIcon: '<',
  },

  onLoad: function () { this.setData({ isAndroid: wx.getSystemInfoSync().platform === 'android' }); this.loadList(); },
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
      wx.showModal({
        title: '加载失败',
        content: (err.errMsg || err.message || '云函数调用失败') + '\n\n请确认 adminAttractions 云函数已部署',
        showCancel: false
      });
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
    var current = e.currentTarget.dataset.banner;

    wx.showModal({
      title: current ? '移除轮播' : '加入轮播',
      content: '确定' + (current ? '移除' : '加入') + '「' + name + '」？',
      confirmText: current ? '移除' : '加入',
      confirmColor: current ? '#FF9800' : '#2E7D32',
      success: async function (r) {
        if (!r.confirm) return;
        try {
          var res = await wx.cloud.callFunction({
            name: 'adminAttractions',
            data: { action: 'toggleBanner', id: id }
          });
          if (res.result && res.result.success) {
            wx.showToast({ title: res.result.isBanner ? '已加入轮播' : '已移除', icon: 'success' });
            that.loadList();
          }
        } catch (err) {
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      }
    });
  },

  onNavBack: function () {
    wx.navigateBack();
  }
});
