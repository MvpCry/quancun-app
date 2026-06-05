// cloudfunctions/toggleLike/index.js - 评论点赞/取消点赞
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  var wxContext = cloud.getWXContext();
  var openid = wxContext.OPENID;

  if (!openid) {
    return { success: false, error: '请先登录' };
  }

  var { reviewId } = event;
  if (!reviewId) {
    return { success: false, error: '缺少评论ID' };
  }

  try {
    // 查是否已点赞
    var likeRes = await db.collection('reviewLikes')
      .where({ reviewId: reviewId, userId: openid })
      .get();

    if (likeRes.data.length > 0) {
      // 取消点赞
      await db.collection('reviewLikes').doc(likeRes.data[0]._id).remove();
      await db.collection('reviews').doc(reviewId).update({
        data: { likeCount: _.inc(-1) }
      });
      return { success: true, liked: false };
    } else {
      // 点赞
      await db.collection('reviewLikes').add({
        data: {
          reviewId: reviewId,
          userId: openid,
          createTime: db.serverDate()
        }
      });
      await db.collection('reviews').doc(reviewId).update({
        data: { likeCount: _.inc(1) }
      });
      return { success: true, liked: true };
    }
  } catch (err) {
    console.error('toggleLike error:', err);
    return { success: false, error: err.message };
  }
};
