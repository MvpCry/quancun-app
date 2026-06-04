// pages/admin/reports/index.js
Page({
  data: {
    reports: [], violations: [], bans: [],
    total: 0, loading: true,
    activeTab: 'pending'  // pending | handled | violations | bans
  },
  onLoad: function () { this.loadData(); },
  onTabChange: function (e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab });
    this.loadData();
  },
  loadData: function () {
    var tab = this.data.activeTab;
    if (tab === 'violations') this.loadViolations();
    else if (tab === 'bans') this.loadBans();
    else this.loadReports();
  },
  // === 举报 ===
  loadReports: async function (page) {
    var that = this; page = page || 1; that.setData({ loading: true });
    try {
      var res = await wx.cloud.callFunction({ name: 'handleReport', data: { action: 'listReports', status: that.data.activeTab, page: page, pageSize: 20 } });
      that.setData({ reports: (res.result && res.result.list) || [], total: (res.result && res.result.total) || 0, loading: false });
    } catch (err) { that.setData({ loading: false }); }
  },
  // === 违规 ===
  loadViolations: async function () {
    var that = this; that.setData({ loading: true });
    try {
      var res = await wx.cloud.callFunction({ name: 'handleReport', data: { action: 'listViolations', pageSize: 50 } });
      that.setData({ violations: (res.result && res.result.list) || [], loading: false });
    } catch (err) { that.setData({ loading: false }); }
  },
  // === 禁言 ===
  loadBans: async function () {
    var that = this; that.setData({ loading: true });
    try {
      var res = await wx.cloud.callFunction({ name: 'handleReport', data: { action: 'listBans' } });
      that.setData({ bans: (res.result && res.result.list) || [], loading: false });
    } catch (err) { that.setData({ loading: false }); }
  },
  // 删除评论
  onDeleteReview: function (e) {
    var that = this, reportId = e.currentTarget.dataset.reportId, reviewId = e.currentTarget.dataset.reviewId;
    wx.showModal({ title: '删除评论', content: '确定删除该评论？', confirmText: '删除', confirmColor: '#E53935',
      success: async function (r) { if (r.confirm) {
        try { await wx.cloud.callFunction({ name: 'handleReport', data: { action: 'deleteReview', reportId: reportId, reviewId: reviewId } }); that.loadData(); } catch (err) {}
      }}
    });
  },
  // 驳回举报
  onDismissReport: function (e) {
    var that = this, reportId = e.currentTarget.dataset.reportId;
    wx.showModal({ title: '驳回举报', content: '评论保持正常展示', confirmText: '驳回', confirmColor: '#FF9800',
      success: async function (r) { if (r.confirm) {
        try { await wx.cloud.callFunction({ name: 'handleReport', data: { action: 'dismissReport', reportId: reportId } }); that.loadData(); } catch (err) {}
      }}
    });
  },
  // 解除禁言
  onLiftBan: function (e) {
    var that = this, banId = e.currentTarget.dataset.banId;
    wx.showModal({ title: '解除禁言', content: '确定解除？', confirmText: '解除', confirmColor: '#2E7D32',
      success: async function (r) { if (r.confirm) {
        try { await wx.cloud.callFunction({ name: 'handleReport', data: { action: 'liftBan', banId: banId } }); that.loadBans(); } catch (err) {}
      }}
    });
  },
  // 批量清理
  onBatchClean: function () {
    var that = this;
    wx.showModal({ title: '批量清理', content: '删除所有被举报≥3次的评论', confirmText: '执行', confirmColor: '#E53935',
      success: async function (r) { if (r.confirm) {
        try {
          var res = await wx.cloud.callFunction({ name: 'handleReport', data: { action: 'batchDeleteFlagged' } });
          if (res.result && res.result.success) { wx.showToast({ title: res.result.message, icon: 'success' }); that.loadData(); }
        } catch (err) {}
      }}
    });
  },
  onPullDownRefresh: function () {
    this.loadData();
    wx.stopPullDownRefresh();
  }
});
