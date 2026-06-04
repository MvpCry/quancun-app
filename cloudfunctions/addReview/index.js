// cloudfunctions/addReview/index.js
// 评价发布：微信 msgSecCheck v2 内容校验 + 阶梯违规管控 + 7天单村限频
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// ==========================================
//  微信 msgSecCheck v2 内容审核
// ==========================================
async function checkMsgSec(content, openid) {
  try {
    var result = await cloud.openapi.security.msgSecCheck({
      version: 2,
      scene: 2,           // 2 = 评论场景
      content: content,
      openid: openid
    });
    // errcode === 0 表示通过，87014 表示命中违规
    if (result && result.errcode !== 87014) {
      return { blocked: false };
    }
    return { blocked: true, errcode: result.errcode, errMsg: result.errmsg };
  } catch (err) {
    // msgSecCheck 调用失败时降级放行（避免阻塞正常用户）
    console.warn('[addReview] msgSecCheck 调用异常，降级放行:', err.errMsg || err.message);
    return { blocked: false, degraded: true };
  }
}

// ==========================================
//  违规次数统计（今日 / 近7天）
// ==========================================
async function getViolationCounts(openid) {
  var now = new Date();
  var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    var [todayRes, weekRes] = await Promise.all([
      db.collection('violationRecords')
        .where({ userId: openid, createTime: _.gte(todayStart) })
        .count(),
      db.collection('violationRecords')
        .where({ userId: openid, createTime: _.gte(sevenDaysAgo) })
        .count()
    ]);
    return { today: todayRes.total, week: weekRes.total };
  } catch (e) {
    return { today: 0, week: 0 };
  }
}

// ==========================================
//  检查是否有生效中的禁言惩罚
// ==========================================
async function getActiveBan(openid) {
  try {
    var now = new Date();
    var res = await db.collection('userBans')
      .where({
        userId: openid,
        expiresAt: _.gte(now)
      })
      .orderBy('expiresAt', 'desc')
      .limit(1)
      .get();
    return res.data.length > 0 ? res.data[0] : null;
  } catch (e) {
    return null;
  }
}

// ==========================================
//  7天内是否已对该景点发表评价
// ==========================================
async function hasRecentReview(openid, attractionId) {
  var sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  try {
    var res = await db.collection('reviews')
      .where({
        userId: openid,
        attractionId: attractionId,
        createTime: _.gte(sevenDaysAgo)
      })
      .count();
    return res.total > 0;
  } catch (e) {
    return false;
  }
}

// ==========================================
//  记录违规
// ==========================================
async function recordViolation(openid, attractionId, content, hitInfo, source) {
  try {
    await db.collection('violationRecords').add({
      data: {
        userId: openid,
        attractionId: attractionId,
        content: content.substring(0, 100),
        hitWord: hitInfo,
        source: source,  // 'msgSecCheck'
        createTime: db.serverDate()
      }
    });
  } catch (e) {
    console.error('记录违规失败:', e);
  }
}

// ==========================================
//  阶梯惩罚：累计 3 次/天→禁当日；5 次/周→冻 7 天
// ==========================================
async function applyPunishment(openid) {
  try {
    var counts = await getViolationCounts(openid);
    var now = new Date();

    if (counts.today >= 3) {
      var tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      await upsertBan(openid, 'day', tomorrow, '当日累计违规' + counts.today + '次');
    }

    if (counts.week >= 5) {
      var sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      await upsertBan(openid, 'week', sevenDaysLater, '7日内累计违规' + counts.week + '次');
    }
  } catch (e) {
    console.error('应用惩罚失败:', e);
  }
}

// ==========================================
//  写入/更新禁言记录
// ==========================================
async function upsertBan(openid, type, expiresAt, reason) {
  try {
    var existRes = await db.collection('userBans')
      .where({ userId: openid })
      .get();
    if (existRes.data.length > 0) {
      await db.collection('userBans')
        .doc(existRes.data[0]._id)
        .update({
          data: {
            type: type,
            expiresAt: expiresAt,
            reason: reason,
            updateTime: db.serverDate()
          }
        });
    } else {
      await db.collection('userBans').add({
        data: {
          userId: openid,
          type: type,
          expiresAt: expiresAt,
          reason: reason,
          createTime: db.serverDate()
        }
      });
    }
  } catch (e) {
    console.error('写入禁言记录失败:', e);
  }
}

// ==========================================
//  主入口
// ==========================================
exports.main = async (event, context) => {
  var wxContext = cloud.getWXContext();
  var openid = wxContext.OPENID;

  // ========== 登录门禁 ==========
  if (!openid) {
    return { success: false, error: '请先微信授权登录后再发表评价', code: 'NOT_LOGIN' };
  }

  var { attractionId, rating = 5, content, images = [] } = event;

  // ========== 参数校验 ==========
  if (!attractionId) return { success: false, error: '缺少景点ID', code: 'INVALID_PARAM' };
  if (!content || content.trim().length < 2) return { success: false, error: '评价内容至少2个字', code: 'TOO_SHORT' };
  if (content.trim().length > 500) return { success: false, error: '评价内容最多500字', code: 'TOO_LONG' };
  if (rating < 1 || rating > 5) return { success: false, error: '评分需在1-5之间', code: 'INVALID_RATING' };

  var cleanContent = content.trim();

  try {
    // ========== 0. 禁言检查 ==========
    var activeBan = await getActiveBan(openid);
    if (activeBan) {
      var banUntil = new Date(activeBan.expiresAt);
      var banHours = Math.ceil((banUntil - new Date()) / (1000 * 60 * 60));
      var banMsg = activeBan.type === 'day'
        ? '你今日违规次数已达上限，请明天再试'
        : '你近期违规次数已达上限，评论功能已被冻结' + banHours + '小时';
      return { success: false, error: banMsg, code: 'BANNED' };
    }

    // ========== ① 微信 msgSecCheck v2 内容审核 ==========
    var msgResult = await checkMsgSec(cleanContent, openid);
    if (msgResult.blocked) {
      await recordViolation(openid, attractionId, cleanContent, 'msgSecCheck:' + (msgResult.errcode || 'unknown'), 'msgSecCheck');
      await applyPunishment(openid);
      console.warn('[addReview] msgSecCheck 拦截 openid=' + openid + ' errcode=' + msgResult.errcode);
      return {
        success: false,
        error: '评论包含违规内容，请修改后发布',
        code: 'CONTENT_UNSAFE'
      };
    }

    // ========== ② 7天内单村限频 ==========
    var alreadyReviewed = await hasRecentReview(openid, attractionId);
    if (alreadyReviewed) {
      return {
        success: false,
        error: '7天内已对该景点发表过评价，请勿重复提交',
        code: 'RATE_LIMITED'
      };
    }

    // ========== ③ 获取用户实名信息 ==========
    var userRes = await db.collection('users')
      .where({ _openid: openid })
      .get();
    var userInfo = userRes.data[0] || {};

    // ========== ④ 写入评价（合规评价直接上架） ==========
    await db.collection('reviews').add({
      data: {
        attractionId: attractionId,
        userId: openid,
        userName: userInfo.nickName || '微信用户',
        avatarUrl: userInfo.avatarUrl || '',
        rating: rating,
        content: cleanContent,
        images: images,
        createTime: db.serverDate()
      }
    });

    // ========== ⑤ 更新景点平均评分 ==========
    var reviewsRes = await db.collection('reviews')
      .where({ attractionId: attractionId })
      .get();
    var reviews = reviewsRes.data;
    var totalRating = 0;
    for (var i = 0; i < reviews.length; i++) { totalRating += reviews[i].rating; }
    var avgRating = Math.round((totalRating / reviews.length) * 10) / 10;

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
    return { success: false, error: '发布失败，请稍后重试', code: 'SERVER_ERROR' };
  }
};
