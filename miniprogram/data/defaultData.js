// miniprogram/data/defaultData.js
// ===== 【唯一数据源】首页、景点Tab、路线Tab、详情页全部引用此文件 =====
// 修改景点/路线数据只需改这里，所有页面自动同步

var defaultAttractions = [
  {
    _id: 'default_wlpc',
    name: '王林坡村',
    // ---- 简介（详情页展示用）----
    introduction: '王林坡村位于泰安市泰山区省庄镇，是一个依山傍水的美丽乡村。村中保留了大量传统鲁中民居，青砖灰瓦错落有致，古槐树、石碾盘等历史遗迹散布其间，清澈小溪穿村而过。游客可在此体验地道乡村生活、品尝农家菜肴、参与果园采摘，感受远离城市喧嚣的宁静与惬意。',
    description: '王林坡村位于泰安市泰山区省庄镇，是一个依山傍水的美丽乡村。村中保留了大量传统鲁中民居，青砖灰瓦错落有致，古槐树、石碾盘等历史遗迹散布其间，清澈小溪穿村而过。游客可在此体验地道乡村生活、品尝农家菜肴、参与果园采摘，感受远离城市喧嚣的宁静与惬意。',
    // ---- 图片数组（3张）----
    images: [
      '/images/wanglinpo.webp',
      '/images/zhujiawa.webp',
      '/images/baimashi.webp'
    ],
    location: {
      latitude: 36.1328,
      longitude: 117.2084
    },
    address: '山东省泰安市泰山区省庄镇王林坡村',
    category: 'rural',
    tags: ['美丽乡村', '农家体验', '休闲度假'],
    // ---- 开放时间 & 票价 ----
    openTime: '9:00-17:00',
    ticketPrice: 0,
    // ---- 星级评分 ----
    rating: 4.8,
    reviewCount: 126,
    likeCount: 358,
    createTime: '2025-06-01'
  },
  {
    _id: 'default_zjwc',
    name: '朱家洼村',
    introduction: '朱家洼村地处泰安市岱岳区，是一座拥有百年历史的古村落。村中保存完好的明清古建筑群是最大亮点——石板路、老戏台、祠堂院落处处透着历史韵味。村子三面环山一面邻水，近年建起了民宿集群、农耕文化展示馆和手工艺体验坊。游客可漫步古巷感受沧桑，也可参与农事体验，品尝地道泰山农家美食。',
    description: '朱家洼村地处泰安市岱岳区，是一座拥有百年历史的古村落。村中保存完好的明清古建筑群是最大亮点——石板路、老戏台、祠堂院落处处透着历史韵味。村子三面环山一面邻水，近年建起了民宿集群、农耕文化展示馆和手工艺体验坊。游客可漫步古巷感受沧桑，也可参与农事体验，品尝地道泰山农家美食。',
    images: [
      '/images/zhujiawa.webp',
      '/images/wanglinpo.webp',
      '/images/baimashi.webp'
    ],
    location: {
      latitude: 36.1456,
      longitude: 117.1823
    },
    address: '山东省泰安市岱岳区朱家洼村',
    category: 'rural',
    tags: ['古村落', '民宿体验', '历史文化'],
    openTime: '9:00-17:00',
    ticketPrice: 0,
    rating: 4.6,
    reviewCount: 98,
    likeCount: 267,
    createTime: '2025-06-15'
  },
  {
    _id: 'default_bmsc',
    name: '白马石村',
    introduction: '白马石村位于泰安市徂徕镇徂徕山脚下，因村口一块形似白马的巨石得名。村子坐拥徂徕山国家森林公园的优美生态，植被茂密、空气清新。村中有明代古寺庙遗址和一棵千年银杏树，是游客必到打卡点。白马石村以"山居生活"为主题，打造了特色民宿、山野茶室和林间步道，站在村中高处可远眺泰山主峰，景色壮丽。',
    description: '白马石村位于泰安市徂徕镇徂徕山脚下，因村口一块形似白马的巨石得名。村子坐拥徂徕山国家森林公园的优美生态，植被茂密、空气清新。村中有明代古寺庙遗址和一棵千年银杏树，是游客必到打卡点。白马石村以"山居生活"为主题，打造了特色民宿、山野茶室和林间步道，站在村中高处可远眺泰山主峰，景色壮丽。',
    images: [
      '/images/baimashi.webp',
      '/images/wanglinpo.webp',
      '/images/zhujiawa.webp'
    ],
    location: {
      latitude: 36.0892,
      longitude: 117.3126
    },
    address: '山东省泰安市徂徕镇白马石村',
    category: 'rural',
    tags: ['山居体验', '自然风光', '登山徒步'],
    openTime: '9:00-17:00',
    ticketPrice: 0,
    rating: 4.7,
    reviewCount: 153,
    likeCount: 412,
    createTime: '2025-07-01'
  }
];

// ===== 默认路线 =====
var defaultRoutes = [
  {
    _id: 'default_route_1',
    name: '泰安乡村一日游',
    description: '串联泰安三个最美乡村——王林坡村、朱家洼村、白马石村，一天玩遍泰安乡村精华，感受田园风光与古村文化的完美融合。',
    coverImage: '/images/zhujiawa.webp',
    tags: ['一日游', '乡村游', '亲子游'],
    totalDistance: 35.6,
    estimatedTime: 8,
    likeCount: 89,
    attractions: [
      { attractionId: 'default_wlpc', order: 0, name: '王林坡村', location: { latitude: 36.1328, longitude: 117.2084 } },
      { attractionId: 'default_zjwc', order: 1, name: '朱家洼村', location: { latitude: 36.1456, longitude: 117.1823 } },
      { attractionId: 'default_bmsc', order: 2, name: '白马石村', location: { latitude: 36.0892, longitude: 117.3126 } }
    ],
    createTime: '2025-08-01'
  }
];

// ===== 演示评论 =====
var defaultReviews = [
  { _id: 'r1', userName: '游客小王', avatarUrl: '', rating: 5, content: '非常棒的古村落！建筑保存完好，村民热情好客，农家菜特别地道。', createTime: '2025-10-15' },
  { _id: 'r2', userName: '旅行者老张', avatarUrl: '', rating: 4, content: '环境优美，适合周末带家人来放松，孩子玩得很开心。', createTime: '2025-09-28' },
  { _id: 'r3', userName: '摄影爱好者', avatarUrl: '', rating: 5, content: '拍照绝佳地！清晨的光线特别美，拍了好多满意的照片。', createTime: '2025-08-12' }
];

// ===== 工具函数：从景点数据生成Banner =====
function buildBanners(attractions) {
  return attractions.map(function (item) {
    return {
      id: item._id,
      type: 'attraction',
      image: item.images[0],
      title: '泰安·' + item.name,
      desc: item.introduction ? item.introduction.substring(0, 30) + '...' : ''
    };
  });
}

module.exports = {
  defaultAttractions: defaultAttractions,
  defaultRoutes: defaultRoutes,
  defaultReviews: defaultReviews,
  buildBanners: buildBanners
};
