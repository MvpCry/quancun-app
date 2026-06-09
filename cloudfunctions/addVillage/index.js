// cloudfunctions/addVillage/index.js
// 向云数据库添加景点（无需管理员鉴权，供批量导入使用）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event, context) => {
  const { name, introduction, description, address, category, tags,
          openTime, ticketPrice, isBanner, featured, images } = event;

  if (!name || !name.trim()) {
    return { success: false, error: '缺少景点名称' };
  }

  try {
    // 检查是否已存在同名景点
    const existRes = await db.collection('attractions')
      .where({ name: name.trim() })
      .count();
    if (existRes.total > 0) {
      return { success: false, error: '景点「' + name + '」已存在，跳过导入' };
    }

    const doc = {
      name: name.trim(),
      introduction: introduction || description || '',
      description: description || introduction || '',
      address: address || '',
      category: category || 'rural',
      tags: tags || [],
      images: images || [],
      openTime: openTime || '全天',
      ticketPrice: typeof ticketPrice === 'number' ? ticketPrice : 0,
      isBanner: !!isBanner,
      featured: !!featured,
      location: null,
      rating: 0,
      reviewCount: 0,
      likeCount: 0,
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    };

    const addRes = await db.collection('attractions').add({ data: doc });

    return {
      success: true,
      message: '已添加景点: ' + name,
      _id: addRes._id
    };
  } catch (err) {
    console.error('addVillage error:', err);
    return { success: false, error: err.message };
  }
};
