// cloudfunctions/reportReview/index.js - 用户举报评论
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// 举报类型
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
    // 检查是否已举报过同一条评论（reports 集合可能还不存在，兼容处理）
    var existRes = null;
    try {
      existRes = await db.collection('reports')
        .where({
          reviewId: reviewId,
          reporterId: openid
        })
        .count();
    } catch (e) {
      // reports 集合可能尚未创建，不报错继续
      console.warn('[reportReview] 查询已举报记录失败（集合可能不存在）:', e.message || e.errMsg);
    }

    if (existRes && existRes.total > 0) {
      return { success: false, error: '你已举报过该评论' };
    }

    // 获取评论信息
    var review = null;
    try {
      var reviewRes = await db.collection('reviews').doc(reviewId).get();
      review = reviewRes.data;
    } catch (e) {
      console.warn('[reportReview] 获取评论信息失败:', e.message || e.errMsg);
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
          // 冗余保存评论快照，方便运营后台查看
          reviewSnapshot: {
            content: review.content,
            userName: review.userName,
            attractionId: review.attractionId
          },
          status: 'pending',  // pending | handled | dismissed
          createTime: db.serverDate()
        }
      });
    } catch (e) {
      console.error('[reportReview] 写入举报记录失败:', e.message || e.errMsg);
      return { success: false, error: '举报写入失败，请检查 reports 集合是否已在云数据库中创建' };
    }

    // 标记评论为被举报状态
    try {
      await db.collection('reviews')
        .doc(reviewId)
        .update({
          data: {
            reportCount: _.inc(1),
            reportedAt: db.serverDate()
          }
        });
    } catch (e) {
      // 更新失败不影响举报（已写入 reports）
      console.warn('[reportReview] 更新评论举报计数失败:', e.message || e.errMsg);
    }

    return { success: true, message: '举报已提交，运营团队将尽快处理' };
  } catch (err) {
    console.error('reportReview error:', err);
    return { success: false, error: '举报失败: ' + (err.message || err.errMsg || '未知错误') };
  }
};
