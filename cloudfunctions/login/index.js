// cloudfunctions/login/index.js - 用户登录，获取openid
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  const openid = wxContext.OPENID;

  // 检查用户是否已存在
  const userRes = await db.collection('users')
    .where({ _openid: openid })
    .get();

  // 新用户则创建记录
  if (userRes.data.length === 0) {
    await db.collection('users').add({
      data: {
        _openid: openid,
        nickName: '',
        avatarUrl: '',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    });
  }

  return {
    openid,
    isNewUser: userRes.data.length === 0
  };
};
