// cloudfunctions/addReview/index.js
// 评价发布：微信 msgSecCheck v2 内容校验 + 阶梯违规管控 + 7天单村限频
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const https = require('https');

// ==========================================
//  自定义敏感词检查
// ==========================================
async function checkBannedWords(content) {
  try {
    var res = await db.collection('bannedWords')
      .where({ active: true })
      .get();
    var words = res.data;
    var lowerContent = content.toLowerCase();
    for (var i = 0; i < words.length; i++) {
      if (lowerContent.indexOf(words[i].word.toLowerCase()) !== -1) {
        return { blocked: true, hitWord: words[i].word };
      }
    }
    return { blocked: false };
  } catch (e) {
    // 数据库查询失败不阻塞
    console.warn('[addReview] 敏感词查询失败:', e.message || e);
    return { blocked: false };
  }
}

// ==========================================
//  微信 msgSecCheck v2 内容审核
//  策略：cloud.openapi → HTTP 直调 → 拒发
// ==========================================
async function checkMsgSec(content, openid) {
  // 方案 1: cloud.openapi v2
  try {
    var result = await cloud.openapi.security.msgSecCheck({
      version: 2,
      scene: 2,
      content: content,
      openid: openid
    });
    // v2 API: errcode===0 表示调用成功，实际判罚在 result.suggest
    // suggest: "pass"=通过, "risky"=违规, "review"=存疑
    if (result && result.errcode === 0) {
      var suggest = (result.result && result.result.suggest) || 'pass';
      if (suggest === 'risky' || suggest === 'review') {
        return { blocked: true, suggest: suggest, label: result.result && result.result.label, _path: 'openapi-block' };
      }
      return { blocked: false, _path: 'openapi-ok' };
    }
    // errcode !== 0 或返回异常 → 降级到 HTTP 直调
    throw new Error('msgSecCheck 返回异常: errcode=' + (result && result.errcode) + ' errmsg=' + (result && result.errmsg));
  } catch (err) {
    console.warn('[addReview] cloud.openapi 失败，尝试 HTTP 直调:', err.errMsg || err.message);
  }

  // 方案 2: HTTP 直调微信服务端 API
  try {
    var appid = cloud.getWXContext().APPID;
    var secret = process.env.WX_APPSECRET || '';
    if (!appid || !secret) {
      throw new Error('未配置 WX_APPSECRET 环境变量');
    }
    var token = await getAccessToken(appid, secret);
    var httpResult = await msgSecCheckHttp(content, openid, token);
    httpResult._path = 'http-' + (httpResult.blocked ? 'block' : 'ok');
    return httpResult;
  } catch (err2) {
    console.warn('[addReview] HTTP 直调失败:', err2.message || err2);
  }

  // 方案 3: 全部失败 → 拒绝发布（fail-closed）
  console.error('[addReview] 内容安全检测全部方案失败，拒绝发布');
  return { blocked: false, degraded: true, serviceDown: true, _path: 'all-failed' };
}

// ---------- 获取 access_token ----------
function getAccessToken(appid, secret) {
  return new Promise(function (resolve, reject) {
    var url = 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=' + appid + '&secret=' + secret;
    https.get(url, function (res) {
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        try {
          var json = JSON.parse(data);
          if (json.access_token) {
            resolve(json.access_token);
          } else {
            reject(new Error('获取access_token失败: ' + (json.errmsg || 'unknown')));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// ---------- HTTP 直调 msgSecCheck v2 ----------
function msgSecCheckHttp(content, openid, accessToken) {
  return new Promise(function (resolve, reject) {
    var postData = JSON.stringify({ version: 2, scene: 2, content: content, openid: openid });
    var url = 'https://api.weixin.qq.com/wxa/msg_sec_check?access_token=' + accessToken;
    var req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    }, function (res) {
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        try {
          var json = JSON.parse(data);
          if (json.errcode === 0) {
            var suggest = (json.result && json.result.suggest) || 'pass';
            if (suggest === 'risky' || suggest === 'review') {
              resolve({ blocked: true, suggest: suggest, label: json.result && json.result.label });
            } else {
              resolve({ blocked: false });
            }
          } else {
            reject(new Error('msgSecCheck返回异常: ' + (json.errmsg || 'errcode=' + json.errcode)));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
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

    // ========== ① 自定义敏感词检查 ==========
    var bannedResult = await checkBannedWords(cleanContent);
    if (bannedResult.blocked) {
      await recordViolation(openid, attractionId, cleanContent, 'bannedWord:' + bannedResult.hitWord, 'bannedWords');
      await applyPunishment(openid);
      console.warn('[addReview] 敏感词拦截 openid=' + openid + ' hitWord=' + bannedResult.hitWord);
      return {
        success: false,
        error: '评论包含违规内容，请修改后发布',
        code: 'CONTENT_UNSAFE',
        _v: 3, _path: 'bannedWords-block'
      };
    }

    // ========== ② 微信 msgSecCheck v2 内容审核 ==========
    var msgResult = await checkMsgSec(cleanContent, openid);
    if (msgResult.blocked) {
      await recordViolation(openid, attractionId, cleanContent, 'msgSecCheck:' + (msgResult.errcode || 'unknown'), 'msgSecCheck');
      await applyPunishment(openid);
      console.warn('[addReview] msgSecCheck 拦截 openid=' + openid + ' errcode=' + msgResult.errcode);
      return {
        success: false,
        error: '评论包含违规内容，请修改后发布',
        code: 'CONTENT_UNSAFE',
        _v: 3, _path: msgResult._path || ''
      };
    }
    if (msgResult.serviceDown) {
      return {
        success: false,
        error: '内容安全检测服务暂时不可用，请稍后重试',
        code: 'SERVICE_DOWN',
        _v: 3, _path: msgResult._path || ''
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

    return { success: true, _v: 3, _path: msgResult._path || '' };
  } catch (err) {
    console.error('addReview error:', err);
    return { success: false, error: '发布失败，请稍后重试', code: 'SERVER_ERROR', _v: 3 };
  }
};
