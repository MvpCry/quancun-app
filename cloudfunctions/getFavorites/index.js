// cloudfunctions/getFavorites/index.js - 获取收藏列表
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const { action = 'list', type, targetId } = event;

  try {
    switch (action) {
      case 'check': {
        // 检查是否已收藏
        const existRes = await db.collection('favorites')
          .where({
            userId: openid,
            type,
            targetId
          })
          .get();

        return {
          isFavorited: existRes.data.length > 0
        };
      }

      case 'list': {
        // 获取收藏列表
        let query = db.collection('favorites')
          .where({ userId: openid });

        if (type) {
          query = query.where({ type });
        }

        const res = await query
          .orderBy('createTime', 'desc')
          .get();

        // 补充收藏项的详细信息
        const list = [];
        for (const fav of res.data) {
          try {
            const collection = fav.type === 'attraction' ? 'attractions' : 'routes';
            const detailRes = await db.collection(collection)
              .doc(fav.targetId)
              .get();

            if (detailRes.data) {
              list.push({
                ...detailRes.data,
                _favId: fav._id,
                favType: fav.type,
                createTime: fav.createTime
              });
            }
          } catch (e) {
            // 如果目标已被删除，跳过
            console.log('收藏项不存在:', fav.targetId);
          }
        }

        return { list };
      }

      default:
        return { error: '未知操作' };
    }
  } catch (err) {
    console.error('getFavorites error:', err);
    return { error: err.message, list: [] };
  }
};
