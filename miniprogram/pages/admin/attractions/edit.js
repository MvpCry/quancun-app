// pages/admin/attractions/edit.js - 景点新增/编辑（腾讯地图搜点，不用手动填坐标）
Page({
  data: {
    isEdit: false, id: '', saving: false,
    form: {
      name: '', address: '', category: 'rural', tags: '',
      openTime: '', ticketPrice: 0, introduction: '',
      images: [], location: null,
      rating: 4.5
    },
    categories: [
      { id: 'rural', name: '乡村' }, { id: 'red', name: '红游' },
      { id: 'family', name: '亲子' }, { id: 'culture', name: '文化' }
    ],
    uploading: false,

    // 地图搜索
    searchKeyword: '',
    searchResults: [],
    searching: false,
    searched: false,
    locationPicked: false  // 是否已通过地图选定位置
  },

  onLoad: function (options) {
    if (options && options.id) {
      this.setData({ isEdit: true, id: options.id });
      wx.setNavigationBarTitle({ title: '编辑景点' });
      this.loadAttraction(options.id);
    } else {
      wx.setNavigationBarTitle({ title: '新增景点' });
    }
  },

  loadAttraction: async function (id) {
    try {
      var res = await wx.cloud.callFunction({ name: 'adminAttractions', data: { action: 'getById', data: { id: id } } });
      if (res.result && res.result.attraction) {
        var a = res.result.attraction;
        var hasLoc = !!(a.location && a.location.latitude);
        this.setData({
          form: {
            name: a.name || '', address: a.address || '',
            category: a.category || 'rural', tags: (a.tags || []).join('、'),
            openTime: a.openTime || '', ticketPrice: a.ticketPrice || 0,
            introduction: a.introduction || '', images: a.images || [],
            location: a.location || null,
            rating: a.rating || 4.5
          },
          locationPicked: hasLoc,
          searchKeyword: a.name || ''
        });
        if (hasLoc) {
          this.setData({ searched: true, searchResults: [{ title: a.name, address: a.address, location: a.location }] });
        }
      }
    } catch (err) { console.error('加载景点失败:', err); }
  },

  // 表单输入
  onInput: function (e) {
    var f = e.currentTarget.dataset.field;
    var form = this.data.form;
    form[f] = e.detail.value;
    this.setData({ form: form });
  },
  onNumInput: function (e) {
    var f = e.currentTarget.dataset.field;
    var form = this.data.form;
    form[f] = Number(e.detail.value) || 0;
    this.setData({ form: form });
  },
  onCatTap: function (e) {
    var form = this.data.form;
    form.category = e.currentTarget.dataset.id;
    this.setData({ form: form });
  },

  // ==================== 腾讯地图位置搜索 ====================
  onSearchInput: function (e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  onSearchPlace: async function () {
    var that = this;
    var keyword = (that.data.searchKeyword || '').trim();
    if (!keyword) { wx.showToast({ title: '请输入村庄名称', icon: 'none' }); return; }

    that.setData({ searching: true, searchResults: [] });

    try {
      var mapService = require('../../../utils/map-service.js');
      var result = await mapService.placeSearch(keyword, '泰安', 1, 20);

      if (result.list && result.list.length > 0) {
        that.setData({
          searchResults: result.list,
          searching: false,
          searched: true
        });
      } else {
        // 泰安没搜到，扩大范围全国搜
        var result2 = await mapService.placeSearch(keyword, '', 1, 20);
        that.setData({
          searchResults: (result2.list || []),
          searching: false,
          searched: true
        });
        if (!result2.list || result2.list.length === 0) {
          wx.showToast({ title: '未找到匹配地点', icon: 'none' });
        }
      }
    } catch (err) {
      console.error('地图搜索失败:', err);
      that.setData({ searching: false });
      wx.showToast({ title: '搜索失败，请重试', icon: 'none' });
    }
  },

  // 选中地图搜索结果 → 自动填入地址和坐标
  onPickLocation: function (e) {
    var idx = e.currentTarget.dataset.index;
    var poi = this.data.searchResults[idx];
    if (!poi || !poi.location) return;

    var form = this.data.form;
    form.address = poi.address || poi.title;
    form.location = {
      latitude: poi.location.latitude,
      longitude: poi.location.longitude
    };
    // 如果名称还没填，自动填入
    if (!form.name.trim()) {
      form.name = poi.title;
    }

    this.setData({
      form: form,
      locationPicked: true,
      searchResults: [poi]  // 只保留选中的那个
    });
    wx.showToast({ title: '已选定: ' + poi.title, icon: 'success' });
  },

  // ==================== 图片上传 ====================
  onChooseImage: function () {
    var that = this;
    wx.chooseMedia({
      count: 3, mediaType: ['image'], sizeType: ['compressed'],
      success: function (res) {
        that.setData({ uploading: true });
        var files = res.tempFiles;
        var promises = [];
        for (var i = 0; i < files.length; i++) {
          (function (fp) {
            promises.push(new Promise(function (resolve, reject) {
              wx.cloud.uploadFile({
                cloudPath: 'attractions/' + Date.now() + '_' + Math.random().toString(36).substr(2, 8) + '.jpg',
                filePath: fp,
                success: function (r) { resolve(r.fileID); },
                fail: reject
              });
            }));
          })(files[i].tempFilePath);
        }
        Promise.all(promises).then(function (fileIDs) {
          var form = that.data.form;
          form.images = (form.images || []).concat(fileIDs);
          that.setData({ form: form, uploading: false });
          wx.showToast({ title: '上传成功', icon: 'success' });
        }).catch(function () {
          that.setData({ uploading: false });
          wx.showToast({ title: '上传失败', icon: 'none' });
        });
      }
    });
  },

  onRemoveImage: function (e) {
    var idx = e.currentTarget.dataset.index;
    var form = this.data.form;
    form.images.splice(idx, 1);
    this.setData({ form: form });
  },

  // ==================== 提交 ====================
  onSubmit: async function () {
    var that = this;
    var f = that.data.form;

    if (!f.name.trim()) { wx.showToast({ title: '请输入景点名称', icon: 'none' }); return; }
    if (!f.address.trim()) { wx.showToast({ title: '请搜索并选定村庄位置', icon: 'none' }); return; }
    if (!f.location || !f.location.latitude) { wx.showToast({ title: '请通过地图搜索选定位置', icon: 'none' }); return; }

    that.setData({ saving: true });

    var tags = f.tags ? f.tags.split(/[、,，\s]+/).filter(function (t) { return t.trim(); }) : [];
    var data = {
      name: f.name.trim(), address: f.address.trim(), category: f.category,
      tags: tags, openTime: f.openTime.trim(), ticketPrice: f.ticketPrice,
      introduction: f.introduction.trim(), images: f.images,
      location: f.location, rating: f.rating
    };

    try {
      var actionRes;
      if (that.data.isEdit) {
        data.id = that.data.id;
        actionRes = await wx.cloud.callFunction({ name: 'adminAttractions', data: { action: 'update', data: data } });
      } else {
        actionRes = await wx.cloud.callFunction({ name: 'adminAttractions', data: { action: 'create', data: data } });
      }

      if (actionRes.result && actionRes.result.success) {
        getApp().refreshCache('attractions');
        wx.showToast({ title: that.data.isEdit ? '已更新' : '已创建', icon: 'success' });
        setTimeout(function () { wx.navigateBack(); }, 1200);
      } else {
        that.setData({ saving: false });
        wx.showToast({ title: (actionRes.result && actionRes.result.error) || '保存失败', icon: 'none' });
      }
    } catch (err) {
      that.setData({ saving: false });
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  }
});
