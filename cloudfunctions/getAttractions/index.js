// cloudfunctions/getAttractions/index.js - 获取景点列表/详情
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const {
    action = 'list',
    // 列表参数
    category,
    keyword,
    sortBy = 'rating',
    page = 1,
    pageSize = 10,
    // 详情参数
    id,
    // 批量查询
    ids,
    // Banner
    limit = 10
  } = event;

  try {
    switch (action) {
      case 'list': {
        // 构建查询条件
        let query = db.collection('attractions');

        // 分类筛选
        if (category) {
          query = query.where({ category });
        }

        // 关键词搜索
        if (keyword) {
          query = query.where(
            _.or([
              { name: db.RegExp({ regexp: keyword, options: 'i' }) },
              { description: db.RegExp({ regexp: keyword, options: 'i' }) },
              { address: db.RegExp({ regexp: keyword, options: 'i' }) }
            ])
          );
        }

        // 排序
        let orderField = 'rating';
        let orderDir = 'desc';
        switch (sortBy) {
          case 'rating':
            orderField = 'rating';
            orderDir = 'desc';
            break;
          case 'reviewCount':
            orderField = 'reviewCount';
            orderDir = 'desc';
            break;
          case 'createTime':
            orderField = 'createTime';
            orderDir = 'desc';
            break;
          case 'distance':
            // 距离排序需要在结果中处理
            orderField = 'createTime';
            orderDir = 'desc';
            break;
        }

        // 分页
        const skip = (page - 1) * pageSize;

        const countRes = await query.count();
        const total = countRes.total;

        const res = await query
          .orderBy(orderField, orderDir)
          .skip(skip)
          .limit(pageSize)
          .get();

        return {
          list: res.data,
          total,
          page,
          pageSize,
          hasMore: skip + pageSize < total
        };
      }

      case 'detail': {
        const res = await db.collection('attractions')
          .doc(id)
          .get();

        return {
          attraction: res.data
        };
      }

      case 'byIds': {
        if (!ids || ids.length === 0) {
          return { list: [] };
        }

        const res = await db.collection('attractions')
          .where({
            _id: _.in(ids)
          })
          .get();

        // 按ids顺序排列
        const list = ids.map(id =>
          res.data.find(item => item._id === id)
        ).filter(Boolean);

        return { list };
      }

      case 'banners': {
        // 获取评分最高的N个景点作为Banner
        const res = await db.collection('attractions')
          .orderBy('rating', 'desc')
          .limit(limit || 4)
          .get();

        const list = res.data.map((item, index) => ({
          id: item._id,
          type: 'attraction',
          image: (item.images && item.images[0]) || '',
          title: item.name,
          desc: item.description ? item.description.substring(0, 40) + '...' : ''
        }));

        return { list };
      }

      default:
        return { error: '未知操作' };
    }
  } catch (err) {
    console.error('getAttractions error:', err);
    return { error: err.message, list: [] };
  }
};
