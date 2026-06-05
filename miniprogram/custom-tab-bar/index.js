Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '首页', icon: '/images/tab-home.png', iconActive: '/images/tab-home-active.png' },
      { pagePath: '/pages/attractions/list/list', text: '景点', icon: '/images/tab-attraction.png', iconActive: '/images/tab-attraction-active.png' },
      { pagePath: '/pages/routes/list/list', text: '路线', icon: '/images/tab-route.png', iconActive: '/images/tab-route-active.png' },
      { pagePath: '/pages/mine/index/index', text: '我的', icon: '/images/tab-mine.png', iconActive: '/images/tab-mine-active.png' }
    ]
  },

  methods: {
    switchTab: function (e) {
      var index = e.currentTarget.dataset.index;
      var path = e.currentTarget.dataset.path;
      if (this.data.selected === index) return;
      wx.switchTab({ url: path });
    }
  }
});
