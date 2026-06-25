// pages/admin/routes/list.js - 路线列表管理（无刷新局部更新 + 推荐开关）
Page({
  data: { routes: [], loading: true, isAndroid: false
    backIcon: '<', },

  onShow: function () {
    this.setData({ isAndroid: wx.getSystemInfoSync().platform === 'android' });
    if (this._loaded) { this.loadSilent(); } else { this.loadRoutes(); }
  },

  loadRoutes: async function () {
    var that = this; that.setData({ loading: true });
    try {
      var res = await wx.cloud.callFunction({ name: 'adminRoutes', data: { action: 'list', data: {} } });
      if (res.result && res.result.list) {
        that.setData({ routes: res.result.list, loading: false });
        that._loaded = true;
      } else { that.setData({ loading: false }); }
    } catch (err) { that.setData({ loading: false }); }
  },

  loadSilent: async function () {
    var that = this;
    try {
      var res = await wx.cloud.callFunction({ name: 'adminRoutes', data: { action: 'list', data: {} } });
      if (res.result && res.result.list) { that.setData({ routes: res.result.list }); }
    } catch (err) { /* 静默失败 */ }
  },

  onAdd: function () { wx.navigateTo({ url: '/pages/admin/routes/edit' }); },
  onEdit: function (e) {
    wx.navigateTo({ url: '/pages/admin/routes/edit?id=' + e.currentTarget.dataset.id });
  },

  onToggleRecommended: function (e) {
    var that = this;
    var id = e.currentTarget.dataset.id;
    var name = e.currentTarget.dataset.name;
    var current = e.currentTarget.dataset.recommended;

    wx.showModal({
      title: current ? '下架推荐' : '上架推荐',
      content: '确定将「' + name + '」' + (current ? '从首页推荐移除' : '展示在首页推荐') + '？',
      confirmText: current ? '下架' : '上架',
      confirmColor: current ? '#E53935' : '#2E7D32',
      success: async function (r) {
        if (!r.confirm) return;
        wx.showLoading({ title: '处理中...', mask: false });
        try {
          var res = await wx.cloud.callFunction({ name: 'adminRoutes', data: { action: 'toggleRecommended', id: id } });
          wx.hideLoading();
          if (res.result && res.result.success) {
            var list = that.data.routes.map(function (item) {
              if (item._id === id) { item.recommended = res.result.recommended; }
              return item;
            });
            that.setData({ routes: list });
            wx.showToast({ title: res.result.recommended ? '已上架推荐' : '已下架推荐', icon: 'success' });
            getApp().refreshCache('routes');
          }
        } catch (err) { wx.hideLoading(); wx.showToast({ title: '操作失败', icon: 'none' }); }
      }
    });
  },

  onDelete: function (e) {
    var that = this, id = e.currentTarget.dataset.id, name = e.currentTarget.dataset.name;
    wx.showModal({ title: '删除路线', content: '确定删除「' + name + '」？', confirmText: '删除', confirmColor: '#E53935',
      success: async function (r) {
        if (!r.confirm) return;
        wx.showLoading({ title: '删除中...', mask: false });
        try {
          await wx.cloud.callFunction({ name: 'adminRoutes', data: { action: 'delete', data: { id: id } } });
          wx.hideLoading();
          var list = that.data.routes.filter(function (item) { return item._id !== id; });
          that.setData({ routes: list });
          wx.showToast({ title: '已删除', icon: 'success' });
          getApp().refreshCache('routes');
        } catch (err) { wx.hideLoading(); wx.showToast({ title: '操作失败', icon: 'none' }); }
      }
    });
  },

  onNavBack: function () {
    wx.navigateBack();
  }
});
