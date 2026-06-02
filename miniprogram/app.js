// app.js - 去俺村小程序入口
App({
  onLaunch: function () {
    // 初始化云开发环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-d6gmuaxy558d92f62',
        traceUser: true,
      });
    }

    // 获取用户 openid
    this.getOpenId();

    // 首次启动：检查云数据库是否需要导入初始数据
    this.checkAndImportData();
  },

  // 全局数据（所有页面共享的缓存）
  globalData: {
    userInfo: null,
    openid: null,
    isLogin: false,

    // ===== 共享数据缓存（首页 ↔ Tab页同步） =====
    cachedAttractions: null,   // 景点列表缓存
    cachedRoutes: null,        // 路线列表缓存
    lastAttractionsFetch: 0,   // 上次景点拉取时间戳
    lastRoutesFetch: 0,        // 上次路线拉取时间戳
    cacheTTL: 5 * 60 * 1000,   // 缓存有效期：5分钟

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

  // =============================================
  //  云函数数据获取（首页 + Tab 页共用）
  // =============================================

  /**
   * 获取景点列表（带缓存）
   * @param {Object} params - { category, keyword, sortBy, page, pageSize }
   * @param {Boolean} forceRefresh - 强制刷新，跳过缓存
   * @returns {Promise<Object>} { list, total, hasMore }
   */
  fetchAttractions: async function (params, forceRefresh) {
    var that = this;
    var now = Date.now();
    params = params || {};

    // 无筛选条件 + 缓存有效 → 直接返回缓存
    if (
      !forceRefresh &&
      !params.category && !params.keyword && !params.page &&
      that.globalData.cachedAttractions &&
      (now - that.globalData.lastAttractionsFetch) < that.globalData.cacheTTL
    ) {
      return { list: that.globalData.cachedAttractions, total: that.globalData.cachedAttractions.length, hasMore: false };
    }

    // 云函数可用 → 从云数据库拉取
    if (wx.cloud) {
      try {
        var res = await wx.cloud.callFunction({
          name: 'getAttractions',
          data: {
            action: 'list',
            category: params.category || undefined,
            keyword: params.keyword || undefined,
            sortBy: params.sortBy || 'rating',
            page: params.page || 1,
            pageSize: params.pageSize || 50
          }
        });

        if (res.result && res.result.list && res.result.list.length > 0) {
          var list = res.result.list;
          // 无筛选时更新全局缓存
          if (!params.category && !params.keyword && !params.page) {
            that.globalData.cachedAttractions = list;
            that.globalData.lastAttractionsFetch = now;
          }
          return {
            list: list,
            total: res.result.total || list.length,
            hasMore: res.result.hasMore || false
          };
        }
      } catch (err) {
        console.error('fetchAttractions 云函数失败:', err);
      }
    }

    // 云函数不可用 → 回退本地数据
    return that.loadLocalAttractions(params);
  },

  /**
   * 获取路线列表（带缓存）
   * @param {Object} params - { tag, page, pageSize }
   * @param {Boolean} forceRefresh
   * @returns {Promise<Object>} { list, total, hasMore }
   */
  fetchRoutes: async function (params, forceRefresh) {
    var that = this;
    var now = Date.now();
    params = params || {};

    // 无筛选条件 + 缓存有效 → 直接返回缓存
    if (
      !forceRefresh &&
      !params.tag && !params.page &&
      that.globalData.cachedRoutes &&
      (now - that.globalData.lastRoutesFetch) < that.globalData.cacheTTL
    ) {
      return { list: that.globalData.cachedRoutes, total: that.globalData.cachedRoutes.length, hasMore: false };
    }

    // 云函数可用 → 从云数据库拉取
    if (wx.cloud) {
      try {
        var res = await wx.cloud.callFunction({
          name: 'getRoutes',
          data: {
            action: params.action || 'list',
            tag: params.tag || undefined,
            page: params.page || 1,
            pageSize: params.pageSize || 50,
            limit: params.limit || 10
          }
        });

        if (res.result && res.result.list && res.result.list.length > 0) {
          var list = res.result.list;
          // 无筛选时更新全局缓存
          if (!params.tag && !params.page && params.action !== 'myRoutes') {
            that.globalData.cachedRoutes = list;
            that.globalData.lastRoutesFetch = now;
          }
          return {
            list: list,
            total: res.result.total || list.length,
            hasMore: res.result.hasMore || false
          };
        }
      } catch (err) {
        console.error('fetchRoutes 云函数失败:', err);
      }
    }

    // 云函数不可用 → 回退本地数据
    return that.loadLocalRoutes(params);
  },

  /**
   * 刷新共享缓存（任意页面修改数据后调用）
   */
  refreshCache: function (type) {
    if (type === 'attractions' || type === 'all') {
      this.globalData.cachedAttractions = null;
      this.globalData.lastAttractionsFetch = 0;
    }
    if (type === 'routes' || type === 'all') {
      this.globalData.cachedRoutes = null;
      this.globalData.lastRoutesFetch = 0;
    }
  },

  // =============================================
  //  本地数据回退（云函数不可用时）
  // =============================================

  loadLocalAttractions: function (params) {
    var defaultData = require('./data/defaultData.js');
    var list = defaultData.defaultAttractions.slice();

    if (params && params.category) {
      list = list.filter(function (a) { return a.category === params.category; });
    }
    if (params && params.keyword) {
      list = list.filter(function (a) {
        return a.name.indexOf(params.keyword) >= 0 ||
               (a.description && a.description.indexOf(params.keyword) >= 0);
      });
    }
    if (params && params.sortBy === 'rating') {
      list.sort(function (a, b) { return b.rating - a.rating; });
    }
    return { list: list, total: list.length, hasMore: false };
  },

  loadLocalRoutes: function (params) {
    var defaultData = require('./data/defaultData.js');
    var list = defaultData.defaultRoutes.slice();

    if (params && params.tag) {
      list = list.filter(function (r) {
        return r.tags && r.tags.indexOf(params.tag) >= 0;
      });
    }
    return { list: list, total: list.length, hasMore: false };
  },

  // =============================================
  //  用户相关
  // =============================================

  // 获取 openid
  getOpenId: function () {
    var that = this;
    var openid = wx.getStorageSync('openid');

    if (openid) {
      that.globalData.openid = openid;
      return;
    }

    if (!wx.cloud) return;

    wx.cloud.callFunction({
      name: 'login',
      data: {},
      success: function (res) {
        if (res.result && res.result.openid) {
          that.globalData.openid = res.result.openid;
          wx.setStorageSync('openid', res.result.openid);
        }
      },
      fail: function (err) {
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
        success: function (res) {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/mine/index/index' });
          }
        }
      });
      return false;
    }
    return true;
  },

  // 获取用户信息（适配新版微信头像昵称填写能力）
  // 新版微信中 wx.getUserProfile 已废弃，改用 button open-type="chooseAvatar" + input type="nickname"
  // 此处保留兼容旧版逻辑，新版由 mine 页面处理
  getUserProfile: function (callback) {
    var that = this;

    // 先尝试旧版 API（部分基础库仍支持）
    if (wx.getUserProfile) {
      wx.getUserProfile({
        desc: '用于完善个人资料',
        success: function (res) {
          that.globalData.userInfo = res.userInfo;
          that.globalData.isLogin = true;
          wx.setStorageSync('userInfo', res.userInfo);

          // 同步到云数据库
          if (wx.cloud) {
            wx.cloud.callFunction({
              name: 'getProfile',
              data: { userInfo: res.userInfo }
            });
          }

          if (callback) callback(res.userInfo);
        },
        fail: function (err) {
          console.error('获取用户信息失败:', err);
          // 降级：用默认头像昵称
          that.setDefaultProfile(callback);
        }
      });
    } else {
      // 新版微信：getUserProfile 已被移除
      that.setDefaultProfile(callback);
    }
  },

  // 设置默认用户信息（新版微信兼容）
  setDefaultProfile: function (callback) {
    var that = this;
    var userInfo = {
      nickName: '微信用户',
      avatarUrl: '/images/default-avatar.png'
    };
    that.globalData.userInfo = userInfo;
    that.globalData.isLogin = true;
    wx.setStorageSync('userInfo', userInfo);

    if (callback) callback(userInfo);
  },

  // 更新用户信息到全局（新版 chooseAvatar + nickname 组件调用）
  updateUserInfo: function (info) {
    var userInfo = this.globalData.userInfo || {};
    if (info.nickName !== undefined) userInfo.nickName = info.nickName;
    if (info.avatarUrl !== undefined) userInfo.avatarUrl = info.avatarUrl;
    this.globalData.userInfo = userInfo;
    this.globalData.isLogin = true;
    wx.setStorageSync('userInfo', userInfo);

    // 同步到云数据库
    if (wx.cloud) {
      wx.cloud.callFunction({
        name: 'getProfile',
        data: { userInfo: userInfo }
      });
    }
  },

  // =============================================
  //  首次启动：检测并导入初始数据
  // =============================================
  checkAndImportData: function () {
    if (!wx.cloud) return;

    var that = this;
    // 本地标记避免每次启动都弹窗
    var imported = wx.getStorageSync('_dataImported');
    if (imported) return;

    wx.cloud.callFunction({
      name: 'importDefaultData',
      data: { action: 'check' },
      success: function (res) {
        if (res.result && !res.result.hasData) {
          // 数据库为空，弹窗询问是否导入默认数据
          wx.showModal({
            title: '导入初始数据',
            content: '云数据库为空，是否导入默认景点和路线数据？',
            confirmText: '导入',
            cancelText: '稍后',
            success: function (modalRes) {
              if (modalRes.confirm) {
                that.doImportData();
              } else {
                wx.setStorageSync('_dataImported', true);
              }
            }
          });
        } else {
          // 已有数据，标记
          wx.setStorageSync('_dataImported', true);
        }
      },
      fail: function () {
        // importDefaultData 云函数未部署时不弹窗
      }
    });
  },

  doImportData: function () {
    var that = this;
    wx.showLoading({ title: '导入中...' });

    wx.cloud.callFunction({
      name: 'importDefaultData',
      data: { action: 'import' },
      success: function (res) {
        wx.hideLoading();
        if (res.result && res.result.success) {
          var s = res.result.summary;
          wx.showModal({
            title: '导入成功',
            content: '景点 ' + s.景点 + '\n路线 ' + s.路线 + '\n评论 ' + s.评论,
            showCancel: false,
            success: function () {
              wx.setStorageSync('_dataImported', true);
              // 清除缓存强制刷新
              that.refreshCache('all');
              // 重启小程序使数据生效
              wx.reLaunch({ url: '/pages/index/index' });
            }
          });
        } else {
          wx.showToast({
            title: (res.result && res.result.message) || '导入失败',
            icon: 'none'
          });
        }
      },
      fail: function (err) {
        wx.hideLoading();
        console.error('导入失败:', err);
        wx.showToast({ title: '导入失败，请先部署 importDefaultData 云函数', icon: 'none' });
      }
    });
  }
});
