// cloudfunctions/manageBanners/index.js - 首页轮播Banner管理
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

async function checkAdmin(openid) {
  if (!openid) return false;
  try {
    var res = await db.collection('admins').where({ openid: openid, active: true }).count();
    return res.total > 0;
  } catch (e) { return false; }
}

exports.main = async (event, context) => {
  var wxContext = cloud.getWXContext();
  var openid = wxContext.OPENID;

  // 客户端读取：从 attractions 集合 isBanner 字段读取
  if (event.action === 'list') {
    try {
      var res = await db.collection('attractions')
        .where({ isBanner: true })
        .orderBy('createTime', 'desc')
        .limit(10)
        .get();
      var list = res.data.map(function (item) {
        return {
          id: item._id,
          type: 'attraction',
          image: (item.images && item.images[0]) ? item.images[0] : '',
          title: item.name || '',
          desc: item.introduction ? item.introduction.substring(0, 40) + '...' : ''
        };
      });
      return { list: list };
    } catch (err) {
      return { list: [] };
    }
  }

  // 管理操作需要鉴权
  var isAdmin = await checkAdmin(openid);
  if (!isAdmin) {
    return { success: false, error: '无管理员权限', code: 'FORBIDDEN' };
  }

  var { action, data } = event;

  try {
    switch (action) {

      case 'adminList': {
        var res = await db.collection('banners')
          .orderBy('order', 'asc')
          .limit(20)
          .get();
        return { list: res.data, total: res.data.length };
      }

      case 'add': {
        var addRes = await db.collection('banners').add({
          data: {
            image: data.image || '',
            title: data.title || '',
            desc: data.desc || '',
            linkType: data.linkType || 'attraction',
            linkId: data.linkId || '',
            order: data.order || 0,
            active: true,
            createTime: db.serverDate()
          }
        });
        return { success: true, id: addRes._id };
      }

      case 'update': {
        var { id, ...updateData } = data;
        await db.collection('banners').doc(id).update({
          data: { ...updateData, updateTime: db.serverDate() }
        });
        return { success: true };
      }

      case 'toggle': {
        var item = await db.collection('banners').doc(data.id).get();
        var newVal = !item.data.active;
        await db.collection('banners').doc(data.id).update({
          data: { active: newVal, updateTime: db.serverDate() }
        });
        return { success: true, active: newVal };
      }

      case 'delete': {
        await db.collection('banners').doc(data.id).remove();
        return { success: true };
      }

      case 'reorder': {
        // 批量更新排序
        var items = data.items || [];
        for (var i = 0; i < items.length; i++) {
          await db.collection('banners').doc(items[i].id).update({
            data: { order: items[i].order }
          });
        }
        return { success: true };
      }

      default:
        return { success: false, error: '未知操作: ' + action };
    }
  } catch (err) {
    console.error('manageBanners error:', err);
    return { success: false, error: err.message };
  }
};
