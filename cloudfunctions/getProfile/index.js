// cloudfunctions/getProfile/index.js - 获取用户信息和统计
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const { action = 'profile', userInfo, content } = event;

  switch (action) {
    case 'profile':
      // 更新或创建用户信息（upsert：先查后决定 add 或 update）
      if (userInfo) {
        var existRes = await db.collection('users')
          .where({ _openid: openid })
          .get();

        if (existRes.data.length > 0) {
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

      var userRes = await db.collection('users')
        .where({ _openid: openid })
        .get();

      return {
        userInfo: userRes.data[0] || null
      };

    case 'stats':
      var statsRes = await Promise.all([
        db.collection('favorites').where({ userId: openid }).count(),
        db.collection('routes').where({ _openid: openid }).count(),
        db.collection('reviews').where({ userId: openid }).count()
      ]);

      return {
        favoriteCount: statsRes[0].total,
        routeCount: statsRes[1].total,
        reviewCount: statsRes[2].total
      };

    case 'addFeedback':
      if (!content) return { success: false, error: '内容为空' };
      await db.collection('feedback').add({
        data: {
          _openid: openid,
          content: content,
          createTime: db.serverDate()
        }
      });
      return { success: true };

    case 'deleteAccount':
      var result = { reviews: 0, favorites: 0, routes: 0, user: 0 };

      try {
        var revRes = await db.collection('reviews').where({ userId: openid }).get();
        for (var i = 0; i < revRes.data.length; i++) {
          await db.collection('reviews').doc(revRes.data[i]._id).remove();
        }
        result.reviews = revRes.data.length;
      } catch (e) { result.reviews = -1; }

      try {
        var favRes = await db.collection('favorites').where({ userId: openid }).get();
        for (var j = 0; j < favRes.data.length; j++) {
          await db.collection('favorites').doc(favRes.data[j]._id).remove();
        }
        result.favorites = favRes.data.length;
      } catch (e) { result.favorites = -1; }

      try {
        var rteRes = await db.collection('routes').where({ _openid: openid }).get();
        for (var k = 0; k < rteRes.data.length; k++) {
          await db.collection('routes').doc(rteRes.data[k]._id).remove();
        }
        result.routes = rteRes.data.length;
      } catch (e) { result.routes = -1; }

      try {
        var usrRes = await db.collection('users').where({ _openid: openid }).get();
        if (usrRes.data.length > 0) {
          await db.collection('users').doc(usrRes.data[0]._id).remove();
          result.user = 1;
        }
      } catch (e) { result.user = -1; }

      return { success: true, deleted: result };

    default:
      return { error: '未知操作' };
  }
};
