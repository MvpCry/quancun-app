// components/attraction-card/attraction-card.js
Component({
  properties: {
    attraction: {
      type: Object,
      value: {},
      observer: function (newVal) {
        if (newVal && newVal.category) {
          const app = getApp();
          const cat = app.globalData.categories.find(c => c.id === newVal.category);
          this.setData({
            categoryName: cat ? cat.name : ''
          });
        }
      }
    },
    showFavorite: {
      type: Boolean,
      value: false
    }
  },

  data: {
    categoryName: ''
  },

  methods: {
    onTap: function () {
      this.triggerEvent('tap', { id: this.data.attraction._id });
    },

    onCoverError: function () {
      // WebP 解码失败兜底
    },

    onFavorite: function () {
      const app = getApp();
      if (!app.checkLogin()) return;

      this.triggerEvent('favorite', {
        id: this.data.attraction._id,
        isFavorited: !this.data.attraction.isFavorited
      });
    }
  }
});
