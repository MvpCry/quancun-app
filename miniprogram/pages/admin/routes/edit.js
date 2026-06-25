// pages/admin/routes/edit.js - 路线新增/编辑（景点多选编排）
Page({
  data: {
    isEdit: false, id: '', saving: false,
    isAndroid: false,
    backIcon: '<',
    form: { name: '', description: '', coverImage: '', tags: {}, selectedAttractions: [] },
    selectedNames: [],        // 与 selectedAttractions 对应的名称数组
    allAttractions: [],       // 全部可选的景点
    tagOptions: [
      { key: '一日游', label: '一日游' }, { key: '两日游', label: '两日游' },
      { key: '乡村游', label: '乡村游' }, { key: '亲子游', label: '亲子游' },
      { key: '红色旅游', label: '红色旅游' }, { key: '文化旅游', label: '文化旅游' }
    ],
    uploading: false
  },

  onLoad: function (options) {
    this.setData({ isAndroid: wx.getSystemInfoSync().platform === 'android' });
    this.loadAllAttractions();
    if (options && options.id) {
      this.setData({ isEdit: true, id: options.id });
      wx.setNavigationBarTitle({ title: '编辑路线' });
      this.loadRoute(options.id);
    } else {
      wx.setNavigationBarTitle({ title: '新增路线' });
    }
  },

  // 加载全部景点（供多选）
  loadAllAttractions: async function () {
    var that = this;
    try {
      var res = await wx.cloud.callFunction({ name: 'adminRoutes', data: { action: 'listAttractions' } });
      if (res.result && res.result.list) {
        that.setData({ allAttractions: res.result.list });
      }
    } catch (err) {
      // 降级：尝试从 getAttractions 获取
      try {
        var res2 = await wx.cloud.callFunction({ name: 'getAttractions', data: { action: 'list', pageSize: 200 } });
        if (res2.result && res2.result.list) {
          that.setData({ allAttractions: res2.result.list });
        }
      } catch (e) { console.error('加载景点列表失败:', e); }
    }
  },

  // 加载已有路线
  loadRoute: async function (id) {
    var that = this;
    try {
      var res = await wx.cloud.callFunction({ name: 'adminRoutes', data: { action: 'getById', data: { id: id } } });
      if (res.result && res.result.route) {
        var r = res.result.route;
        // 将 tags 数组 → {key:true} 映射
        var tagsMap = {};
        (r.tags || []).forEach(function (t) { tagsMap[t] = true; });
        // 标记已选景点
        var selectedIds = [];
        (r.attractions || []).forEach(function (a) {
          selectedIds.push(a.attractionId || a._id || a);
        });

        that.setData({
          form: {
            name: r.name || '', description: r.description || '',
            coverImage: r.coverImage || '', tags: tagsMap,
            selectedAttractions: selectedIds
          }
        });
        that.syncSelectedNames();
      }
    } catch (err) { console.error('加载路线失败:', err); }
  },

  // 表单输入
  onInput: function (e) {
    var f = e.currentTarget.dataset.field;
    var form = this.data.form;
    form[f] = e.detail.value;
    this.setData({ form: form });
  },

  // 标签多选
  onTagToggle: function (e) {
    var key = e.currentTarget.dataset.key;
    var form = this.data.form;
    form.tags[key] = !form.tags[key];
    this.setData({ form: form });
  },

  // 同步 selectedNames 数组
  syncSelectedNames: function () {
    var that = this;
    var selected = that.data.form.selectedAttractions;
    var all = that.data.allAttractions;
    var names = selected.map(function (id) {
      for (var i = 0; i < all.length; i++) { if (all[i]._id === id) return all[i].name; }
      return id;
    });
    that.setData({ selectedNames: names });
  },

  // 景点勾选/取消（保持勾选顺序 = 游玩顺序）
  onAttractionToggle: function (e) {
    var id = e.currentTarget.dataset.id;
    var form = this.data.form;
    var selected = form.selectedAttractions.slice();
    var idx = selected.indexOf(id);
    if (idx >= 0) {
      selected.splice(idx, 1);
    } else {
      selected.push(id);
    }
    form.selectedAttractions = selected;
    this.setData({ form: form });
    this.syncSelectedNames();
  },

  // 上移景点
  onMoveUp: function (e) {
    var idx = e.currentTarget.dataset.index;
    var form = this.data.form;
    var selected = form.selectedAttractions.slice();
    if (idx > 0) {
      var tmp = selected[idx];
      selected[idx] = selected[idx - 1];
      selected[idx - 1] = tmp;
      form.selectedAttractions = selected;
      this.setData({ form: form });
      this.syncSelectedNames();
    }
  },

  // 上传封面图
  onChooseCover: function () {
    var that = this;
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sizeType: ['compressed'],
      success: function (res) {
        that.setData({ uploading: true });
        wx.cloud.uploadFile({
          cloudPath: 'routes/' + Date.now() + '.jpg',
          filePath: res.tempFiles[0].tempFilePath,
          success: function (r) {
            var form = that.data.form;
            form.coverImage = r.fileID;
            that.setData({ form: form, uploading: false });
            wx.showToast({ title: '上传成功', icon: 'success' });
          },
          fail: function () {
            that.setData({ uploading: false });
            wx.showToast({ title: '上传失败', icon: 'none' });
          }
        });
      }
    });
  },

  // 获取已选景点的名称（用于显示）
  getSelectedNames: function () {
    var that = this;
    var selected = that.data.form.selectedAttractions;
    var all = that.data.allAttractions;
    return selected.map(function (id) {
      for (var i = 0; i < all.length; i++) {
        if (all[i]._id === id) return all[i].name;
      }
      return id;
    });
  },

  // 提交
  onSubmit: async function () {
    var that = this;
    var f = that.data.form;

    if (!f.name.trim()) { wx.showToast({ title: '请输入路线名称', icon: 'none' }); return; }
    if (f.selectedAttractions.length < 2) { wx.showToast({ title: '请至少勾选2个景点', icon: 'none' }); return; }

    that.setData({ saving: true });

    // 构建 tags 数组
    var tags = [];
    Object.keys(f.tags).forEach(function (k) {
      if (f.tags[k]) tags.push(k);
    });

    // 构建 attractions 数组（保持勾选顺序）
    var attractions = f.selectedAttractions.map(function (id, idx) {
      var name = '';
      var all = that.data.allAttractions;
      for (var i = 0; i < all.length; i++) {
        if (all[i]._id === id) { name = all[i].name; break; }
      }
      return { attractionId: id, order: idx, name: name };
    });

    var data = {
      name: f.name.trim(),
      description: f.description.trim(),
      coverImage: f.coverImage,
      tags: tags,
      attractions: attractions
    };

    try {
      var actionRes;
      if (that.data.isEdit) {
        data.id = that.data.id;
        actionRes = await wx.cloud.callFunction({ name: 'adminRoutes', data: { action: 'update', data: data } });
      } else {
        actionRes = await wx.cloud.callFunction({ name: 'adminRoutes', data: { action: 'create', data: data } });
      }

      if (actionRes.result && actionRes.result.success) {
        getApp().refreshCache('routes');
        wx.showToast({ title: that.data.isEdit ? '已更新' : '已创建，正在计算路线...', icon: 'success' });
        setTimeout(function () { wx.navigateBack(); }, 1500);
      } else {
        that.setData({ saving: false });
        wx.showToast({ title: (actionRes.result && actionRes.result.error) || '保存失败', icon: 'none' });
      }
    } catch (err) {
      that.setData({ saving: false });
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  onNavBack: function () {
    wx.navigateBack();
  }
});
