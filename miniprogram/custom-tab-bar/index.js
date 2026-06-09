// custom-tab-bar/index.js
// 自定义底部导航栏 — 每个 Tab 页在 onShow 中调用 getTabBar().setData({ selected: N })
Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: '/pages/index/index',
        text: '首页',
        iconPath: '/images/tab-home.png',
        selectedIconPath: '/images/tab-home-active.png'
      },
      {
        pagePath: '/pages/attractions/list/list',
        text: '景点',
        iconPath: '/images/tab-attraction.png',
        selectedIconPath: '/images/tab-attraction-active.png'
      },
      {
        pagePath: '/pages/routes/list/list',
        text: '路线',
        iconPath: '/images/tab-route.png',
        selectedIconPath: '/images/tab-route-active.png'
      },
      {
        pagePath: '/pages/mine/index/index',
        text: '我的',
        iconPath: '/images/tab-mine.png',
        selectedIconPath: '/images/tab-mine-active.png'
      }
    ]
  },

  methods: {
    onTabTap: function (e) {
      var dataset = e.currentTarget.dataset;
      var url = dataset.path;
      var idx = Number(dataset.index);

      // 已是当前页，忽略
      if (this.data.selected === idx) return;

      wx.switchTab({ url: url });
    }
  }
});
