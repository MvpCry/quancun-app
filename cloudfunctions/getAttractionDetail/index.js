// cloudfunctions/getAttractionDetail/index.js - 获取景点详情（含评论，支持排序）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  var wxContext = cloud.getWXContext();
  var openid = wxContext.OPENID;
  var { id, reviewSort, reviewPage, reviewPageSize } = event;

  if (!id) return { error: '缺少景点ID' };

  try {
    var attractionRes = await db.collection('attractions').doc(id).get();
    var attraction = attractionRes.data;
    if (!attraction) return { error: '景点不存在' };

    // 评论排序
    var sortField = reviewSort === 'like' ? 'likeCount' : 'createTime';
    var sortDir = 'desc';
    var page = reviewPage || 1;
    var pageSize = reviewPageSize || 20;
    var skip = (page - 1) * pageSize;

    var reviewCountRes = await db.collection('reviews')
      .where({ attractionId: id })
      .count();

    var reviewsQuery = db.collection('reviews')
      .where({ attractionId: id })
      .orderBy(sortField, sortDir)
      .skip(skip)
      .limit(pageSize);

    var recentReviewsRes = await reviewsQuery.get();

    var routeCountRes = await db.collection('routes')
      .where({ 'attractions.attractionId': id })
      .count();

    // 查当前用户点赞了哪些评论
    var likedIds = [];
    if (openid && recentReviewsRes.data.length > 0) {
      try {
        var reviewIds = recentReviewsRes.data.map(function (r) { return r._id; });
        var likeRes = await db.collection('reviewLikes')
          .where({ reviewId: _.in(reviewIds), userId: openid })
          .get();
        likedIds = likeRes.data.map(function (l) { return l.reviewId; });
      } catch (e) {
        // reviewLikes 集合可能不存在
      }
    }

    var reviews = recentReviewsRes.data.map(function (r) {
      return {
        _id: r._id,
        userName: r.userName,
        avatarUrl: r.avatarUrl,
        rating: r.rating,
        content: r.content,
        createTime: r.createTime,
        likeCount: r.likeCount || 0,
        isLiked: likedIds.indexOf(r._id) >= 0,
        reportCount: r.reportCount || 0
      };
    });

    return {
      attraction: {
        ...attraction,
        reviewCount: reviewCountRes.total,
        routeCount: routeCountRes.total
      },
      reviews: reviews,
      reviewTotal: reviewCountRes.total,
      hasMore: skip + pageSize < reviewCountRes.total
    };
  } catch (err) {
    console.error('getAttractionDetail error:', err);
    return { error: err.message };
  }
};
