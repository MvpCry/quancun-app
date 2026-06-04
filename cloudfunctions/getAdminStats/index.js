// cloudfunctions/getAdminStats/index.js - 管理后台统计数据
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  var wxContext = cloud.getWXContext();
  var openid = wxContext.OPENID;

  // ========== 管理员鉴权 ==========
  var isAdmin = await checkAdmin(openid);
  if (!isAdmin) {
    return { success: false, error: '无管理员权限，你的 openid: ' + openid, code: 'FORBIDDEN', openid: openid };
  }

  try {
    var now = new Date();
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 并行获取统计数据
    var [
      totalReviews, todayReviews, weekReviews,
      todayViolations, weekViolations,
      pendingReports, totalBannedWords,
      totalAttractions, totalRoutes, totalUsers,
      activeBans
    ] = await Promise.all([
      db.collection('reviews').count().then(r => r.total).catch(() => 0),
      db.collection('reviews').where({ createTime: _.gte(todayStart) }).count().then(r => r.total).catch(() => 0),
      db.collection('reviews').where({ createTime: _.gte(weekAgo) }).count().then(r => r.total).catch(() => 0),
      db.collection('violationRecords').where({ createTime: _.gte(todayStart) }).count().then(r => r.total).catch(() => 0),
      db.collection('violationRecords').where({ createTime: _.gte(weekAgo) }).count().then(r => r.total).catch(() => 0),
      db.collection('reports').where({ status: 'pending' }).count().then(r => r.total).catch(() => 0),
      db.collection('bannedWords').where({ active: true }).count().then(r => r.total).catch(() => 0),
      db.collection('attractions').count().then(r => r.total).catch(() => 0),
      db.collection('routes').count().then(r => r.total).catch(() => 0),
      db.collection('users').count().then(r => r.total).catch(() => 0),
      db.collection('userBans').where({ expiresAt: _.gte(now) }).count().then(r => r.total).catch(() => 0)
    ]);

    return {
      success: true,
      stats: {
        reviews: { total: totalReviews, today: todayReviews, week: weekReviews },
        violations: { today: todayViolations, week: weekViolations },
        pendingReports: pendingReports,
        bannedWords: totalBannedWords,
        attractions: totalAttractions,
        routes: totalRoutes,
        users: totalUsers,
        activeBans: activeBans
      }
    };
  } catch (err) {
    console.error('getAdminStats error:', err);
    return { success: false, error: err.message };
  }
};

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
