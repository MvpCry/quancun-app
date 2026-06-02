// cloudfunctions/planRoute/index.js - 智能路线规划算法
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

/**
 * Haversine公式计算两点距离 (km)
 */
function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 贪心最近邻算法：从起点出发，每次选择距离最近且未访问的景点
 */
function nearestNeighbor(stops, startPos) {
  const unvisited = stops.map((s, i) => ({ ...s, _idx: i }));
  const ordered = [];
  let currentPos = startPos || {
    latitude: unvisited[0].latitude,
    longitude: unvisited[0].longitude
  };
  let totalDistance = 0;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDist = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const d = calcDistance(
        currentPos.latitude, currentPos.longitude,
        unvisited[i].latitude, unvisited[i].longitude
      );
      if (d < minDist) {
        minDist = d;
        nearestIdx = i;
      }
    }

    const nearest = unvisited.splice(nearestIdx, 1)[0];
    const distFromPrev = ordered.length === 0 ? 0 : minDist;

    ordered.push({
      attractionId: nearest.attractionId || nearest._id,
      name: nearest.name,
      location: {
        latitude: nearest.latitude,
        longitude: nearest.longitude
      },
      distanceFromPrev: Math.round(distFromPrev * 10) / 10
    });

    if (ordered.length > 1) {
      totalDistance += minDist;
    }

    currentPos = {
      latitude: nearest.latitude,
      longitude: nearest.longitude
    };
  }

  return {
    plannedStops: ordered,
    totalDistance: Math.round(totalDistance * 10) / 10,
    estimatedTime: estimateTime(totalDistance, stops.length)
  };
}

/**
 * 估算总时间：行驶时间 + 游览时间（每景点1.5小时）
 */
function estimateTime(totalDistance, stopCount, avgSpeed = 40, avgVisitTime = 1.5) {
  const travelTime = totalDistance / avgSpeed;
  const visitTime = stopCount * avgVisitTime;
  return Math.round((travelTime + visitTime) * 10) / 10;
}

// 主函数
exports.main = async (event, context) => {
  const { attractionIds, startLocation } = event;

  if (!attractionIds || attractionIds.length < 2) {
    return { error: '至少需要2个景点' };
  }

  try {
    // 获取所有景点的位置信息
    const res = await db.collection('attractions')
      .where({
        _id: _.in(attractionIds)
      })
      .field({
        _id: true,
        name: true,
        location: true,
        images: true
      })
      .get();

    const attractions = res.data;

    if (attractions.length < 2) {
      return { error: '未找到足够的景点信息' };
    }

    // 提取坐标
    const stops = attractions
      .filter(a => a.location && a.location.latitude)
      .map(a => ({
        attractionId: a._id,
        name: a.name,
        latitude: a.location.latitude,
        longitude: a.location.longitude,
        icon: a.images && a.images[0] ? a.images[0] : ''
      }));

    if (stops.length < 2) {
      return { error: '部分景点缺少位置信息，无法规划路线' };
    }

    // 执行贪心最近邻算法
    const result = nearestNeighbor(stops, startLocation);

    return result;
  } catch (err) {
    console.error('planRoute error:', err);
    return { error: err.message };
  }
};
