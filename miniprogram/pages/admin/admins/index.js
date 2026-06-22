// pages/admin/admins/index.js - 管理员管理
var format = require('../../../utils/format.js');
Page({
  data: {
    admins: [],
    adminTotal: 0,
    loading: true,
    isAndroid: false,

    // 搜索结果
    searchKeyword: '',
    searchResults: [],
    searchTotal: 0,
    searching: false,

    currentOpenid: ''
  },

  onLoad: function () {
    this.setData({ isAndroid: wx.getSystemInfoSync().platform === 'android' });
    this.loadAdmins();
  },

  // ========== 管理员列表 ==========
  loadAdmins: async function () {
    var that = this;
    that.setData({ loading: true });
    try {
      var res = await wx.cloud.callFunction({
        name: 'manageAdmins',
        data: { action: 'listAdmins' }
      });
      if (res.result) {
        var admins = (res.result.list || []).map(function (a) {
          a.createTime = format.formatDate(a.createTime);
          return a;
        });
        that.setData({
          admins: admins,
          adminTotal: res.result.total || 0,
          currentOpenid: res.result.currentOpenid || '',
          loading: false
        });
      } else {
        that.setData({ loading: false });
        wx.showToast({ title: (res.result && res.result.error) || '加载失败', icon: 'none' });
      }
    } catch (err) {
      that.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // ========== 搜索用户 ==========
  onSearchInput: function (e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  onSearch: async function () {
    var that = this;
    var kw = (that.data.searchKeyword || '').trim();
    if (!kw) {
      wx.showToast({ title: '请输入昵称搜索', icon: 'none' });
      return;
    }
    that.setData({ searching: true });
    try {
      var res = await wx.cloud.callFunction({
        name: 'manageAdmins',
        data: { action: 'searchUsers', keyword: kw }
      });
      if (res.result) {
        that.setData({
          searchResults: res.result.list || [],
          searchTotal: res.result.total || 0,
          searching: false
        });
      } else {
        that.setData({ searching: false });
      }
    } catch (err) {
      that.setData({ searching: false });
      wx.showToast({ title: '搜索失败', icon: 'none' });
    }
  },

  // ========== 添加管理员 ==========
  onAddAdmin: function (e) {
    var that = this;
    var targetOpenid = e.currentTarget.dataset.openid;
    var nickName = e.currentTarget.dataset.nickname;

    if (!targetOpenid) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '设为管理员',
      content: '确定将「' + (nickName || '该用户') + '」设为管理员吗？',
      confirmText: '确定',
      confirmColor: '#2E7D32',
      success: async function (r) {
        if (r.confirm) {
          wx.showLoading({ title: '添加中...' });
          try {
            var res = await wx.cloud.callFunction({
              name: 'manageAdmins',
              data: { action: 'addAdmin', targetOpenid: targetOpenid }
            });
            wx.hideLoading();
            if (res.result && res.result.success) {
              wx.showToast({ title: '已添加', icon: 'success' });
              // 刷新管理员列表和搜索结果（更新 isAdmin 标记）
              that.loadAdmins();
              that.onSearch();
            } else {
              wx.showToast({
                title: (res.result && res.result.error) || '添加失败',
                icon: 'none'
              });
            }
          } catch (err) {
            wx.hideLoading();
            wx.showToast({ title: '添加失败', icon: 'none' });
          }
        }
      }
    });
  },

  // ========== 移除管理员 ==========
  onRemoveAdmin: function (e) {
    var that = this;
    var adminId = e.currentTarget.dataset.id;
    var nickName = e.currentTarget.dataset.nickname;

    if (!adminId) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '移除管理员',
      content: '确定移除「' + (nickName || '该管理员') + '」的管理权限吗？',
      confirmText: '移除',
      confirmColor: '#E53935',
      success: async function (r) {
        if (r.confirm) {
          wx.showLoading({ title: '移除中...' });
          try {
            var res = await wx.cloud.callFunction({
              name: 'manageAdmins',
              data: { action: 'removeAdmin', adminId: adminId }
            });
            wx.hideLoading();
            if (res.result && res.result.success) {
              wx.showToast({ title: '已移除', icon: 'success' });
              that.loadAdmins();
            } else {
              wx.showToast({
                title: (res.result && res.result.error) || '移除失败',
                icon: 'none'
              });
            }
          } catch (err) {
            wx.hideLoading();
            wx.showToast({ title: '移除失败', icon: 'none' });
          }
        }
      }
    });
  },

  // ========== 清空搜索 ==========
  onClearSearch: function () {
    this.setData({
      searchKeyword: '',
      searchResults: [],
      searchTotal: 0
    });
  },

  onNavBack: function () {
    wx.navigateBack();
  }
});
