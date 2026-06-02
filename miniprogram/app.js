// app.js - 去俺村小程序入口
App({
  onLaunch: function () {
    // 初始化云开发环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'your-env-id',        // 替换为你的云开发环境ID
        traceUser: true,           // 追踪用户访问
      });
    }

    // 获取用户信息
    this.getUserInfo();
  },

  // 全局数据
  globalData: {
    userInfo: null,
    openid: null,
    isLogin: false,
    // 景点分类配置
    categories: [
      { id: 'red', name: '红游', icon: '🚩' },
      { id: 'rural', name: '乡村游', icon: '🌾' },
      { id: 'family', name: '亲子游', icon: '👨‍👩‍👧' },
      { id: 'culture', name: '文化游', icon: '🏛️' },
      { id: 'diy', name: '自制游', icon: '✨' },
      { id: 'custom', name: '定制游', icon: '🎯' }
    ],
    // 路线标签
    routeTags: [
      { id: 'oneDay', name: '一日游' },
      { id: 'twoDay', name: '两日游' },
      { id: 'family', name: '亲子游' },
      { id: 'couple', name: '情侣游' },
      { id: 'group', name: '团体游' },
      { id: 'photography', name: '摄影路线' },
      { id: 'foodie', name: '美食之旅' }
    ]
  },

  // 获取用户信息和openid
  getUserInfo: function () {
    const that = this;
    // 先尝试从缓存获取
    const userInfo = wx.getStorageSync('userInfo');
    const openid = wx.getStorageSync('openid');

    if (userInfo && openid) {
      that.globalData.userInfo = userInfo;
      that.globalData.openid = openid;
      that.globalData.isLogin = true;
      return;
    }

    // 通过云函数获取openid
    wx.cloud.callFunction({
      name: 'login',
      data: {},
      success: res => {
        that.globalData.openid = res.result.openid;
        wx.setStorageSync('openid', res.result.openid);
      },
      fail: err => {
        console.error('获取openid失败:', err);
      }
    });
  },

  // 检查登录状态
  checkLogin: function () {
    if (!this.globalData.isLogin) {
      wx.showModal({
        title: '提示',
        content: '请先登录后使用此功能',
        success: res => {
          if (res.confirm) {
            this.getUserProfile();
          }
        }
      });
      return false;
    }
    return true;
  },

  // 获取用户头像昵称（微信新版头像昵称填写能力）
  getUserProfile: function () {
    const that = this;
    wx.getUserProfile({
      desc: '用于完善个人资料',
      success: res => {
        that.globalData.userInfo = res.userInfo;
        that.globalData.isLogin = true;
        wx.setStorageSync('userInfo', res.userInfo);

        // 可选：将用户信息保存到云数据库
        wx.cloud.callFunction({
          name: 'getProfile',
          data: {
            userInfo: res.userInfo
          }
        });
      },
      fail: err => {
        console.error('获取用户信息失败:', err);
      }
    });
  }
});
