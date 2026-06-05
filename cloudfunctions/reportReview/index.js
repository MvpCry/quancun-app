// cloudfunctions/reportReview/index.js - 用户举报评论
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const REPORT_TYPES = {
  abuse: '辱骂脏话',
  defamation: '恶意抹黑'
};

exports.main = async (event, context) => {
  var wxContext = cloud.getWXContext();
  var openid = wxContext.OPENID;

  if (!openid) {
    return { success: false, error: '请先登录' };
  }

  var { reviewId, reportType } = event;

  if (!reviewId) {
    return { success: false, error: '缺少评论ID' };
  }

  if (!reportType || !REPORT_TYPES[reportType]) {
    return { success: false, error: '请选择举报类型' };
  }

  try {
    // 检查是否已举报
    var alreadyReported = false;
    try {
      var existRes = await db.collection('reports')
        .where({ reviewId: reviewId, reporterId: openid })
        .count();
      alreadyReported = existRes.total > 0;
    } catch (e) {
      // reports 集合可能还不存在，继续
    }

    if (alreadyReported) {
      return { success: false, error: '你已举报过该评论' };
    }

    // 获取评论信息
    var review = null;
    try {
      var reviewRes = await db.collection('reviews').doc(reviewId).get();
      review = reviewRes.data;
    } catch (e) {
      // 评论获取失败
    }

    if (!review) {
      return { success: false, error: '评论不存在或已被删除' };
    }

    // 写入举报记录
    try {
      await db.collection('reports').add({
        data: {
          reviewId: reviewId,
          reporterId: openid,
          reportType: reportType,
          reportTypeLabel: REPORT_TYPES[reportType],
          reviewSnapshot: {
            content: review.content || '',
            userName: review.userName || '',
            attractionId: review.attractionId || ''
          },
          status: 'pending',
          createTime: db.serverDate()
        }
      });
    } catch (e) {
      // reports 集合不存在时，尝试第一次写入会自动创建；若仍失败则明确提示
      return { success: false, error: '举报写入失败。请先在云开发控制台 → 数据库 → 创建「reports」集合，然后重试。' };
    }

    // 更新评论举报计数（失败不影响）
    try {
      await db.collection('reviews').doc(reviewId).update({
        data: {
          reportCount: _.inc(1),
          reportedAt: db.serverDate()
        }
      });
    } catch (e) {
      // 忽略
    }

    return { success: true, message: '举报已提交，运营团队将尽快处理' };
  } catch (err) {
    console.error('reportReview error:', err);
    return { success: false, error: '举报失败: ' + (err.message || '未知错误') };
  }
};
