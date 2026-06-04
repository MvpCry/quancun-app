// pages/routes/diy/index/index.js - 自制游：筛选偏好 → 推荐景点 → 去规划
Page({
  data: {
    // 筛选条件
    hours: 3,
    people: '1-2',
    preferences: [],
    transport: 'driving',

    // 选项配置
    hourOptions: [3, 5, 8],
    peopleOptions: [
      { value: '1-2', label: '1-2人' },
      { value: '3-5', label: '3-5人' },
      { value: '5+', label: '5人以上' }
    ],
    prefOptions: [
      { value: 'landscape', label: '山水', icon: '🏔️' },
      { value: 'ancient', label: '古村', icon: '🏘️' },
      { value: 'food', label: '美食', icon: '🍜' }
    ],

    // 推荐结果
    showResults: false,
    loading: false,
    recommendList: [],
    selectedIds: []
  },

  // ========== 筛选操作 ==========
  onHourChange: function (e) {
    this.setData({ hours: Number(e.currentTarget.dataset.value) });
  },

  onPeopleChange: function (e) {
    this.setData({ people: e.currentTarget.dataset.value });
  },

  onPrefToggle: function (e) {
    var val = e.currentTarget.dataset.value;
    if (!val) return;
    var prefs = this.data.preferences.slice();
    var idx = prefs.indexOf(val);
    if (idx >= 0) {
      prefs.splice(idx, 1);
    } else {
      prefs.push(val);
    }
    this.setData({ preferences: prefs });
  },

  onTransportChange: function (e) {
    this.setData({ transport: e.currentTarget.dataset.value });
  },

  // ========== 偏好 → 标签映射 ==========
  prefToTags: function (prefs) {
    var map = {
      'landscape': ['山水', '自然', '登山', '休闲观光'],
      'ancient': ['古村落', '历史文化', '民俗文化', '泰山石刻'],
      'food': ['美食', '农家体验', '农特产', '休闲度假']
    };
    var tags = [];
    for (var i = 0; i < prefs.length; i++) {
      var t = map[prefs[i]];
      if (t) tags = tags.concat(t);
    }
    return tags;
  },

  // ========== 推荐景点 ==========
  onRecommend: async function () {
    var that = this;
    that.setData({ loading: true });

    try {
      var app = getApp();
      var res = await app.fetchAttractions({ pageSize: 50 }, true);
      var villages = (res && res.list) || [];

      // 按偏好标签筛选
      if (that.data.preferences.length > 0) {
        var wantTags = that.prefToTags(that.data.preferences);
        villages = villages.filter(function (v) {
          if (!v.tags || v.tags.length === 0) return true;
          for (var t = 0; t < wantTags.length; t++) {
            if (v.tags.indexOf(wantTags[t]) >= 0) return true;
          }
          return false;
        });
      }

      // 按出行时间限制数量
      var maxCount = Math.ceil(that.data.hours / 1.5);
      villages = villages.slice(0, maxCount);

      // 标记选中状态
      villages = villages.map(function (v) {
        v._selected = false;
        return v;
      });

      that.setData({
        recommendList: villages,
        selectedIds: [],
        showResults: true,
        loading: false
      });
    } catch (e) {
      console.error('推荐失败:', e);
      that.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // ========== 勾选景点 ==========
  onSelectAttraction: function (e) {
    var id = e.currentTarget.dataset.id;
    var list = this.data.recommendList;
    var ids = this.data.selectedIds.slice();

    for (var i = 0; i < list.length; i++) {
      if (list[i]._id === id) {
        list[i]._selected = !list[i]._selected;
        if (list[i]._selected) {
          ids.push(id);
        } else {
          var idx = ids.indexOf(id);
          if (idx >= 0) ids.splice(idx, 1);
        }
        break;
      }
    }

    this.setData({ recommendList: list, selectedIds: ids });
  },

  // ========== 单景点导航 ==========
  onNavigateStop: function (e) {
    var id = e.currentTarget.dataset.id;
    var list = this.data.recommendList;
    for (var i = 0; i < list.length; i++) {
      if (list[i]._id === id) {
        var item = list[i];
        if (item.location && item.location.latitude) {
          wx.openLocation({
            latitude: item.location.latitude,
            longitude: item.location.longitude,
            name: item.name,
            address: item.address || '',
            scale: 16
          });
        } else {
          wx.showToast({ title: '暂无坐标', icon: 'none' });
        }
        return;
      }
    }
  },

  // ========== 去规划路线 ==========
  onGoPlan: function () {
    if (this.data.selectedIds.length < 2) {
      wx.showToast({ title: '请至少勾选2个景点', icon: 'none' });
      return;
    }
    wx.setStorageSync('selectedAttractionIds', this.data.selectedIds);
    wx.navigateTo({ url: '/pages/routes/plan/plan' });
  },

  // ========== 返回筛选 ==========
  onBackToFilter: function () {
    this.setData({ showResults: false, recommendList: [], selectedIds: [] });
  }
});
