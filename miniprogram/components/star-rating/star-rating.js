// components/star-rating/star-rating.js
Component({
  properties: {
    rating: {
      type: Number,
      value: 0,
      observer: function (newVal) {
        // 容错：非数字或 NaN 时使用 0
        var r = (typeof newVal === 'number' && !isNaN(newVal)) ? newVal : 0;
        this.updateDisplay(r);
      }
    },
    maxRating: {
      type: Number,
      value: 5
    },
    size: {
      type: String,
      value: 'medium'   // small | medium | large
    },
    readonly: {
      type: Boolean,
      value: true
    },
    showText: {
      type: Boolean,
      value: false
    }
  },

  data: {
    displayRating: 0,
    starSize: 32,
    ratingText: ''
  },

  lifetimes: {
    attached: function () {
      this.updateDisplay(this.data.rating);

      // 设置星星大小
      const sizeMap = { small: 24, medium: 32, large: 40 };
      this.setData({ starSize: sizeMap[this.data.size] || 32 });
    }
  },

  methods: {
    updateDisplay: function (rating) {
      // 容错：非数值类型统一转 0
      var r = (typeof rating === 'number' && !isNaN(rating)) ? rating : 0;
      var displayRating = Math.round(r * 2) / 2;
      var ratingTexts = ['', '很差', '一般', '不错', '很好', '超棒'];
      this.setData({
        displayRating: displayRating,
        ratingText: ratingTexts[Math.ceil(r)] || ''
      });
    },

    onStarTap: function (e) {
      if (this.data.readonly) return;
      const index = e.currentTarget.dataset.index;
      const newRating = index + 1;
      this.setData({ displayRating: newRating });
      this.triggerEvent('change', { rating: newRating });
    },

    onTouchMove: function (e) {
      // 暂不处理滑动评分，保持简单
    }
  }
});
