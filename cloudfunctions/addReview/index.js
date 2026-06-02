// cloudfunctions/addReview/index.js - 添加评论
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const {
    attractionId,
    rating = 5,
    content,
    images = []
  } = event;

  // 参数校验
  if (!attractionId) {
    return { error: '缺少景点ID' };
  }
  if (!content || content.trim().length === 0) {
    return { error: '请输入评价内容' };
  }
  if (rating < 1 || rating > 5) {
    return { error: '评分需在1-5之间' };
  }

  try {
    // 获取用户信息
    const userRes = await db.collection('users')
      .where({ _openid: openid })
      .get();

    const userInfo = userRes.data[0] || {};

    // 添加评论
    await db.collection('reviews').add({
      data: {
        attractionId,
        userId: openid,
        userName: userInfo.nickName || '匿名用户',
        avatarUrl: userInfo.avatarUrl || '',
        rating,
        content: content.trim(),
        images,
        createTime: db.serverDate()
      }
    });

    // 更新景点平均评分
    const reviewsRes = await db.collection('reviews')
      .where({ attractionId })
      .get();

    const reviews = reviewsRes.data;
    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const avgRating = Math.round((totalRating / reviews.length) * 10) / 10;

    await db.collection('attractions')
      .doc(attractionId)
      .update({
        data: {
          rating: avgRating,
          reviewCount: reviews.length,
          updateTime: db.serverDate()
        }
      });

    return { success: true };
  } catch (err) {
    console.error('addReview error:', err);
    return { error: err.message };
  }
};
