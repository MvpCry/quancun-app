// cloudfunctions/adminRoutes/index.js - 后台：路线CRUD管理
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

  if (!await checkAdmin(openid)) {
    return { success: false, error: '无管理员权限', code: 'FORBIDDEN' };
  }

  var { action, data } = event;

  try {
    switch (action) {

      case 'list': {
        var page = (data && data.page) || 1;
        var pageSize = (data && data.pageSize) || 50;
        var skip = (page - 1) * pageSize;
        var query = db.collection('routes').orderBy('createTime', 'desc');
        var countRes = await query.count();
        var listRes = await query.skip(skip).limit(pageSize).get();
        return { list: listRes.data, total: countRes.total, hasMore: skip + pageSize < countRes.total };
      }

      case 'getById': {
        var res = await db.collection('routes').doc(data.id).get();
        return { route: res.data };
      }

      case 'create': {
        var routeData = data || {};
        var addRes = await db.collection('routes').add({
          data: {
            name: routeData.name || '',
            description: routeData.description || '',
            coverImage: routeData.coverImage || '',
            isCustomCover: routeData.isCustomCover || false,
            tags: routeData.tags || [],
            attractions: routeData.attractions || [],
            totalDistance: routeData.totalDistance || 0,
            estimatedTime: routeData.estimatedTime || 0,
            attractionCount: (routeData.attractions || []).length,
            likeCount: 0,
            createTime: db.serverDate(),
            updateTime: db.serverDate()
          }
        });
        // 自动计算里程
        try {
          await cloud.callFunction({
            name: 'calcRouteDistance',
            data: { _id: addRes._id, estimatedTime: routeData.estimatedTime || 0 }
          });
        } catch (e) { console.warn('calcRouteDistance 调用失败:', e.message); }
        return { success: true, id: addRes._id };
      }

      case 'update': {
        var id = data.id;
        var updateData = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.coverImage !== undefined) updateData.coverImage = data.coverImage;
        if (data.isCustomCover !== undefined) updateData.isCustomCover = data.isCustomCover;
        if (data.estimatedTime !== undefined) updateData.estimatedTime = data.estimatedTime;
        if (data.tags !== undefined) updateData.tags = data.tags;
        if (data.attractions !== undefined) {
          updateData.attractions = data.attractions;
          updateData.attractionCount = data.attractions.length;
        }
        updateData.updateTime = db.serverDate();

        await db.collection('routes').doc(id).update({ data: updateData });

        // 如果变更了景点，重新计算里程
        if (data.attractions !== undefined) {
          try {
            await cloud.callFunction({
              name: 'calcRouteDistance',
              data: { _id: id, estimatedTime: data.estimatedTime || 0 }
            });
          } catch (e) { console.warn('calcRouteDistance 调用失败:', e.message); }
        }
        return { success: true };
      }

      case 'delete': {
        await db.collection('routes').doc(data.id).remove();
        return { success: true };
      }

      // 获取所有景点（供路线编排时多选下拉）
      case 'toggleRecommended': {
        var id = (data && data.id) || event.id;
        var item = await db.collection('routes').doc(id).get();
        var newVal = !item.data.recommended;
        await db.collection('routes').doc(id).update({
          data: { recommended: newVal, updateTime: db.serverDate() }
        });
        return { success: true, recommended: newVal };
      }

      case 'listAttractions': {
        var res = await db.collection('attractions')
          .field({ _id: true, name: true, address: true, category: true, images: true })
          .orderBy('name', 'asc')
          .limit(200)
          .get();
        return { list: res.data };
      }

      default:
        return { success: false, error: '未知操作: ' + action };
    }
  } catch (err) {
    console.error('adminRoutes error:', err);
    return { success: false, error: err.message };
  }
};
