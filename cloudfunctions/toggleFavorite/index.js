// cloudfunctions/toggleFavorite/index.js - 收藏/取消收藏
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const { type, targetId, isFavorited } = event;

  if (!type || !targetId) {
    return { error: '参数不完整' };
  }

  try {
    if (isFavorited) {
      // 添加收藏
      // 先检查是否已收藏
      const existRes = await db.collection('favorites')
        .where({
          userId: openid,
          type,
          targetId
        })
        .get();

      if (existRes.data.length === 0) {
        await db.collection('favorites').add({
          data: {
            userId: openid,
            type,
            targetId,
            createTime: db.serverDate()
          }
        });
      }

      // 更新目标收藏数
      await updateLikeCount(type, targetId, 1);

      return { success: true, action: 'added' };
    } else {
      // 取消收藏
      await db.collection('favorites')
        .where({
          userId: openid,
          type,
          targetId
        })
        .remove();

      // 更新目标收藏数
      await updateLikeCount(type, targetId, -1);

      return { success: true, action: 'removed' };
    }
  } catch (err) {
    console.error('toggleFavorite error:', err);
    return { error: err.message };
  }
};

/**
 * 更新收藏数
 */
async function updateLikeCount(type, targetId, delta) {
  try {
    const collection = type === 'attraction' ? 'attractions' : 'routes';
    const res = await db.collection(collection).doc(targetId).get();
    if (res.data) {
      const currentCount = res.data.likeCount || 0;
      await db.collection(collection).doc(targetId).update({
        data: {
          likeCount: Math.max(0, currentCount + delta)
        }
      });
    }
  } catch (err) {
    console.error('updateLikeCount error:', err);
  }
}
