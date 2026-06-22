// pages/admin/bannedWords/index.js
Page({
  data: {
    words: [], total: 0, loading: true,
    newWord: '', searchKeyword: '',
    showBatch: false, batchText: '', isAndroid: false
  },
  onLoad: function () { this.setData({ isAndroid: wx.getSystemInfoSync().platform === 'android' }); this.loadWords(); },
  loadWords: async function (page) {
    var that = this; page = page || 1; that.setData({ loading: true });
    try {
      var res = await wx.cloud.callFunction({ name: 'manageBannedWords', data: { action: 'list', page: page, pageSize: 50 } });
      if (res.result) that.setData({ words: res.result.list || [], total: res.result.total || 0, page: page, loading: false });
      else that.setData({ loading: false });
    } catch (err) { that.setData({ loading: false }); }
  },
  onAddWord: async function () {
    var that = this, word = (that.data.newWord || '').trim();
    if (!word) { wx.showToast({ title: '请输入敏感词', icon: 'none' }); return; }
    wx.showLoading({ title: '添加中...' });
    try {
      var res = await wx.cloud.callFunction({ name: 'manageBannedWords', data: { action: 'add', word: word } });
      wx.hideLoading();
      if (res.result && res.result.success) { wx.showToast({ title: '已添加', icon: 'success' }); that.setData({ newWord: '' }); that.loadWords(); }
      else wx.showToast({ title: (res.result && res.result.error) || '添加失败', icon: 'none' });
    } catch (err) { wx.hideLoading(); wx.showToast({ title: '添加失败', icon: 'none' }); }
  },
  onWordInput: function (e) { this.setData({ newWord: e.detail.value }); },
  onSearchInput: function (e) { this.setData({ searchKeyword: e.detail.value }); },
  onSearch: async function () {
    var that = this, kw = (that.data.searchKeyword || '').trim();
    if (!kw) { that.loadWords(); return; }
    that.setData({ loading: true });
    try {
      var res = await wx.cloud.callFunction({ name: 'manageBannedWords', data: { action: 'search', keyword: kw } });
      if (res.result) that.setData({ words: res.result.list || [], total: res.result.total || 0, loading: false });
    } catch (err) { that.setData({ loading: false }); }
  },
  onRemoveWord: function (e) {
    var that = this, wordId = e.currentTarget.dataset.id, word = e.currentTarget.dataset.word;
    wx.showModal({ title: '禁用', content: '确定禁用"' + word + '"？', confirmText: '禁用', confirmColor: '#FF9800',
      success: async function (r) { if (r.confirm) {
        try { await wx.cloud.callFunction({ name: 'manageBannedWords', data: { action: 'remove', wordId: wordId } }); that.loadWords(); } catch (err) {}
      }}
    });
  },
  onDeleteWord: function (e) {
    var that = this, wordId = e.currentTarget.dataset.id, word = e.currentTarget.dataset.word;
    wx.showModal({ title: '删除', content: '永久删除"' + word + '"？', confirmText: '删除', confirmColor: '#E53935',
      success: async function (r) { if (r.confirm) {
        try { await wx.cloud.callFunction({ name: 'manageBannedWords', data: { action: 'delete', wordId: wordId } }); that.loadWords(); } catch (err) {}
      }}
    });
  },
  onToggleBatch: function () { this.setData({ showBatch: !this.data.showBatch, batchText: '' }); },
  onBatchInput: function (e) { this.setData({ batchText: e.detail.value }); },
  onBatchSubmit: async function () {
    var that = this, text = (that.data.batchText || '').trim();
    if (!text) return;
    var words = text.split(/[\n,，\s]+/).filter(function (w) { return w.trim(); });
    if (!words.length) { wx.showToast({ title: '未检测到有效词汇', icon: 'none' }); return; }
    wx.showLoading({ title: '导入中...' });
    try {
      var res = await wx.cloud.callFunction({ name: 'manageBannedWords', data: { action: 'batchAdd', words: words } });
      wx.hideLoading();
      if (res.result && res.result.success) {
        wx.showModal({ title: '导入完成', content: '成功:' + res.result.added + ' 跳过:' + res.result.skipped, showCancel: false,
          success: function () { that.setData({ showBatch: false, batchText: '' }); that.loadWords(); } });
      }
    } catch (err) { wx.hideLoading(); wx.showToast({ title: '导入失败', icon: 'none' }); }
  },

  onNavBack: function () {
    wx.navigateBack();
  }
});
