// cloudfunctions/importDefaultData/index.js
// 一次性导入默认数据到云数据库（仅在集合为空时执行）
// 坐标来源：POI86、百度百科、搜狗百科等公开地图数据
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

// ===== 默认景点数据（已修正为真实坐标） =====
const defaultAttractions = [
  {
    name: '王林坡村',
    introduction: '王林坡村位于泰安市泰山区邱家店镇，是一个依山傍水的美丽乡村。村中保留了大量传统鲁中民居，青砖灰瓦错落有致，古槐树、石碾盘等历史遗迹散布其间，清澈小溪穿村而过。游客可在此体验地道乡村生活、品尝农家菜肴、参与果园采摘，感受远离城市喧嚣的宁静与惬意。',
    description: '王林坡村位于泰安市泰山区邱家店镇，是一个依山傍水的美丽乡村。村中保留了大量传统鲁中民居，青砖灰瓦错落有致，古槐树、石碾盘等历史遗迹散布其间，清澈小溪穿村而过。游客可在此体验地道乡村生活、品尝农家菜肴、参与果园采摘，感受远离城市喧嚣的宁静与惬意。',
    images: [
      '/images/wanglinpo.jpg',
      '/images/zhujiawa.jpg',
      '/images/baimashi.jpg'
    ],
    location: {
      latitude: 36.6569,
      longitude: 117.1203
    },
    address: '山东省泰安市泰山区邱家店镇王林坡村',
    category: 'rural',
    tags: ['美丽乡村', '农家体验', '休闲度假'],
    openTime: '9:00-17:00',
    ticketPrice: 0,
    rating: 4.8,
    reviewCount: 126,
    likeCount: 358
  },
  {
    name: '朱家洼村',
    introduction: '朱家洼村地处泰安市岱岳区道朗镇，是一座拥有百年历史的古村落。村中保存完好的明清古建筑群是最大亮点——石板路、老戏台、祠堂院落处处透着历史韵味。村子三面环山一面邻水，近年建起了民宿集群、农耕文化展示馆和手工艺体验坊。游客可漫步古巷感受沧桑，也可参与农事体验，品尝地道泰山农家美食。',
    description: '朱家洼村地处泰安市岱岳区道朗镇，是一座拥有百年历史的古村落。村中保存完好的明清古建筑群是最大亮点——石板路、老戏台、祠堂院落处处透着历史韵味。村子三面环山一面邻水，近年建起了民宿集群、农耕文化展示馆和手工艺体验坊。游客可漫步古巷感受沧桑，也可参与农事体验，品尝地道泰山农家美食。',
    images: [
      '/images/zhujiawa.jpg',
      '/images/wanglinpo.jpg',
      '/images/baimashi.jpg'
    ],
    location: {
      latitude: 36.2343,
      longitude: 116.9212
    },
    address: '山东省泰安市岱岳区道朗镇朱家洼村',
    category: 'rural',
    tags: ['古村落', '民宿体验', '历史文化'],
    openTime: '9:00-17:00',
    ticketPrice: 0,
    rating: 4.6,
    reviewCount: 98,
    likeCount: 267
  },
  {
    name: '白马石村',
    introduction: '白马石村位于泰安市泰山区泰前街道，泰山南麓，因村东原有一块巨大石英石形似白马凌空而得名。村中有泰山石刻园，利用天然石壁摩刻500余块名家书法作品；红枫林、翠竹园、荷花池点缀其间，还有泰山女儿茶园和千年石榴观赏园。站在村中高处可仰望泰山主峰，是体验泰山民俗文化的绝佳去处。',
    description: '白马石村位于泰安市泰山区泰前街道，泰山南麓，因村东原有一块巨大石英石形似白马凌空而得名。村中有泰山石刻园，利用天然石壁摩刻500余块名家书法作品；红枫林、翠竹园、荷花池点缀其间，还有泰山女儿茶园和千年石榴观赏园。站在村中高处可仰望泰山主峰，是体验泰山民俗文化的绝佳去处。',
    images: [
      '/images/baimashi.jpg',
      '/images/wanglinpo.jpg',
      '/images/zhujiawa.jpg'
    ],
    location: {
      latitude: 36.2215,
      longitude: 117.1558
    },
    address: '山东省泰安市泰山区泰前街道白马石村',
    category: 'rural',
    tags: ['民俗文化', '泰山石刻', '休闲观光'],
    openTime: '全天',
    ticketPrice: 0,
    rating: 4.7,
    reviewCount: 153,
    likeCount: 412
  }
];

// ===== 默认路线数据 =====
const defaultRoutes = [
  {
    name: '泰安乡村一日游',
    description: '从泰山南麓的白马石民俗村出发，感受泰山石刻文化与红枫翠竹；东行至邱家店镇王林坡村，体验鲁中传统乡村生活与农家美食；再向西到达道朗镇朱家洼村，探访百年明清古建筑群。一天之内穿越泰安东西，领略三种不同风格的乡村之美。',
    coverImage: '/images/zhujiawa.jpg',
    tags: ['一日游', '乡村游', '亲子游'],
    totalDistance: 98.8,
    estimatedTime: 8,
    likeCount: 89,
    _placeholderAttractions: true   // 导入时将被替换为真实引用
  }
];

// ===== 演示评论数据 =====
const defaultReviews = [
  { userName: '游客小王', avatarUrl: '', rating: 5, content: '非常棒的古村落！建筑保存完好，村民热情好客，农家菜特别地道。', createTime: '2025-10-15' },
  { userName: '旅行者老张', avatarUrl: '', rating: 4, content: '环境优美，适合周末带家人来放松，孩子玩得很开心。', createTime: '2025-09-28' },
  { userName: '摄影爱好者', avatarUrl: '', rating: 5, content: '拍照绝佳地！清晨的光线特别美，拍了好多满意的照片。', createTime: '2025-08-12' }
];

exports.main = async (event, context) => {
  const { action = 'check' } = event;

  try {
    const countRes = await db.collection('attractions').count();
    const existingCount = countRes.total;

    if (action === 'check') {
      return {
        hasData: existingCount > 0,
        attractionCount: existingCount,
        message: existingCount > 0 ? '数据库已有数据，无需导入' : '数据库为空，可以导入'
      };
    }

    if (action === 'import') {
      if (existingCount > 0) {
        return { success: false, message: '数据库已有 ' + existingCount + ' 条景点数据，跳过导入' };
      }

      const results = { attractions: [], routes: [], reviews: [] };

      // 1. 导入景点
      for (const attr of defaultAttractions) {
        const addRes = await db.collection('attractions').add({
          data: {
            ...attr,
            createTime: db.serverDate(),
            updateTime: db.serverDate()
          }
        });
        results.attractions.push({ _id: addRes._id, name: attr.name, location: attr.location });
      }

      // 2. 回填路线景点引用（按路线顺序：白马石→王林坡→朱家洼）
      const bmsc = results.attractions.find(a => a.name === '白马石村');
      const wlpc = results.attractions.find(a => a.name === '王林坡村');
      const zjwc = results.attractions.find(a => a.name === '朱家洼村');

      const routeAttractions = [
        { attractionId: bmsc._id, order: 0, name: '白马石村', location: bmsc.location },
        { attractionId: wlpc._id, order: 1, name: '王林坡村', location: wlpc.location },
        { attractionId: zjwc._id, order: 2, name: '朱家洼村', location: zjwc.location }
      ];

      // 3. 导入路线
      for (const route of defaultRoutes) {
        const routeData = { ...route };
        delete routeData._placeholderAttractions;
        routeData.attractions = routeAttractions;

        const addRes = await db.collection('routes').add({
          data: {
            ...routeData,
            createTime: db.serverDate(),
            updateTime: db.serverDate()
          }
        });
        results.routes.push({ _id: addRes._id, name: route.name });
      }

      // 4. 导入评论（关联第一个景点——白马石村）
      if (results.attractions.length > 0) {
        const firstAttrId = results.attractions[0]._id;
        for (const review of defaultReviews) {
          const addRes = await db.collection('reviews').add({
            data: {
              attractionId: firstAttrId,
              ...review,
              createTime: db.serverDate()
            }
          });
          results.reviews.push({ _id: addRes._id });
        }
      }

      return {
        success: true,
        message: '导入完成',
        summary: {
          景点: results.attractions.length + ' 条',
          路线: results.routes.length + ' 条',
          评论: results.reviews.length + ' 条'
        }
      };
    }

    if (action === 'updateCoordinates') {
      // 更新现有景点和路线的坐标（不删除用户数据）
      const result = { attractions: [], routes: [] };

      // 1. 更新景点坐标 + 图片路径（.webp → .jpg）
      const coordMap = {
        '王林坡村': { latitude: 36.6569, longitude: 117.1203 },
        '朱家洼村': { latitude: 36.2343, longitude: 116.9212 },
        '白马石村': { latitude: 36.2215, longitude: 117.1558 }
      };

      for (const [name, location] of Object.entries(coordMap)) {
        const res = await db.collection('attractions')
          .where({ name: name })
          .update({
            data: {
              location: db.command.set(location),
              updateTime: db.serverDate()
            }
          });
        result.attractions.push({ name, updated: res.stats.updated });

        // 修正图片路径 .webp → .jpg
        await db.collection('attractions')
          .where({ name: name })
          .update({
            data: {
              images: db.command.set([
                '/images/' + (name === '王林坡村' ? 'wanglinpo' : name === '朱家洼村' ? 'zhujiawa' : 'baimashi') + '.jpg',
                '/images/' + (name === '王林坡村' ? 'zhujiawa' : name === '朱家洼村' ? 'wanglinpo' : 'wanglinpo') + '.jpg',
                '/images/' + (name === '王林坡村' ? 'baimashi' : name === '朱家洼村' ? 'baimashi' : 'zhujiawa') + '.jpg'
              ])
            }
          });
      }

      // 更新路线封面图
      await db.collection('routes').where({}).update({
        data: { coverImage: '/images/zhujiawa.jpg' }
      });

      // 2. 更新路线总距离和景点坐标
      const routeRes = await db.collection('routes').get();
      for (const route of routeRes.data) {
        const updatedStops = route.attractions.map(stop => {
          const newCoord = coordMap[stop.name];
          if (newCoord) {
            return {
              ...stop,
              location: {
                latitude: newCoord.latitude,
                longitude: newCoord.longitude
              }
            };
          }
          return stop;
        });

        await db.collection('routes').doc(route._id).update({
          data: {
            totalDistance: 98.8,
            attractions: db.command.set(updatedStops),
            updateTime: db.serverDate()
          }
        });
        result.routes.push({ name: route.name, updated: true });
      }

      return {
        success: true,
        message: '坐标更新完成',
        detail: result
      };
    }

    if (action === 'reset') {
      // 清空所有数据后重新导入
      await db.collection('attractions').where({}).remove();
      await db.collection('routes').where({}).remove();
      await db.collection('reviews').where({}).remove();
      await db.collection('favorites').where({}).remove();

      return exports.main({ action: 'import' }, context);
    }

    return { error: '未知操作。支持: check | import | updateCoordinates | reset' };
  } catch (err) {
    console.error('importDefaultData error:', err);
    return { error: err.message };
  }
};
