// cloudfunctions/adminAttractions/index.js - 后台：景点CRUD管理
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { action, data } = event;

  try {
    switch (action) {
      case 'create': {
        // 新增景点
        const addRes = await db.collection('attractions').add({
          data: {
            ...data,
            rating: 0,
            reviewCount: 0,
            createTime: db.serverDate(),
            updateTime: db.serverDate()
          }
        });
        return { success: true, id: addRes._id };
      }

      case 'update': {
        // 更新景点
        const { id, ...updateData } = data;
        await db.collection('attractions')
          .doc(id)
          .update({
            data: {
              ...updateData,
              updateTime: db.serverDate()
            }
          });
        return { success: true };
      }

      case 'delete': {
        // 删除景点
        await db.collection('attractions')
          .doc(data.id)
          .remove();
        return { success: true };
      }

      case 'uploadImage': {
        // 上传图片到云存储
        // 注意：图片上传应该在小程序端使用 wx.cloud.uploadFile 完成
        // 此函数用于获取上传后的 fileID 并记录
        return { success: true };
      }

      case 'batchImport': {
        // 批量导入景点
        if (!data || !data.list || data.list.length === 0) {
          return { error: '导入数据为空' };
        }

        const tasks = data.list.map(item => ({
          ...item,
          rating: 0,
          reviewCount: 0,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }));

        // 批量添加（云开发限制每次最多1000条）
        const results = [];
        for (let i = 0; i < tasks.length; i += 100) {
          const batch = tasks.slice(i, i + 100);
          // 逐条添加（简单方式）
          for (const item of batch) {
            const addRes = await db.collection('attractions').add({ data: item });
            results.push(addRes._id);
          }
        }

        return { success: true, count: results.length, ids: results };
      }

      default:
        return { error: '未知操作' };
    }
  } catch (err) {
    console.error('adminAttractions error:', err);
    return { error: err.message };
  }
};
