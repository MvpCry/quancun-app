// pages/admin/routes/edit.js - 路线新增/编辑（封面图从已选景点中选取）
Page({
  data: {
    isEdit: false, id: '', saving: false,
    isAndroid: false,
    backIcon: '<',
    form: { name: '', description: '', coverImage: '', estimatedTime: 0, tags: {}, selectedAttractions: [] },
    selectedNames: [],           // 与 selectedAttractions 对应的名称数组
    allAttractions: [],          // 全部可选景点（含 images 数组）
    attractionImages: [],        // 已选景点的所有图片 [{url, name}]
    isCustomCover: false,        // 用户是否手动选了封面（非自动）
    timeOptions: [
      { label: '1小时', value: 1 }, { label: '2小时', value: 2 },
      { label: '3小时', value: 3 }, { label: '4小时', value: 4 },
      { label: '5小时', value: 5 }, { label: '6小时', value: 6 },
      { label: '7小时', value: 7 }, { label: '8小时', value: 8 },
      { label: '1天', value: 24 }, { label: '2天', value: 48 },
      { label: '3天', value: 72 }
    ],
    timeIndex: -1,               // picker 当前选中索引
    tagOptions: [
      { key: '一日游', label: '一日游' }, { key: '两日游', label: '两日游' },
      { key: '乡村游', label: '乡村游' }, { key: '亲子游', label: '亲子游' },
      { key: '红色旅游', label: '红色旅游' }, { key: '文化旅游', label: '文化旅游' }
    ]
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

  // ==========================================
  //  加载全部景点
  // ==========================================
  loadAllAttractions: async function () {
    var that = this;
    try {
      var res = await wx.cloud.callFunction({ name: 'adminRoutes', data: { action: 'listAttractions' } });
      if (res.result && res.result.list) {
        that.setData({ allAttractions: res.result.list });
        that.onAttractionsReady();
      }
    } catch (err) {
      try {
        var res2 = await wx.cloud.callFunction({ name: 'getAttractions', data: { action: 'list', pageSize: 200 } });
        if (res2.result && res2.result.list) {
          that.setData({ allAttractions: res2.result.list });
          that.onAttractionsReady();
        }
      } catch (e) { console.error('加载景点列表失败:', e); }
    }
  },

  onAttractionsReady: function () {
    // 景点数据到达后，刷新名称（修复编辑回显时名字显示ID的乱码问题）
    this.syncSelectedNames();
    if (this.data.isEdit && !this.data.isCustomCover) {
      this.detectCustomCover(this.data.form.coverImage);
    }
    this.updateCover();
  },

  // ==========================================
  //  加载已有路线
  // ==========================================
  loadRoute: async function (id) {
    var that = this;
    try {
      var res = await wx.cloud.callFunction({ name: 'adminRoutes', data: { action: 'getById', data: { id: id } } });
      if (res.result && res.result.route) {
        var r = res.result.route;
        var tagsMap = {};
        (r.tags || []).forEach(function (t) { tagsMap[t] = true; });
        var selectedIds = [];
        (r.attractions || []).forEach(function (a) {
          selectedIds.push(a.attractionId || a._id || a);
        });

        // 回显时间
        var timeIdx = -1;
        if (r.estimatedTime > 0) {
          for (var ti = 0; ti < that.data.timeOptions.length; ti++) {
            if (that.data.timeOptions[ti].value === r.estimatedTime) { timeIdx = ti; break; }
          }
        }

        that.setData({
          form: {
            name: r.name || '', description: r.description || '',
            coverImage: r.coverImage || '', estimatedTime: r.estimatedTime || 0,
            tags: tagsMap, selectedAttractions: selectedIds
          },
          timeIndex: timeIdx
        });
        that.syncSelectedNames();

        if (r.isCustomCover === true) {
          that.setData({ isCustomCover: true });
        } else if (that.data.allAttractions.length > 0) {
          that.detectCustomCover(r.coverImage);
        }
      }
    } catch (err) { console.error('加载路线失败:', err); }
  },

  detectCustomCover: function (existingCover) {
    if (!existingCover) return;
    var autoCover = this.computeAutoCover();
    if (!autoCover) return;
    this.setData({ isCustomCover: existingCover !== autoCover });
  },

  // ==========================================
  //  表单输入 / 标签
  // ==========================================
  onInput: function (e) {
    var field = e.currentTarget.dataset.field;
    this.setData({ ['form.' + field]: e.detail.value });
  },

  // ==========================================
  //  游玩时间选择
  // ==========================================
  onTimeChange: function (e) {
    var idx = parseInt(e.detail.value);
    var opt = this.data.timeOptions[idx];
    this.setData({
      timeIndex: idx,
      'form.estimatedTime': opt ? opt.value : 0
    });
  },

  onTagToggle: function (e) {
    var key = e.currentTarget.dataset.key;
    var tags = this.data.form.tags;
    tags[key] = !tags[key];
    this.setData({ 'form.tags': tags });
  },

  // ==========================================
  //  同步已选景点名称 + 可选图片 + 触发封面联动
  // ==========================================
  syncSelectedNames: function () {
    var that = this;
    var selected = that.data.form.selectedAttractions;
    var all = that.data.allAttractions;
    var names = [];
    var images = [];

    selected.forEach(function (id) {
      for (var i = 0; i < all.length; i++) {
        if (all[i]._id === id) {
          names.push(all[i].name);
          if (all[i].images && all[i].images.length > 0) {
            all[i].images.forEach(function (url) {
              images.push({ url: url, name: all[i].name });
            });
          }
          return;
        }
      }
      // 没在列表里找到 → 用 ID 占位
      if (names.length < selected.length) names.push(id);
    });

    that.setData({ selectedNames: names, attractionImages: images });
    that.updateCover();
  },

  // ==========================================
  //  封面自动联动
  //  自动规则：第一个有图的景点的第一张图
  //  手动选择后 isCustomCover=true，不再自动更新
  // ==========================================
  updateCover: function () {
    var that = this;
    if (that.data.isCustomCover) return;
    if (that.data.allAttractions.length === 0) return;

    var autoCover = that.computeAutoCover();
    if (autoCover !== that.data.form.coverImage) {
      that.setData({ 'form.coverImage': autoCover });
    }
  },

  // 计算自动封面
  computeAutoCover: function () {
    var selected = this.data.form.selectedAttractions;
    var all = this.data.allAttractions;
    for (var i = 0; i < selected.length; i++) {
      for (var j = 0; j < all.length; j++) {
        if (all[j]._id === selected[i]) {
          if (all[j].images && all[j].images.length > 0) {
            return all[j].images[0];
          }
          break;
        }
      }
    }
    return '';
  },

  // ==========================================
  //  从景点图片中点选封面（标记为自定义）
  // ==========================================
  onPickAttractionImage: function (e) {
    var url = e.currentTarget.dataset.url;
    this.setData({
      'form.coverImage': url,
      isCustomCover: true
    });
  },

  // ==========================================
  //  景点勾选/取消
  // ==========================================
  onAttractionToggle: function (e) {
    var id = e.currentTarget.dataset.id;
    var selected = this.data.form.selectedAttractions.slice();
    var idx = selected.indexOf(id);
    if (idx >= 0) {
      selected.splice(idx, 1);
    } else {
      selected.push(id);
    }
    this.setData({ 'form.selectedAttractions': selected });
    this.syncSelectedNames();
  },

  // ==========================================
  //  上移景点
  // ==========================================
  onMoveUp: function (e) {
    var idx = e.currentTarget.dataset.index;
    var selected = this.data.form.selectedAttractions.slice();
    if (idx > 0) {
      var tmp = selected[idx];
      selected[idx] = selected[idx - 1];
      selected[idx - 1] = tmp;
      this.setData({ 'form.selectedAttractions': selected });
      this.syncSelectedNames();
    }
  },

  // ==========================================
  //  恢复默认封面
  // ==========================================
  onResetCover: function () {
    this.setData({ isCustomCover: false });
    this.updateCover();
  },

  // ==========================================
  //  提交
  // ==========================================
  onSubmit: async function () {
    var that = this;
    var f = that.data.form;

    if (!f.name.trim()) { wx.showToast({ title: '请输入路线名称', icon: 'none' }); return; }
    if (f.selectedAttractions.length < 2) { wx.showToast({ title: '请至少勾选2个景点', icon: 'none' }); return; }

    that.setData({ saving: true });

    var tags = [];
    Object.keys(f.tags).forEach(function (k) {
      if (f.tags[k]) tags.push(k);
    });

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
      estimatedTime: f.estimatedTime || 0,
      tags: tags,
      attractions: attractions,
      isCustomCover: that.data.isCustomCover
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
