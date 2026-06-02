// cloudfunctions/getReviews/index.js - 获取评论列表
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const {
    action = 'list',
    attractionId,
    page = 1,
    pageSize = 10
  } = event;

  try {
    switch (action) {
      case 'list': {
        if (!attractionId) {
          return { error: '缺少景点ID' };
        }

        const skip = (page - 1) * pageSize;

        const countRes = await db.collection('reviews')
          .where({ attractionId })
          .count();

        const res = await db.collection('reviews')
          .where({ attractionId })
          .orderBy('createTime', 'desc')
          .skip(skip)
          .limit(pageSize)
          .get();

        return {
          list: res.data,
          total: countRes.total,
          page,
          pageSize,
          hasMore: skip + pageSize < countRes.total
        };
      }

      case 'myReviews': {
        // 获取当前用户的评论
        const res = await db.collection('reviews')
          .where({ userId: openid })
          .orderBy('createTime', 'desc')
          .get();

        // 尝试补充景点名称
        const list = [];
        for (const review of res.data) {
          try {
            const attrRes = await db.collection('attractions')
              .doc(review.attractionId)
              .field({ name: true })
              .get();
            list.push({
              ...review,
              attractionName: attrRes.data ? attrRes.data.name : '未知景点'
            });
          } catch (e) {
            list.push({
              ...review,
              attractionName: '未知景点'
            });
          }
        }

        return { list };
      }

      default:
        return { error: '未知操作' };
    }
  } catch (err) {
    console.error('getReviews error:', err);
    return { error: err.message, list: [], total: 0 };
  }
};
