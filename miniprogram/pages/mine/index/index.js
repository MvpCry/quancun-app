// pages/mine/index/index.js - 我的页面逻辑
// 修复：getApp() 移到 onLoad 内部，避免模块顶层调用
var format = require('../../../utils/format.js');

Page({
  data: {
    isLogin: false,
    userInfo: {},
    favoriteCount: 0,
    myRouteCount: 0,
    isAndroid: false,
    myReviewCount: 0,
    activeTab: '',
    tabList: []
  },

  onLoad: function () {
    this.setData({ isAndroid: wx.getSystemInfoSync().platform === 'android' });
    this.checkLoginState();
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    this.checkLoginState();
    if (this.data.isLogin) {
      this.loadUserStats();
    }
    if (this.data.activeTab) {
      this.loadTabData(this.data.activeTab);
    }
  },

  // 检查登录状态
  checkLoginState: function () {
    var app = getApp();
    var userInfo = wx.getStorageSync('userInfo');

    if (userInfo && (app.globalData.isLogin || userInfo.nickName)) {
      this.setData({
        isLogin: true,
        userInfo: userInfo
      });
    } else {
      this.setData({
        isLogin: false,
        userInfo: {}
      });
    }
  },

  // 加载用户统计
  loadUserStats: async function () {
    if (!wx.cloud) return;

    try {
      var res = await wx.cloud.callFunction({
        name: 'getProfile',
        data: { action: 'stats' }
      });
      if (res.result) {
        this.setData({
          favoriteCount: res.result.favoriteCount || 0,
          myRouteCount: res.result.routeCount || 0,
          myReviewCount: res.result.reviewCount || 0
        });
      }
    } catch (err) {
      console.error('加载统计失败:', err);
    }
  },

  // 登录（兼容新版微信）
  onLogin: function () {
    var app = getApp();
    var that = this;

    app.getUserProfile(function (userInfo) {
      that.checkLoginState();
      if (that.data.isLogin) {
        that.loadUserStats();
      }
    });
  },

  // 退出登录
  onLogout: function () {
    var that = this;
    var app = getApp();

    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: function (modalRes) {
        if (modalRes.confirm) {
          wx.removeStorageSync('userInfo');
          app.globalData.userInfo = null;
          app.globalData.isLogin = false;
          app.refreshCache('all');
          that.setData({
            isLogin: false,
            userInfo: {},
            favoriteCount: 0,
            myRouteCount: 0,
            myReviewCount: 0
          });
          wx.showToast({ title: '已退出登录', icon: 'success' });
        }
      }
    });
  },

  // 点击功能tab
  onTabTap: function (e) {
    var tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    this.loadTabData(tab);
  },

  // 关闭tab
  onCloseTab: function () {
    this.setData({ activeTab: '', tabList: [] });
  },

  // 加载tab数据
  loadTabData: async function (tab) {
    if (!wx.cloud) {
      this.setData({ tabList: [] });
      return;
    }

    wx.showLoading({ title: '加载中...' });

    try {
      switch (tab) {
        case 'favorites': {
          var favRes = await wx.cloud.callFunction({
            name: 'getFavorites',
            data: { action: 'list' }
          });
          this.setData({
            tabList: (favRes.result && favRes.result.list) || []
          });
          break;
        }

        case 'routes': {
          var routeRes = await wx.cloud.callFunction({
            name: 'getRoutes',
            data: { action: 'myRoutes' }
          });
          this.setData({
            tabList: (routeRes.result && routeRes.result.list) || []
          });
          break;
        }

        case 'reviews': {
          var reviewRes = await wx.cloud.callFunction({
            name: 'getReviews',
            data: { action: 'myReviews' }
          });
          var reviews = (reviewRes.result && reviewRes.result.list) || [];
          reviews = reviews.map(function (r) {
            r.createTime = format.formatDate(r.createTime);
            return r;
          });
          this.setData({ tabList: reviews });
          break;
        }

        case 'history': {
          var history = wx.getStorageSync('browseHistory') || [];
          if (history.length > 0) {
            var historyRes = await wx.cloud.callFunction({
              name: 'getAttractions',
              data: { action: 'byIds', ids: history }
            });
            this.setData({
              tabList: (historyRes.result && historyRes.result.list) || []
            });
          } else {
            this.setData({ tabList: [] });
          }
          break;
        }
      }
    } catch (err) {
      console.error('加载数据失败:', err);
      this.setData({ tabList: [] });
    }

    wx.hideLoading();
  },

  // 收藏项点击
  onFavItemTap: function (e) {
    var item = e.currentTarget.dataset.item;
    if (item.favType === 'attraction' || item.type === 'attraction') {
      wx.navigateTo({
        url: '/pages/attractions/detail/detail?id=' + (item.targetId || item._id)
      });
    } else {
      wx.navigateTo({
        url: '/pages/routes/detail/detail?id=' + (item.targetId || item._id)
      });
    }
  },

  // 路线点击
  onRouteTap: function (e) {
    var id = e.detail ? e.detail.id : e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/routes/detail/detail?id=' + id });
  },

  // 景点点击
  onAttractionTap: function (e) {
    var id = e.detail ? e.detail.id : e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/attractions/detail/detail?id=' + id });
  },

  // 创建路线
  onCreateRoute: function () {
    wx.navigateTo({ url: '/pages/routes/plan/plan' });
  },

  // 导航跳转
  onNavigateTo: function (e) {
    var url = e.currentTarget.dataset.url;
    wx.navigateTo({ url: url });
  },

  onAdminEntry: function () {
    wx.navigateTo({ url: '/pages/admin/dashboard/index' });
  },

  // 关于
  onAbout: function () {
    wx.showModal({
      title: '关于去俺村',
      content: '去俺村是一款乡村旅游路线串联小程序，帮助游客发现最美乡村景点，智能规划最优游览路线，让每一次出游都更加便捷高效。\n\n版本：1.0.0',
      showCancel: false
    });
  },

  // 意见反馈
  onFeedback: function () {
    wx.showModal({
      title: '意见反馈',
      editable: true,
      placeholderText: '请输入你的建议或遇到的问题...',
      success: function (res) {
        if (res.confirm && res.content) {
          wx.showToast({ title: '感谢反馈！', icon: 'success' });
        }
      }
    });
  },

  // 数据同步（调用 resolveCoordinates 批量 geocoder 解析坐标）
  onSyncData: function () {
    var that = this;
    if (!wx.cloud) {
      wx.showToast({ title: '云开发不可用', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '坐标同步',
      content: '将调用腾讯地图 API 解析所有景点地址为坐标并写入数据库。此操作需要 resolveCoordinates 云函数已部署。确定同步吗？',
      confirmText: '同步',
      success: function (res) {
        if (res.confirm) {
          wx.showLoading({ title: '解析坐标中...' });
          wx.cloud.callFunction({
            name: 'resolveCoordinates',
            data: { action: 'batch' },
            success: function (cfRes) {
              wx.hideLoading();
              var result = cfRes.result;
              if (result && result.success) {
                var s = result.summary;
                // 清除缓存，强制刷新
                var app = getApp();
                app.refreshCache('all');
                wx.showModal({
                  title: '同步成功',
                  content: '坐标解析完成！\n\n共 ' + s.total + ' 个景点\n成功：' + s.updated + '\n失败：' + s.failed + '\n\n请下拉刷新首页查看。',
                  showCancel: false
                });
              } else {
                wx.showToast({
                  title: (cfRes.result && cfRes.result.message) || '同步失败',
                  icon: 'none'
                });
              }
            },
            fail: function (err) {
              wx.hideLoading();
              console.error('同步失败:', err);
              wx.showModal({
                title: '同步失败',
                content: '请先在微信开发者工具中：\n\n右键 cloudfunctions/resolveCoordinates 文件夹\n→ 选择"上传并部署：云端安装依赖"\n\n部署成功后再试一次。',
                showCancel: false
              });
            }
          });
        }
      }
    });
  },

  // ========== 删除自己的评价 ==========
  onDeleteReview: function (e) {
    var that = this;
    var reviewId = e.currentTarget.dataset.id;
    var attractionName = e.currentTarget.dataset.name || '该景点';

    wx.showModal({
      title: '删除评价',
      content: '确定删除对「' + attractionName + '」的评价吗？',
      confirmText: '删除',
      confirmColor: '#E53935',
      success: function (res) {
        if (!res.confirm) return;
        wx.showLoading({ title: '删除中...' });
        wx.cloud.callFunction({
          name: 'handleReport',
          data: { action: 'deleteMyReview', reviewId: reviewId },
          success: function (cfRes) {
            wx.hideLoading();
            if (cfRes.result && cfRes.result.success) {
              wx.showToast({ title: '已删除', icon: 'success' });
              // 从列表中移除
              var list = that.data.tabList.filter(function (item) { return item._id !== reviewId; });
              that.setData({ tabList: list, myReviewCount: Math.max(0, that.data.myReviewCount - 1) });
            } else {
              wx.showToast({ title: (cfRes.result && cfRes.result.error) || '删除失败', icon: 'none' });
            }
          },
          fail: function () {
            wx.hideLoading();
            wx.showToast({ title: '删除失败，请重试', icon: 'none' });
          }
        });
      }
    });
  },

  onNavBack: function () {
    wx.navigateBack();
  }
});
