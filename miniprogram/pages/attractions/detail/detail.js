// pages/attractions/detail/detail.js
// 数据优先从云数据库获取，回退到本地默认数据
var format = require('../../../utils/format.js');

Page({
  data: {
    isAndroid: false,
    backIcon: '<',
    attractionId: '',
    attraction: { images: [], location: {} },
    currentImageIndex: 0,
    markers: [],
    reviews: [],
    totalReviews: 0,
    reviewTotal: 0,
    reviewSort: 'like',
    reviewPage: 1,
    hasMore: false,
    loading: true,
    loadError: '',        // 加载错误信息（空=无错误）
    loadRetryCount: 0,    // 重试次数

    // 写评价
    isLogin: false,
    currentUser: null,
    myRating: 5,
    reviewContent: '',
    submitting: false,
    reviewFocused: false
  },

  onLoad: function (options) {
    var sysInfo = wx.getSystemInfoSync();
    this.setData({ isAndroid: sysInfo.platform === 'android' });

    if (!options || !options.id) {
      this.setData({ loading: false, loadError: '缺少景点ID参数' });
      return;
    }
    this.setData({ attractionId: options.id, loading: true, loadError: '', loadRetryCount: 0 });
    this.loadAttraction(options.id);
    this.checkLoginState();
    this.recordHistory(options.id);
  },

  onShow: function () {
    this.checkLoginState();
  },

  // 检查登录状态
  checkLoginState: function () {
    var app = getApp();
    var userInfo = wx.getStorageSync('userInfo');
    var isLogin = !!(userInfo && (app.globalData.isLogin || userInfo.nickName));

    this.setData({
      isLogin: isLogin,
      currentUser: isLogin ? userInfo : null
    });
  },

  // ========== 主加载：云优先 → 缓存回退 → 本地兜底 ==========
  loadAttraction: async function (id) {
    var that = this;
    that.setData({ loading: true, loadError: '' });

    // 1. 尝试云函数获取详情
    if (wx.cloud) {
      try {
        var res = await wx.cloud.callFunction({
          name: 'getAttractionDetail',
          data: { id: id, reviewSort: that.data.reviewSort, reviewPage: 1, reviewPageSize: 20 }
        });

        if (res.result && res.result.attraction) {
          var attraction = res.result.attraction;
          if (!attraction.introduction) {
            attraction.introduction = attraction.description || '';
          }
          await that.renderAttraction(attraction, res.result.reviews || [], res.result.reviewTotal || 0, res.result.hasMore || false);
          return;
        }
        // 云函数返回了但没有 attraction（如返回 error）
        console.warn('云函数未返回景点数据:', res.result);
      } catch (err) {
        console.error('云函数调用失败:', err);
      }
    }

    // 2. 尝试从全局缓存查找
    var app = getApp();
    var cached = app.globalData.cachedAttractions;
    if (cached) {
      for (var i = 0; i < cached.length; i++) {
        if (cached[i]._id === id) {
          var found = cached[i];
          if (!found.introduction) found.introduction = found.description || '';
          await that.renderAttraction(found, [], 0, false);
          return;
        }
      }
    }

    // 3. 回退本地数据
    var defaultData = require('../../../data/defaultData.js');
    var list = defaultData.defaultAttractions;
    for (var j = 0; j < list.length; j++) {
      if (list[j]._id === id) {
        var localFound = list[j];
        if (!localFound.introduction) localFound.introduction = localFound.description || '';
        await that.renderAttraction(localFound, defaultData.defaultReviews, defaultData.defaultReviews.length, false);
        return;
      }
    }

    // 4. 所有来源都未找到
    that.setData({
      loading: false,
      loadError: '景点不存在或已被删除'
    });
  },

  // 重新加载
  onRetry: function () {
    this.loadAttraction(this.data.attractionId);
  },

  // 返回列表
  onNavBack: function () {
    wx.navigateBack({ delta: 1 });
  },

  // 渲染景点数据
  renderAttraction: async function (attraction, reviews, reviewTotal, hasMore) {
    // 无坐标时尝试地址→geocoder 实时解析
    if (attraction.address && (!attraction.location || !attraction.location.latitude)) {
      var app = getApp();
      try { await app.resolveAttractionLocation(attraction); } catch (e) {}
    }

    // 构建地图标记
    var markers = [];
    var hasLocation = !!(attraction.location && attraction.location.latitude);
    if (hasLocation) {
      markers.push({
        id: 0,
        latitude: attraction.location.latitude,
        longitude: attraction.location.longitude,
        title: attraction.name,
        iconPath: '/images/marker-village.png',
        width: 54,
        height: 48,
        callout: {
          content: attraction.name,
          color: '#333',
          fontSize: 13,
          borderRadius: 8,
          padding: 8,
          display: 'ALWAYS'
        }
      });
    }

    // 格式化评论时间
    reviews = (reviews.length > 0 ? reviews : (attraction.reviews || [])).map(function (r) {
      r.createTime = format.formatDate(r.createTime);
      return r;
    });

    this.setData({
      attraction: attraction,
      markers: markers,
      hasLocation: hasLocation,
      reviews: reviews,
      reviewTotal: reviewTotal || (reviews ? reviews.length : 0),
      hasMore: hasMore || false,
      loading: false
    });

    wx.setNavigationBarTitle({ title: attraction.name || '景点详情' });
  },

  // 记录浏览历史
  recordHistory: function (id) {
    var history = wx.getStorageSync('browseHistory') || [];
    // 去重
    var idx = history.indexOf(id);
    if (idx >= 0) history.splice(idx, 1);
    history.unshift(id);
    // 最多保留20条
    if (history.length > 20) history.pop();
    wx.setStorageSync('browseHistory', history);
  },

  // ========== 交互事件 ==========

  onSwiperChange: function (e) {
    this.setData({ currentImageIndex: e.detail.current });
  },

  onPreviewImage: function (e) {
    wx.previewImage({
      urls: this.data.attraction.images,
      current: e.currentTarget.dataset.url
    });
  },

  onNavigate: function () {
    var loc = this.data.attraction.location;
    if (!loc || !loc.latitude) {
      wx.showToast({ title: '暂无位置信息', icon: 'none' });
      return;
    }
    wx.openLocation({
      latitude: loc.latitude,
      longitude: loc.longitude,
      name: this.data.attraction.name,
      address: this.data.attraction.address || '',
      scale: 16
    });
  },

  onOpenMap: function () { this.onNavigate(); },

  onAddToRoute: function () {
    var ids = wx.getStorageSync('selectedAttractionIds') || [];
    if (ids.indexOf(this.data.attractionId) === -1) {
      ids.push(this.data.attractionId);
    }
    wx.setStorageSync('selectedAttractionIds', ids);
    wx.navigateTo({ url: '/pages/routes/plan/plan' });
  },

  // ========== 举报评论 ==========

  onReportReview: function (e) {
    var that = this;
    var reviewId = e.currentTarget.dataset.reviewId;

    if (!reviewId) return;

    wx.showActionSheet({
      itemList: ['辱骂脏话', '恶意抹黑'],
      success: function (res) {
        var reportType = res.tapIndex === 0 ? 'abuse' : 'defamation';

        wx.showModal({
          title: '确认举报',
          content: '确定以"' + (reportType === 'abuse' ? '辱骂脏话' : '恶意抹黑') + '"举报该评论吗？',
          confirmText: '确认举报',
          confirmColor: '#E53935',
          success: function (modalRes) {
            if (modalRes.confirm) {
              that.submitReport(reviewId, reportType);
            }
          }
        });
      }
    });
  },

  submitReport: async function (reviewId, reportType) {
    if (!wx.cloud) {
      wx.showToast({ title: '云开发不可用', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交中...' });

    try {
      var res = await wx.cloud.callFunction({
        name: 'reportReview',
        data: {
          reviewId: reviewId,
          reportType: reportType
        }
      });

      wx.hideLoading();

      if (res.result && res.result.success) {
        wx.showToast({ title: '举报已提交', icon: 'success' });
      } else {
        var errMsg = (res.result && res.result.error) || '举报失败';
        // 用弹窗展示完整错误信息，方便排查
        wx.showModal({
          title: '举报失败',
          content: errMsg + '\n\nreviewId: ' + reviewId,
          showCancel: false
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('举报失败:', err);
      wx.showModal({
        title: '举报失败',
        content: '云函数调用异常\n\n' + (err.errMsg || err.message || '未知错误') + '\n\n请确认 reportReview 云函数已部署',
        showCancel: false
      });
    }
  },

  // ========== 评论排序 ==========
  onSortReview: function (e) {
    var sort = e.currentTarget.dataset.sort;
    if (sort === this.data.reviewSort) return;
    this.setData({ reviewSort: sort, reviewPage: 1 });
    this.loadAttraction(this.data.attractionId);
  },

  // ========== 加载更多评论 ==========
  onLoadMoreReviews: async function () {
    var that = this;
    var nextPage = that.data.reviewPage + 1;
    try {
      var res = await wx.cloud.callFunction({
        name: 'getAttractionDetail',
        data: {
          id: that.data.attractionId,
          reviewSort: that.data.reviewSort,
          reviewPage: nextPage,
          reviewPageSize: 20
        }
      });
      if (res.result && res.result.reviews) {
        var more = res.result.reviews.map(function (r) {
          r.createTime = format.formatDate(r.createTime);
          return r;
        });
        var newReviews = that.data.reviews.concat(more);
        that.setData({
          reviews: newReviews,
          reviewPage: nextPage,
          hasMore: res.result.hasMore || false
        });
      }
    } catch (err) {
      console.error('加载更多评论失败:', err);
    }
  },

  // ========== 点赞评论 ==========
  onLikeReview: async function (e) {
    var that = this;
    var index = e.currentTarget.dataset.index;
    var reviewId = e.currentTarget.dataset.id;

    if (!wx.cloud) {
      wx.showToast({ title: '云开发不可用', icon: 'none' });
      return;
    }

    try {
      var res = await wx.cloud.callFunction({
        name: 'toggleLike',
        data: { reviewId: reviewId }
      });
      if (res.result && res.result.success) {
        var reviews = that.data.reviews;
        var item = reviews[index];
        item.isLiked = res.result.liked;
        item.likeCount = Math.max(0, (item.likeCount || 0) + (res.result.liked ? 1 : -1));
        that.setData({ reviews: reviews });
      } else {
        wx.showToast({ title: (res.result && res.result.error) || '操作失败', icon: 'none' });
      }
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // ========== 写评价相关 ==========

  // 星级打分变化
  onReviewStarChange: function (e) {
    this.setData({ myRating: e.detail.rating });
  },

  // 评价内容输入
  onReviewInput: function (e) {
    this.setData({ reviewContent: e.detail.value });
  },

  // 评价输入框聚焦/失焦
  onReviewFocus: function () {
    this.setData({ reviewFocused: true });
  },

  onReviewBlur: function () {
    this.setData({ reviewFocused: false });
  },

  // 引导登录
  onGoLogin: function () {
    var that = this;
    var app = getApp();
    app.getUserProfile(function (userInfo) {
      that.checkLoginState();
    });
  },

  // 提交评价
  onSubmitReview: async function () {
    var that = this;

    // ① 登录门禁
    if (!that.data.isLogin) {
      wx.showModal({
        title: '需要登录',
        content: '请先微信授权登录后再发表评价',
        confirmText: '去登录',
        success: function (res) {
          if (res.confirm) that.onGoLogin();
        }
      });
      return;
    }

    // ② 内容校验
    var content = (that.data.reviewContent || '').trim();
    if (content.length < 2) {
      wx.showToast({ title: '评价内容至少2个字', icon: 'none' });
      return;
    }
    if (content.length > 500) {
      wx.showToast({ title: '评价内容最多500字', icon: 'none' });
      return;
    }

    // ③ 微信内容安全预检
    if (that.data.submitting) return;
    that.setData({ submitting: true });

    try {
      var checkRes = await wx.cloud.callFunction({
        name: 'checkContent',
        data: { content: content }
      });

      if (checkRes.result && !checkRes.result.isSafe) {
        that.setData({ submitting: false });
        wx.showToast({ title: '内容违规，请修改后发布', icon: 'none' });
        return;
      }
    } catch (err) {
      // checkContent 调用失败不阻塞，降级继续提交
      console.warn('内容预检失败，降级放行:', err);
    }

    // ④ 提交
    try {
      var res = await wx.cloud.callFunction({
        name: 'addReview',
        data: {
          attractionId: that.data.attractionId,
          rating: that.data.myRating,
          content: content
        }
      });

      var result = res.result;
      if (result && result.success) {
        wx.showToast({ title: '评价发布成功！', icon: 'success' });
        that.setData({
          reviewContent: '',
          myRating: 5,
          submitting: false
        });
        // 重新加载景点（更新评分和评论列表）
        that.loadAttraction(that.data.attractionId);
      } else {
        var errorMsg = (result && result.error) || '发布失败';
        wx.showToast({ title: errorMsg, icon: 'none' });
        that.setData({ submitting: false });
      }
    } catch (err) {
      console.error('提交评价失败:', err);
      wx.showToast({ title: '发布失败，请稍后重试', icon: 'none' });
      that.setData({ submitting: false });
    }
  },

  // ========== 长按删除自己的评论 ==========
  onLongPressReview: function (e) {
    var that = this;
    var reviewId = e.currentTarget.dataset.reviewId;
    var index = e.currentTarget.dataset.index;
    var review = that.data.reviews[index];
    if (!review) return;

    wx.showModal({
      title: '删除评论',
      content: '确定删除这条评论吗？',
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
              var reviews = that.data.reviews.slice();
              reviews.splice(index, 1);
              that.setData({ reviews: reviews, reviewTotal: Math.max(0, that.data.reviewTotal - 1) });
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

  onShareAppMessage: function () {
    return {
      title: '去俺村 - ' + this.data.attraction.name,
      path: '/pages/attractions/detail/detail?id=' + this.data.attractionId
    };
  }
});
