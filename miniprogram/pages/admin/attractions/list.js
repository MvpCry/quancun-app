// pages/admin/attractions/list.js - 省→市→区/县 三级树形（结构化字段 + 批量修正）
var REGION = {
  province: '山东省',
  city: '泰安市',
  districts: ['泰山区', '岱岳区', '东平县', '新泰市', '肥城市']
};

Page({
  data: {
    provinceTree: [],        // [{ province, count, expanded, cities: [...] }]
    currentPath: [],         // 面包屑: [{level, name}]
    filteredAttractions: [], // 当前景点列表
    allAttractions: [],
    loading: true,
    keyword: '',

    isAndroid: false,
    backIcon: '<',
    // 批量修正
    batchMode: false,
    selectedIds: [],
    showBatchModal: false,
    batchDistrict: '',
    batchTown: '',
    batchVillage: '',
    batchDistricts: REGION.districts,
    batchDistrictIndex: -1
  },

  onShow: function () {
    this.setData({ isAndroid: wx.getSystemInfoSync().platform === 'android' });
    if (this._loaded) { this.loadSilent(); } else { this.loadAttractions(); }
  },

  loadAttractions: async function () {
    var that = this; that.setData({ loading: true });
    try {
      var res = await wx.cloud.callFunction({ name: 'adminAttractions', data: { action: 'list', data: { page: 1, pageSize: 200 } } });
      if (res.result && res.result.list) { that._loaded = true; that.buildTree(res.result.list); that.setData({ loading: false }); }
      else { that.setData({ loading: false }); }
    } catch (err) { that.setData({ loading: false }); }
  },

  loadSilent: async function () {
    var that = this;
    try {
      var res = await wx.cloud.callFunction({ name: 'adminAttractions', data: { action: 'list', data: { page: 1, pageSize: 200 } } });
      if (res.result && res.result.list) { that.buildTree(res.result.list); }
    } catch (err) {}
  },

  // ========== 结构化字段 → 区县归类 ==========

  getDisplayDistrict: function (a) {
    // 优先用结构化字段
    var d = a.district;
    if (d && REGION.districts.indexOf(d) >= 0) return d;
    // 回退：从 address 字符串正则匹配
    if (a.address) {
      for (var k = 0; k < REGION.districts.length; k++) {
        if (a.address.indexOf(REGION.districts[k]) >= 0) return REGION.districts[k];
      }
    }
    return '未知';
  },

  // ========== 构建三级树（结构化字段，固定排序） ==========
  buildTree: function (attractions) {
    var that = this;

    // Step 1: 归类
    for (var i = 0; i < attractions.length; i++) {
      attractions[i]._province = attractions[i].province || REGION.province;
      attractions[i]._city = attractions[i].city || REGION.city;
      attractions[i]._district = that.getDisplayDistrict(attractions[i]);
    }

    // Step 2: 按区县分组
    var districtMap = {};
    for (var j = 0; j < attractions.length; j++) {
      var a = attractions[j];
      var d = a._district;
      if (!districtMap[d]) districtMap[d] = [];
      districtMap[d].push(a);
    }

    // Step 3: 构建树（省→市→区县，区县按固定顺序，未知末位）
    var totalCount = attractions.length;

    // 计算归属泰安市的数量（排除未知）
    var taiAnCount = 0;
    for (var di = 0; di < REGION.districts.length; di++) {
      taiAnCount += (districtMap[REGION.districts[di]] || []).length;
    }

    var districts = [];
    for (var dk = 0; dk < REGION.districts.length; dk++) {
      var dn = REGION.districts[dk];
      var list = districtMap[dn] || [];
      districts.push({ district: dn, count: list.length, attractions: list });
    }

    // 未知
    var unknownList = districtMap['未知'] || [];
    if (unknownList.length > 0) {
      districts.push({ district: '未知', count: unknownList.length, attractions: unknownList });
    }

    var provinceTree = [{
      province: REGION.province,
      count: totalCount,
      expanded: true,
      cities: [{
        city: REGION.city,
        count: taiAnCount + unknownList.length,
        expanded: true,
        districts: districts
      }]
    }];

    // Step 4: 恢复选区
    var cp = that.data.currentPath || [];
    var selDist = cp.length >= 3 ? cp[2].name : '';
    var filtered = [];
    if (selDist && districtMap[selDist]) {
      filtered = districtMap[selDist];
    }

    that.setData({
      provinceTree: provinceTree,
      allAttractions: attractions,
      filteredAttractions: filtered,
      currentPath: filtered.length > 0 ? cp : [],
      // 保留批量状态
      batchMode: that.data.batchMode,
      selectedIds: that.data.batchMode ? that.data.selectedIds : []
    });
  },

  // ========== 展开/折叠 ==========

  onToggleProvince: function (e) {
    var name = e.currentTarget.dataset.name;
    var tree = this.data.provinceTree;
    for (var i = 0; i < tree.length; i++) {
      if (tree[i].province === name) { tree[i].expanded = !tree[i].expanded; break; }
    }
    this.setData({ provinceTree: tree });
  },

  onToggleCity: function (e) {
    var pName = e.currentTarget.dataset.province;
    var cName = e.currentTarget.dataset.city;
    var tree = this.data.provinceTree;
    for (var i = 0; i < tree.length; i++) {
      if (tree[i].province === pName) {
        for (var j = 0; j < tree[i].cities.length; j++) {
          if (tree[i].cities[j].city === cName) {
            tree[i].cities[j].expanded = !tree[i].cities[j].expanded;
            break;
          }
        }
        break;
      }
    }
    this.setData({ provinceTree: tree });
  },

  onSelectDistrict: function (e) {
    var province = e.currentTarget.dataset.province;
    var city = e.currentTarget.dataset.city;
    var district = e.currentTarget.dataset.district;
    var tree = this.data.provinceTree;
    var filtered = [];
    for (var i = 0; i < tree.length; i++) {
      if (tree[i].province === province) {
        for (var j = 0; j < tree[i].cities.length; j++) {
          if (tree[i].cities[j].city === city) {
            for (var k = 0; k < tree[i].cities[j].districts.length; k++) {
              if (tree[i].cities[j].districts[k].district === district) {
                filtered = tree[i].cities[j].districts[k].attractions;
                break;
              }
            }
            break;
          }
        }
        break;
      }
    }
    this.setData({
      currentPath: [{ level: 'province', name: province }, { level: 'city', name: city }, { level: 'district', name: district }],
      filteredAttractions: filtered,
      keyword: ''
    });
  },

  onClearPath: function (e) {
    var index = Number(e.currentTarget.dataset.index);
    var cp = this.data.currentPath;
    if (index < 0) {
      this.setData({ currentPath: [], filteredAttractions: [], keyword: '' });
      return;
    }
    var newPath = cp.slice(0, index + 1);
    var tree = this.data.provinceTree;

    if (newPath.length >= 3) {
      this.onSelectDistrict({
        currentTarget: {
          dataset: { province: newPath[0].name, city: newPath[1].name, district: newPath[2].name }
        }
      });
      return;
    }

    this.setData({ currentPath: newPath, filteredAttractions: [], keyword: '' });

    // 确保路径中的节点展开
    if (newPath.length >= 1) {
      for (var i = 0; i < tree.length; i++) {
        if (tree[i].province === newPath[0].name) { tree[i].expanded = true; }
        if (newPath.length >= 2) {
          for (var j = 0; j < tree[i].cities.length; j++) {
            if (tree[i].cities[j].city === newPath[1].name) { tree[i].cities[j].expanded = true; }
          }
        }
      }
      this.setData({ provinceTree: tree });
    }
  },

  // ========== 搜索 ==========

  onSearchInput: function (e) {
    var kw = (e.detail.value || '').trim().toLowerCase();
    this.setData({ keyword: kw });
    if (!kw) {
      if (this.data.currentPath.length >= 3) {
        var cp2 = this.data.currentPath;
        this.onSelectDistrict({ currentTarget: { dataset: { province: cp2[0].name, city: cp2[1].name, district: cp2[2].name } } });
      }
      return;
    }
    var all = this.data.allAttractions;
    var results = all.filter(function (a) {
      return (a.name || '').toLowerCase().indexOf(kw) >= 0 ||
             (a.address || '').toLowerCase().indexOf(kw) >= 0 ||
             (a._province || '').toLowerCase().indexOf(kw) >= 0 ||
             (a._city || '').toLowerCase().indexOf(kw) >= 0 ||
             (a._district || '').toLowerCase().indexOf(kw) >= 0 ||
             (a.district || '').toLowerCase().indexOf(kw) >= 0 ||
             (a.town || '').toLowerCase().indexOf(kw) >= 0 ||
             (a.village || '').toLowerCase().indexOf(kw) >= 0;
    });
    this.setData({ filteredAttractions: results, currentPath: [] });
  },

  onSearch: function () {
    this.onSearchInput({ detail: { value: this.data.keyword } });
  },

  // ========== 批量修正区域 ==========

  onToggleBatchMode: function () {
    var newMode = !this.data.batchMode;
    this.setData({
      batchMode: newMode,
      selectedIds: newMode ? [] : this.data.selectedIds
    });
  },

  onToggleSelect: function (e) {
    var id = e.currentTarget.dataset.id;
    var selected = this.data.selectedIds.slice();
    var idx = selected.indexOf(id);
    if (idx >= 0) {
      selected.splice(idx, 1);
    } else {
      selected.push(id);
    }
    this.setData({ selectedIds: selected });
  },

  onToggleSelectAll: function () {
    var that = this;
    if (that.data.selectedIds.length === that.data.filteredAttractions.length) {
      that.setData({ selectedIds: [] });
    } else {
      var ids = that.data.filteredAttractions.map(function (a) { return a._id; });
      that.setData({ selectedIds: ids });
    }
  },

  onOpenBatchModal: function () {
    if (this.data.selectedIds.length === 0) {
      wx.showToast({ title: '请先选择景点', icon: 'none' });
      return;
    }
    this.setData({ showBatchModal: true, batchDistrict: '', batchTown: '', batchVillage: '', batchDistrictIndex: -1 });
  },

  onCloseBatchModal: function () {
    this.setData({ showBatchModal: false });
  },

  onBatchDistrictChange: function (e) {
    var idx = Number(e.detail.value);
    this.setData({
      batchDistrict: this.data.batchDistricts[idx] || '',
      batchDistrictIndex: idx
    });
  },

  onBatchTownInput: function (e) {
    this.setData({ batchTown: e.detail.value });
  },

  onBatchVillageInput: function (e) {
    this.setData({ batchVillage: e.detail.value });
  },

  onConfirmBatchUpdate: async function () {
    var that = this;
    if (!that.data.batchDistrict) {
      wx.showToast({ title: '请选择区/县', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '批量更新中...' });
    try {
      var res = await wx.cloud.callFunction({
        name: 'adminAttractions',
        data: {
          action: 'batchUpdateRegion',
          data: {
            ids: that.data.selectedIds,
            province: REGION.province,
            city: REGION.city,
            district: that.data.batchDistrict,
            town: that.data.batchTown || '',
            village: that.data.batchVillage || ''
          }
        }
      });

      wx.hideLoading();

      if (res.result && res.result.success) {
        var msg = '已更新 ' + res.result.updated + ' 个景点';
        if (res.result.errors && res.result.errors.length > 0) {
          msg += '，' + res.result.errors.length + ' 个失败';
        }
        wx.showToast({ title: msg, icon: 'success' });
        that.setData({ showBatchModal: false, batchMode: false, selectedIds: [] });
        getApp().refreshCache('attractions');
        that.loadAttractions();
      } else {
        wx.showToast({ title: (res.result && res.result.error) || '更新失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('批量更新失败:', err);
      wx.showToast({ title: '更新失败，请重试', icon: 'none' });
    }
  },

  // ========== 操作 ==========

  onAdd: function () { wx.navigateTo({ url: '/pages/admin/attractions/edit' }); },

  onEdit: function (e) {
    wx.navigateTo({ url: '/pages/admin/attractions/edit?id=' + e.currentTarget.dataset.id });
  },

  onToggleFeatured: function (e) {
    var that = this;
    var id = e.currentTarget.dataset.id;
    var name = e.currentTarget.dataset.name;
    var current = e.currentTarget.dataset.featured;
    wx.showModal({
      title: current ? '下架精选' : '上架精选',
      content: '确定将「' + name + '」' + (current ? '从首页精选移除' : '展示在首页精选') + '？',
      confirmText: current ? '下架' : '上架',
      confirmColor: current ? '#E53935' : '#2E7D32',
      success: async function (r) {
        if (!r.confirm) return;
        wx.showLoading({ title: '处理中...', mask: false });
        try {
          var res = await wx.cloud.callFunction({ name: 'adminAttractions', data: { action: 'toggleFeatured', id: id } });
          wx.hideLoading();
          if (res.result && res.result.success) {
            var all = that.data.allAttractions.map(function (item) {
              if (item._id === id) item.featured = res.result.featured;
              return item;
            });
            that.buildTree(all);
            // 同步更新当前展示列表
            var filtered = that.data.filteredAttractions.map(function (item) {
              if (item._id === id) item.featured = res.result.featured;
              return item;
            });
            that.setData({ filteredAttractions: filtered });
            wx.showToast({ title: res.result.featured ? '已上架精选' : '已下架精选', icon: 'success' });
            getApp().refreshCache('attractions');
          }
        } catch (err) { wx.hideLoading(); wx.showToast({ title: '操作失败', icon: 'none' }); }
      }
    });
  },

  onDelete: function (e) {
    var that = this;
    var id = e.currentTarget.dataset.id;
    var name = e.currentTarget.dataset.name;
    wx.showModal({
      title: '删除景点', content: '确定删除「' + name + '」？此操作不可撤销。',
      confirmText: '删除', confirmColor: '#E53935',
      success: async function (r) {
        if (!r.confirm) return;
        wx.showLoading({ title: '删除中...', mask: false });
        try {
          await wx.cloud.callFunction({ name: 'adminAttractions', data: { action: 'delete', data: { id: id } } });
          wx.hideLoading();
          var all = that.data.allAttractions.filter(function (item) { return item._id !== id; });
          var filtered = that.data.filteredAttractions.filter(function (item) { return item._id !== id; });
          that.buildTree(all);
          that.setData({ filteredAttractions: filtered });
          wx.showToast({ title: '已删除', icon: 'success' });
          getApp().refreshCache('attractions');
        } catch (err) { wx.hideLoading(); wx.showToast({ title: '操作失败', icon: 'none' }); }
      }
    });
  },

  onNavBack: function () {
    wx.navigateBack();
  }
});
