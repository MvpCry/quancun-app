// cloudfunctions/checkContent/index.js
// 调用微信内容安全 API v2 校验文本（评论场景）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { content, openid } = event;

  if (!content || content.trim().length < 2) {
    return { isSafe: false, errMsg: '内容过短' };
  }

  try {
    const res = await cloud.openapi.security.msgSecCheck({
      version: 2,
      scene: 2,           // 2 = 评论场景
      content: content.trim(),
      openid: openid      // 用户的 openid
    });

    // errcode === 0 表示通过，87014 表示命中违规
    return {
      isSafe: res.errcode !== 87014,
      errcode: res.errcode || 0,
      errMsg: res.errmsg || ''
    };
  } catch (err) {
    // openapi 调用失败时降级放行（避免阻塞正常用户）
    console.error('[checkContent] msgSecCheck 调用异常:', err.errMsg || err.message);
    return {
      isSafe: true,
      degraded: true,
      errMsg: err.errMsg || err.message
    };
  }
};
