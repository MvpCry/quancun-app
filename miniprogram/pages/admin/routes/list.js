// pages/admin/routes/list.js - 路线列表管理
Page({
  data: { routes: [], loading: true },
  onShow: function () { this.loadRoutes(); },
  loadRoutes: async function () {
    var that = this; that.setData({ loading: true });
    try {
      var res = await wx.cloud.callFunction({ name: 'adminRoutes', data: { action: 'list', data: {} } });
      if (res.result) that.setData({ routes: res.result.list || [], loading: false });
      else that.setData({ loading: false });
    } catch (err) { that.setData({ loading: false }); }
  },
  onAdd: function () { wx.navigateTo({ url: '/pages/admin/routes/edit' }); },
  onEdit: function (e) {
    wx.navigateTo({ url: '/pages/admin/routes/edit?id=' + e.currentTarget.dataset.id });
  },
  onDelete: function (e) {
    var that = this, id = e.currentTarget.dataset.id, name = e.currentTarget.dataset.name;
    wx.showModal({ title: '删除路线', content: '确定删除「' + name + '」？', confirmText: '删除', confirmColor: '#E53935',
      success: async function (r) {
        if (!r.confirm) return;
        try {
          await wx.cloud.callFunction({ name: 'adminRoutes', data: { action: 'delete', data: { id: id } } });
          wx.showToast({ title: '已删除', icon: 'success' });
          that.loadRoutes();
          getApp().refreshCache('routes');
        } catch (err) { wx.showToast({ title: '操作失败', icon: 'none' }); }
      }
    });
  }
});
