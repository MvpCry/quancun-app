// components/attraction-card/attraction-card.js
Component({
  properties: {
    attraction: {
      type: Object,
      value: {},
      observer: function (newVal) {
        if (!newVal) return;
        var updates = {};
        // 分类名
        if (newVal.category) {
          var app = getApp();
          var cat = app.globalData.categories.find(function (c) { return c.id === newVal.category; });
          updates.categoryName = cat ? cat.name : '';
        }
        // 从地址提取省市简称（如"山东省泰安市泰山区"）
        if (newVal.address) {
          updates.shortLocation = extractShortLocation(newVal.address);
        }
        this.setData(updates);
      }
    },
    showFavorite: {
      type: Boolean,
      value: false
    }
  },

  data: {
    categoryName: '',
    shortLocation: ''
  },

  methods: {
    onTap: function () {
      this.triggerEvent('tap', { id: this.data.attraction._id });
    },

    onCoverError: function () {
      // WebP 解码失败兜底
    },

    onFavorite: function () {
      var app = getApp();
      if (!app.checkLogin()) return;

      this.triggerEvent('favorite', {
        id: this.data.attraction._id,
        isFavorited: !this.data.attraction.isFavorited
      });
    }
  }
});

// 从完整地址提取省市区（例："山东省泰安市泰山区邱家店镇王林坡村" → "山东省泰安市泰山区"）
function extractShortLocation(address) {
  if (!address) return '';
  // 匹配省/市/区三级
  var parts = [];
  var m;
  // 省
  m = address.match(/(.+?省)/);
  if (m) parts.push(m[1]);
  // 市
  m = address.match(/(.+?市)/);
  if (m) parts.push(m[1]);
  // 区/县
  m = address.match(/(.+?[区县])/);
  if (m) parts.push(m[1]);
  return parts.join('');
}
