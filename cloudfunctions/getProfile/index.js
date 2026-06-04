// cloudfunctions/getProfile/index.js - 获取用户信息和统计
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const { action = 'profile', userInfo } = event;

  switch (action) {
    case 'profile':
      // 更新或创建用户信息（upsert：先查后决定 add 或 update）
      if (userInfo) {
        var existRes = await db.collection('users')
          .where({ _openid: openid })
          .get();

        if (existRes.data.length > 0) {
          // 已有记录 → 更新
          await db.collection('users')
            .doc(existRes.data[0]._id)
            .update({
              data: {
                nickName: userInfo.nickName || '',
                avatarUrl: userInfo.avatarUrl || '',
                updateTime: db.serverDate()
              }
            });
        } else {
          // 新用户 → 创建
          await db.collection('users').add({
            data: {
              _openid: openid,
              nickName: userInfo.nickName || '',
              avatarUrl: userInfo.avatarUrl || '',
              createTime: db.serverDate()
            }
          });
        }
      }

      // 获取用户信息
      const userRes = await db.collection('users')
        .where({ _openid: openid })
        .get();

      return {
        userInfo: userRes.data[0] || null
      };

    case 'stats':
      // 获取用户统计数据
      const [favCount, routeCount, reviewCount] = await Promise.all([
        db.collection('favorites').where({ userId: openid }).count(),
        db.collection('routes').where({ _openid: openid }).count(),
        db.collection('reviews').where({ userId: openid }).count()
      ]);

      return {
        favoriteCount: favCount.total,
        routeCount: routeCount.total,
        reviewCount: reviewCount.total
      };

    default:
      return { error: '未知操作' };
  }
};
