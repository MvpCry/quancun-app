// cloudfunctions/saveRoute/index.js - 保存路线
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const {
    name,
    description,
    attractions,
    totalDistance,
    estimatedTime,
    coverImage,
    tags = []
  } = event;

  // 参数校验
  if (!name || !attractions || attractions.length < 2) {
    return { error: '请填写路线名称并至少包含2个景点' };
  }

  try {
    // 如果没传封面图，使用第一个景点的主图
    let cover = coverImage;
    if (!cover && attractions.length > 0) {
      // 尝试获取第一个景点的图片作为封面
      const firstAttractionId = attractions[0].attractionId;
      const attrRes = await db.collection('attractions')
        .doc(firstAttractionId)
        .field({ images: true })
        .get();

      if (attrRes.data && attrRes.data.images && attrRes.data.images.length > 0) {
        cover = attrRes.data.images[0];
      }
    }

    const addRes = await db.collection('routes').add({
      data: {
        _openid: openid,
        name,
        description: description || `${name} - ${attractions.length}个景点`,
        attractions: attractions.map((stop, index) => ({
          attractionId: stop.attractionId,
          order: stop.order !== undefined ? stop.order : index,
          name: stop.name,
          location: stop.location || null
        })),
        totalDistance: totalDistance || 0,
        estimatedTime: estimatedTime || 0,
        coverImage: cover || '',
        tags,
        likeCount: 0,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    });

    return {
      success: true,
      routeId: addRes._id
    };
  } catch (err) {
    console.error('saveRoute error:', err);
    return { error: err.message };
  }
};
