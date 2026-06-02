// cloudfunctions/getAttractionDetail/index.js - 获取景点详情（含关联数据）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { id } = event;

  if (!id) {
    return { error: '缺少景点ID' };
  }

  try {
    // 获取景点详情
    const attractionRes = await db.collection('attractions')
      .doc(id)
      .get();

    const attraction = attractionRes.data;

    if (!attraction) {
      return { error: '景点不存在' };
    }

    // 获取评论统计
    const reviewCountRes = await db.collection('reviews')
      .where({ attractionId: id })
      .count();

    // 获取最新3条评论
    const recentReviewsRes = await db.collection('reviews')
      .where({ attractionId: id })
      .orderBy('createTime', 'desc')
      .limit(3)
      .get();

    // 获取包含此景点的路线数
    const routeCountRes = await db.collection('routes')
      .where({
        'attractions.attractionId': id
      })
      .count();

    return {
      attraction: {
        ...attraction,
        reviewCount: reviewCountRes.total,
        routeCount: routeCountRes.total
      },
      recentReviews: recentReviewsRes.data
    };
  } catch (err) {
    console.error('getAttractionDetail error:', err);
    return { error: err.message };
  }
};
