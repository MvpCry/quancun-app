// pages/admin/attractions/list.js - 三级树形：省 → 市 → 区/县/县级市
Page({
  data: {
    provinceTree: [],        // [{ province, count, expanded, cities: [...] }]
    currentPath: [],         // 面包屑: [{level, name}]
    filteredAttractions: [], // 当前景点列表
    allAttractions: [],
    loading: true,
    keyword: ''
  },

  onShow: function () {
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

  // ========== 地址解析（省 / 地级市 / 区县） ==========
  parseAddress: function (address) {
    if (!address) return { province: '未知', city: '未知', district: '未知' };
    // 省: XX省
    var pMatch = address.match(/^([一-龥]{2,6}[省])/);
    var province = pMatch ? pMatch[1] : '未知';
    // 地级市: 省后面第一个 XX市
    var rest = address.replace(/^[一-龥]+省/, '');
    var cMatch = rest.match(/^([一-龥]{2,8}市)/);
    var city = cMatch ? cMatch[1] : '未知';
    // 区/县/县级市: 地级市后面
    var afterCity = rest.replace(/^[一-龥]+市/, '');
    var dMatch = afterCity.match(/^([一-龥]{2,8}[区县市])/);
    var district = dMatch ? dMatch[1] : '未知';
    return { province: province, city: city, district: district };
  },

  // ========== 构建三级树 ==========
  buildTree: function (attractions) {
    var that = this;
    // 解析地址
    for (var i = 0; i < attractions.length; i++) {
      var parsed = that.parseAddress(attractions[i].address);
      attractions[i]._province = parsed.province;
      attractions[i]._city = parsed.city;
      attractions[i]._district = parsed.district;
    }

    var provinceMap = {};
    for (var j = 0; j < attractions.length; j++) {
      var a = attractions[j];
      if (!provinceMap[a._province]) provinceMap[a._province] = {};
      if (!provinceMap[a._province][a._city]) provinceMap[a._province][a._city] = {};
      if (!provinceMap[a._province][a._city][a._district]) provinceMap[a._province][a._city][a._district] = [];
      provinceMap[a._province][a._city][a._district].push(a);
    }

    // 保留展开状态
    var oldTree = that.data.provinceTree || [];
    var getOldExpanded = function (tree, key) {
      for (var t = 0; t < tree.length; t++) {
        if (tree[t][key] === tree[t][key]) { /* no-op */ }
        // Simple: just check the name
      }
    };
    // 用 map 记录旧展开
    var oldProvExp = {};
    var oldCityExp = {};
    for (var op = 0; op < oldTree.length; op++) {
      oldProvExp[oldTree[op].province] = oldTree[op].expanded;
      var ocities = oldTree[op].cities || [];
      for (var oc = 0; oc < ocities.length; oc++) {
        oldCityExp[ocities[oc].city] = ocities[oc].expanded;
      }
    }

    // 保留路径和选区
    var cp = that.data.currentPath || [];
    var selProv = cp.length >= 1 ? cp[0].name : '';
    var selCity = cp.length >= 2 ? cp[1].name : '';
    var selDist = cp.length >= 3 ? cp[2].name : '';

    var provinces = Object.keys(provinceMap).sort();
    var provinceTree = [];
    for (var pi = 0; pi < provinces.length; pi++) {
      var provName = provinces[pi];
      var cities = Object.keys(provinceMap[provName]).sort();
      var cityList = [];
      var provTotal = 0;
      for (var ci = 0; ci < cities.length; ci++) {
        var cityName = cities[ci];
        var districts = Object.keys(provinceMap[provName][cityName]).sort();
        var districtList = [];
        var cityTotal = 0;
        for (var di = 0; di < districts.length; di++) {
          var distName = districts[di];
          var list = provinceMap[provName][cityName][distName];
          cityTotal += list.length;
          districtList.push({ district: distName, count: list.length, attractions: list });
        }
        provTotal += cityTotal;
        var cityExpanded = oldCityExp[cityName] !== undefined ? oldCityExp[cityName] : false;
        cityList.push({ city: cityName, count: cityTotal, expanded: cityExpanded, districts: districtList });
      }
      var provExpanded = oldProvExp[provName] !== undefined ? oldProvExp[provName] : (provinces.length <= 1);
      provinceTree.push({ province: provName, count: provTotal, expanded: provExpanded, cities: cityList });
    }

    // 显示对应景点
    var filtered = [];
    if (selDist) {
      for (var p2 = 0; p2 < provinceTree.length; p2++) {
        if (provinceTree[p2].province === selProv) {
          for (var c2 = 0; c2 < provinceTree[p2].cities.length; c2++) {
            if (provinceTree[p2].cities[c2].city === selCity) {
              for (var d2 = 0; d2 < provinceTree[p2].cities[c2].districts.length; d2++) {
                if (provinceTree[p2].cities[c2].districts[d2].district === selDist) {
                  filtered = provinceTree[p2].cities[c2].districts[d2].attractions;
                  break;
                }
              }
              break;
            }
          }
          break;
        }
      }
    }

    that.setData({
      provinceTree: provinceTree,
      allAttractions: attractions,
      filteredAttractions: filtered,
      currentPath: cp
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
      // 全部景点
      this.setData({ currentPath: [], filteredAttractions: [], keyword: '' });
      return;
    }
    var newPath = cp.slice(0, index + 1);
    var tree = this.data.provinceTree;
    var filtered = [];
    if (newPath.length >= 3) {
      // 重新选中区
      this.onSelectDistrict({
        currentTarget: {
          dataset: { province: newPath[0].name, city: newPath[1].name, district: newPath[2].name }
        }
      });
      return;
    }
    // 如果只选了省或市，不显示景点
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
      // 恢复选区
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
             (a._city || '').toLowerCase().indexOf(kw) >= 0 ||
             (a._district || '').toLowerCase().indexOf(kw) >= 0;
    });
    this.setData({ filteredAttractions: results, currentPath: [] });
  },

  onSearch: function () {
    this.onSearchInput({ detail: { value: this.data.keyword } });
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
            var list = that.data.filteredAttractions.map(function (item) {
              if (item._id === id) item.featured = res.result.featured;
              return item;
            });
            var all = that.data.allAttractions.map(function (item) {
              if (item._id === id) item.featured = res.result.featured;
              return item;
            });
            that.buildTree(all);
            if (list.length > 0) that.setData({ filteredAttractions: list });
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
          var list = that.data.filteredAttractions.filter(function (item) { return item._id !== id; });
          var all = that.data.allAttractions.filter(function (item) { return item._id !== id; });
          that.buildTree(all);
          that.setData({ filteredAttractions: list });
          wx.showToast({ title: '已删除', icon: 'success' });
          getApp().refreshCache('attractions');
        } catch (err) { wx.hideLoading(); wx.showToast({ title: '操作失败', icon: 'none' }); }
      }
    });
  }
});
