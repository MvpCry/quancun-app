// pages/search/index/index.js
// 独立搜索页：腾讯地图 POI 搜索 + 数据库景点匹配 + 路线规划
var mapService = require('../../../utils/map-service.js');

Page({
  data: {
    keyword: '',
    results: [],           // 合并后的搜索结果
    dbResults: [],         // 数据库匹配结果
    poiResults: [],        // 腾讯 POI 搜索结果
    loading: false,
    searched: false,
    searchRegion: '泰安'   // 默认搜索区域
  },

  onLoad: function (options) {
    if (options && options.keyword) {
      var kw = decodeURIComponent(options.keyword);
      this.setData({ keyword: kw });
      this.doSearch(kw);
    }
  },

  // ========== 搜索输入 ==========
  onSearchInput: function (e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearch: function () {
    var kw = (this.data.keyword || '').trim();
    if (!kw) {
      wx.showToast({ title: '请输入搜索关键词', icon: 'none' });
      return;
    }
    this.doSearch(kw);
  },

  onClearSearch: function () {
    this.setData({ keyword: '', results: [], dbResults: [], poiResults: [], searched: false });
  },

  // ========== 核心搜索逻辑 ==========
  doSearch: async function (keyword) {
    var that = this;
    that.setData({ loading: true, searched: true });

    try {
      // 并行：腾讯 POI 搜索 + 数据库搜索
      var results = await Promise.all([
        that.searchPOI(keyword).catch(function () { return []; }),
        that.searchDatabase(keyword).catch(function () { return []; })
      ]);

      var poiList = results[0];
      var dbList = results[1];

      // 合并去重：DB 结果在前，POI 结果补充（按名称去重）
      var merged = that.mergeResults(dbList, poiList);

      that.setData({
        poiResults: poiList,
        dbResults: dbList,
        results: merged,
        loading: false
      });
    } catch (e) {
      console.error('搜索失败:', e);
      that.setData({ loading: false });
      wx.showToast({ title: '搜索失败，请重试', icon: 'none' });
    }
  },

  // 腾讯地图 POI 搜索
  searchPOI: async function (keyword) {
    var res = await mapService.placeSearch(keyword, '泰安', 1, 20);
    if (!res || !res.list) return [];

    return res.list.map(function (poi) {
      return {
        _id: 'poi_' + (poi.id || ''),
        name: poi.title || '',
        address: poi.address || '',
        location: poi.location || null,
        category: poi.category || '',
        source: 'poi',
        distance: poi.distance || 0
      };
    });
  },

  // 数据库已有村落搜索
  searchDatabase: async function (keyword) {
    var app = getApp();
    var result = await app.fetchAttractions({ keyword: keyword, pageSize: 50 }, true);
    if (!result || !result.list) return [];

    return result.list.map(function (item) {
      return {
        _id: item._id || '',
        name: item.name || '',
        address: item.address || '',
        location: item.location || null,
        category: item.category || '',
        tags: item.tags || [],
        rating: item.rating || 0,
        reviewCount: item.reviewCount || 0,
        source: 'database'
      };
    });
  },

  // 合并去重：DB优先，POI补充
  mergeResults: function (dbList, poiList) {
    var merged = [];
    var seenNames = {};

    // DB 结果先加入
    for (var i = 0; i < dbList.length; i++) {
      var item = dbList[i];
      var key = item.name.trim();
      if (!seenNames[key]) {
        seenNames[key] = true;
        merged.push(item);
      }
    }

    // POI 结果补充（跳过已存在的名字）
    for (var j = 0; j < poiList.length; j++) {
      var poi = poiList[j];
      var poiKey = poi.name.trim();
      if (!seenNames[poiKey]) {
        seenNames[poiKey] = true;
        merged.push(poi);
      }
    }

    return merged;
  },

  // ========== 地址格式化 ==========
  getShortLocation: function (address) {
    if (!address) return '';
    var parts = [];
    var m;
    m = address.match(/(.+?省)/);
    if (m) parts.push(m[1]);
    m = address.match(/(.+?市)/);
    if (m) parts.push(m[1]);
    m = address.match(/(.+?[区县])/);
    if (m) parts.push(m[1]);
    return parts.join('');
  },

  // ========== 路线规划 ==========
  onGoHere: function (e) {
    var that = this;
    var index = e.currentTarget.dataset.index;
    var item = that.data.results[index];
    if (!item) return;

    // 先尝试获取坐标
    var loc = item.location;
    if (loc && loc.latitude) {
      that.openNavigation(loc, item.name, item.address);
      return;
    }

    // 无坐标 → 用地址 geocoder 解析
    var addr = item.address || item.name;
    wx.showLoading({ title: '解析坐标...' });

    mapService.geocoder(addr, '泰安').then(function (coords) {
      wx.hideLoading();
      var location = { latitude: coords.lat, longitude: coords.lng };
      item.location = location;
      that.openNavigation(location, item.name, item.address);
    }).catch(function () {
      wx.hideLoading();
      // 回退：直接用微信内置地图搜索
      wx.openLocation({
        name: item.name,
        address: item.address || '',
        scale: 16
      });
    });
  },

  // 打开导航（驾车 / 步行选择）
  openNavigation: function (location, name, address) {
    wx.showActionSheet({
      itemList: ['🚗 驾车导航', '🚶 步行导航'],
      success: function (res) {
        if (res.tapIndex === 0) {
          // 驾车 → 用 openLocation（微信内置导航）
          wx.openLocation({
            latitude: location.latitude,
            longitude: location.longitude,
            name: name,
            address: address || '',
            scale: 16
          });
        } else if (res.tapIndex === 1) {
          // 步行 → openLocation（微信地图支持切换步行）
          wx.openLocation({
            latitude: location.latitude,
            longitude: location.longitude,
            name: name,
            address: address || '',
            scale: 18
          });
        }
      }
    });
  },

  // ========== 详情跳转 ==========
  onItemTap: function (e) {
    var index = e.currentTarget.dataset.index;
    var item = this.data.results[index];
    if (!item) return;

    // DB 结果 → 跳详情页
    if (item.source === 'database' && item._id) {
      wx.navigateTo({ url: '/pages/attractions/detail/detail?id=' + item._id });
      return;
    }

    // POI 结果 → 直接导航
    this.onGoHere(e);
  }
});
