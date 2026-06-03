// components/route-card/route-card.js
Component({
  properties: {
    route: {
      type: Object,
      value: {},
      observer: function (newVal) {
        if (newVal && newVal.attractions) {
          this.setData({
            attractionCount: newVal.attractions.length
          });
        }
      }
    }
  },

  data: {
    attractionCount: 0
  },

  methods: {
    onCoverError: function () {
      // WebP 解码失败兜底
    },

    onTap: function () {
      this.triggerEvent('tap', { id: this.data.route._id });
    }
  }
});
