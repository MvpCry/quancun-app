// cloudfunctions/handleReport/index.js - 举报处理（删除评论 / 驳回举报）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  var wxContext = cloud.getWXContext();
  var openid = wxContext.OPENID;

  var { action, reportId, reviewId } = event;

  try {
    // ========== 用户自删评论（无需管理员权限） ==========
    if (action === 'deleteMyReview') {
      if (!reviewId) return { success: false, error: '缺少评论ID' };

      // 查询评论确认是本人发的
      var reviewRes;
      try {
        reviewRes = await db.collection('reviews').doc(reviewId).get();
      } catch (e) {
        return { success: false, error: '评论不存在' };
      }

      var review = reviewRes.data;
      // 非管理员用户只能删除自己的评论
      var isAdmin = await checkAdmin(openid);
      if (!isAdmin && review.userId !== openid) {
        return { success: false, error: '只能删除自己的评论', code: 'FORBIDDEN' };
      }

      await db.collection('reviews').doc(reviewId).remove();
      await recalcAttractionRating(reviewId);

      return { success: true, message: '评论已删除' };
    }

    // 以下操作需要管理员权限
    var isAdmin = await checkAdmin(openid);
    if (!isAdmin) {
      return { success: false, error: '无管理员权限', code: 'FORBIDDEN' };
    }

    switch (action) {

      // ========== 删除违规评论 ==========
      case 'deleteReview':
        if (!reviewId) return { success: false, error: '缺少评论ID' };
        if (!reportId) return { success: false, error: '缺少举报ID' };

        // 删除评论
        await db.collection('reviews').doc(reviewId).remove();

        // 标记举报为已处理
        await db.collection('reports').doc(reportId).update({
          data: {
            status: 'handled',
            handledBy: openid,
            handledAt: db.serverDate(),
            action: 'deleted'
          }
        });

        // 更新景点评分
        await recalcAttractionRating(reviewId);

        return { success: true, message: '评论已删除' };

      // ========== 仅删除评论（无关联举报时） ==========
      case 'deleteReviewOnly':
        if (!reviewId) return { success: false, error: '缺少评论ID' };

        await db.collection('reviews').doc(reviewId).remove();
        await recalcAttractionRating(reviewId);

        return { success: true, message: '评论已删除' };

      // ========== 驳回举报（评论正常） ==========
      case 'dismissReport':
        if (!reportId) return { success: false, error: '缺少举报ID' };

        await db.collection('reports').doc(reportId).update({
          data: {
            status: 'dismissed',
            handledBy: openid,
            handledAt: db.serverDate(),
            action: 'dismissed'
          }
        });

        return { success: true, message: '举报已驳回' };

      // ========== 批量处理：删除所有已标记的违规评论 ==========
      case 'batchDeleteFlagged':
        var flaggedRes = await db.collection('reviews')
          .where({ reportCount: _.gte(3) })
          .get();

        var deleted = 0;
        for (var i = 0; i < flaggedRes.data.length; i++) {
          try {
            await db.collection('reviews').doc(flaggedRes.data[i]._id).remove();
            deleted++;
          } catch (e) {
            console.error('批量删除失败:', e);
          }
        }

        // 批量更新对应举报状态
        await db.collection('reports')
          .where({ status: 'pending' })
          .update({
            data: {
              status: 'handled',
              handledBy: openid,
              handledAt: db.serverDate(),
              action: 'batch_deleted'
            }
          });

        return { success: true, message: '已删除 ' + deleted + ' 条违规评论' };

      // ========== 举报列表（管理端） ==========
      case 'listReports': {
        var page = event.page || 1;
        var pageSize = event.pageSize || 20;
        var status = event.status || 'pending';
        var skip = (page - 1) * pageSize;

        var countRes = await db.collection('reports')
          .where({ status: status })
          .count();

        var listRes = await db.collection('reports')
          .where({ status: status })
          .orderBy('createTime', 'desc')
          .skip(skip)
          .limit(pageSize)
          .get();

        // 补充被举报评论的当前内容
        var list = [];
        for (var j = 0; j < listRes.data.length; j++) {
          var rpt = listRes.data[j];
          try {
            var revRes = await db.collection('reviews')
              .doc(rpt.reviewId)
              .field({ content: true, userName: true, rating: true, attractionId: true, reportCount: true })
              .get();
            rpt.currentReview = revRes.data || null;
          } catch (e) {
            rpt.currentReview = rpt.reviewSnapshot || null;
          }
          list.push(rpt);
        }

        return {
          list: list,
          total: countRes.total,
          page: page,
          hasMore: skip + pageSize < countRes.total
        };
      }

      // ========== 违规记录列表 ==========
      case 'listViolations': {
        var vPage = event.page || 1;
        var vPageSize = event.pageSize || 20;
        var vSkip = (vPage - 1) * vPageSize;

        var vCountRes = await db.collection('violationRecords').count();
        var vListRes = await db.collection('violationRecords')
          .orderBy('createTime', 'desc')
          .skip(vSkip)
          .limit(vPageSize)
          .get();

        return {
          list: vListRes.data,
          total: vCountRes.total,
          page: vPage,
          hasMore: vSkip + vPageSize < vCountRes.total
        };
      }

      // ========== 禁言用户列表 ==========
      case 'listBans': {
        var bansRes = await db.collection('userBans')
          .orderBy('createTime', 'desc')
          .limit(50)
          .get();
        return { list: bansRes.data };
      }

      // ========== 解除禁言 ==========
      case 'liftBan':
        if (!event.banId) return { success: false, error: '缺少禁言记录ID' };
        await db.collection('userBans').doc(event.banId).update({
          data: { expiresAt: new Date(), updateTime: db.serverDate() }
        });
        return { success: true, message: '已解除禁言' };

      default:
        return { success: false, error: '未知操作: ' + action };
    }
  } catch (err) {
    console.error('handleReport error:', err);
    return { success: false, error: err.message };
  }
};

// ========== 重新计算景点评分 ==========
async function recalcAttractionRating(reviewId) {
  try {
    var reviewRes = await db.collection('reviews').doc(reviewId).get();
    if (!reviewRes.data) return;
    var attractionId = reviewRes.data.attractionId;
    if (!attractionId) return;

    var allRes = await db.collection('reviews')
      .where({ attractionId: attractionId })
      .get();
    var reviews = allRes.data;
    var totalRating = 0;
    for (var i = 0; i < reviews.length; i++) { totalRating += reviews[i].rating; }
    var avgRating = reviews.length > 0 ? Math.round((totalRating / reviews.length) * 10) / 10 : 0;

    await db.collection('attractions')
      .doc(attractionId)
      .update({
        data: {
          rating: avgRating,
          reviewCount: reviews.length,
          updateTime: db.serverDate()
        }
      });
  } catch (e) {
    console.error('重算评分失败:', e);
  }
}

async function checkAdmin(openid) {
  if (!openid) return false;
  try {
    var res = await db.collection('admins')
      .where({ openid: openid, active: true })
      .count();
    return res.total > 0;
  } catch (e) {
    return false;
  }
}
