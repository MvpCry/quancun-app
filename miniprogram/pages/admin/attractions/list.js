// pages/admin/attractions/list.js - 景点列表管理
Page({
  data: { attractions: [], loading: true },
  onShow: function () { this.loadAttractions(); },
  loadAttractions: async function () {
    var that = this; that.setData({ loading: true });
    try {
      var res = await wx.cloud.callFunction({ name: 'adminAttractions', data: { action: 'list', data: {} } });
      if (res.result) that.setData({ attractions: res.result.list || [], loading: false });
      else that.setData({ loading: false });
    } catch (err) { that.setData({ loading: false }); }
  },
  onAdd: function () { wx.navigateTo({ url: '/pages/admin/attractions/edit' }); },
  onEdit: function (e) {
    wx.navigateTo({ url: '/pages/admin/attractions/edit?id=' + e.currentTarget.dataset.id });
  },
  onDelete: function (e) {
    var that = this, id = e.currentTarget.dataset.id, name = e.currentTarget.dataset.name;
    wx.showModal({ title: '删除景点', content: '确定删除「' + name + '」？此操作不可撤销。', confirmText: '删除', confirmColor: '#E53935',
      success: async function (r) {
        if (!r.confirm) return;
        try {
          await wx.cloud.callFunction({ name: 'adminAttractions', data: { action: 'delete', data: { id: id } } });
          wx.showToast({ title: '已删除', icon: 'success' });
          that.loadAttractions();
          // 刷新首页缓存
          getApp().refreshCache('attractions');
        } catch (err) { wx.showToast({ title: '操作失败', icon: 'none' }); }
      }
    });
  }
});
