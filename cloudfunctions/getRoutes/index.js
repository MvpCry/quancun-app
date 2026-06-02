// cloudfunctions/getRoutes/index.js - 路线列表/详情查询
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const {
    action = 'list',
    // 筛选
    tag,
    // 分页
    page = 1,
    pageSize = 10,
    // 详情
    id,
    // 推荐数量
    limit = 10
  } = event;

  try {
    switch (action) {
      case 'list': {
        let query = db.collection('routes');

        // 标签筛选
        if (tag) {
          query = query.where({
            tags: _.in([tag])
          });
        }

        const countRes = await query.count();
        const total = countRes.total;
        const skip = (page - 1) * pageSize;

        const res = await query
          .orderBy('likeCount', 'desc')
          .orderBy('createTime', 'desc')
          .skip(skip)
          .limit(pageSize)
          .get();

        // 处理返回数据，计算景点数
        const list = res.data.map(route => ({
          ...route,
          attractionCount: route.attractions ? route.attractions.length : 0
        }));

        return {
          list,
          total,
          page,
          pageSize,
          hasMore: skip + pageSize < total
        };
      }

      case 'recommend': {
        // 推荐：按收藏数排序
        const res = await db.collection('routes')
          .orderBy('likeCount', 'desc')
          .orderBy('createTime', 'desc')
          .limit(limit)
          .get();

        return {
          list: res.data.map(route => ({
            ...route,
            attractionCount: route.attractions ? route.attractions.length : 0
          }))
        };
      }

      case 'detail': {
        const res = await db.collection('routes')
          .doc(id)
          .get();

        const route = res.data;
        if (route) {
          route.attractionCount = route.attractions ? route.attractions.length : 0;
        }

        return { route };
      }

      case 'myRoutes': {
        // 获取当前用户创建的路线
        const res = await db.collection('routes')
          .where({ _openid: openid })
          .orderBy('createTime', 'desc')
          .get();

        return {
          list: res.data.map(route => ({
            ...route,
            attractionCount: route.attractions ? route.attractions.length : 0
          }))
        };
      }

      default:
        return { error: '未知操作' };
    }
  } catch (err) {
    console.error('getRoutes error:', err);
    return { error: err.message, list: [] };
  }
};
