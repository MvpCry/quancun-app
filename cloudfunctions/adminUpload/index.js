// cloudfunctions/adminUpload/index.js - HTTP触发器：远程上传图片并关联到景点
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

// 校验管理员（从 HTTP headers 中取 openid，或 body 中传 adminToken）
async function checkAdmin(openid) {
  if (!openid) return false;
  try {
    const res = await db.collection('admins').where({ openid, active: true }).count();
    return res.total > 0;
  } catch (e) { return false; }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  // HTTP 触发器格式：event.body 是 JSON 字符串
  let body = event;
  if (event.body && typeof event.body === 'string') {
    try { body = JSON.parse(event.body); } catch (e) {}
  }

  const { action, name, images } = body;

  if (action === 'uploadImages') {
    if (!name) return { success: false, error: '缺少 name 参数' };
    if (!images || !Array.isArray(images) || images.length === 0) {
      return { success: false, error: '缺少 images 参数' };
    }

    const fileIDs = [];
    const errors = [];

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      try {
        const buffer = Buffer.from(img.base64, 'base64');
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const ext = (img.fileName || 'image.jpg').split('.').pop() || 'jpg';
        const cloudPath = 'attractions/' + timestamp + '_' + randomStr + '.' + ext;

        const uploadRes = await cloud.uploadFile({
          cloudPath: cloudPath,
          fileContent: buffer
        });

        fileIDs.push(uploadRes.fileID);
      } catch (err) {
        errors.push({ index: i, fileName: img.fileName, error: err.message });
      }
    }

    // 更新数据库
    if (fileIDs.length > 0) {
      try {
        const res = await db.collection('attractions').where({ name }).get();
        if (res.data && res.data.length > 0) {
          const doc = res.data[0];
          const existingImages = doc.images || [];
          const newImages = existingImages.concat(fileIDs);
          await db.collection('attractions').doc(doc._id).update({
            data: { images: newImages, updateTime: db.serverDate() }
          });
        }
      } catch (err) {
        errors.push({ error: '数据库更新失败: ' + err.message });
      }
    }

    return { success: true, fileIDs, total: images.length, uploaded: fileIDs.length, errors };
  }

  return { success: false, error: '未知操作: ' + action };
};
