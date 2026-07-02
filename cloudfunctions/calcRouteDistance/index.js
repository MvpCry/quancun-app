// cloudfunctions/calcRouteDistance/index.js
// 路线里程 & 预估时长自动计算
// CMS 新增/编辑路线时设为此云函数的触发器，自动填入 distance 和 duration
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

// 地球半径 (km)
var EARTH_R = 6371;

// 角度转弧度
function toRad(d) { return d * Math.PI / 180; }

// Haversine 公式计算两点距离 (km)
function haversine(lat1, lng1, lat2, lng2) {
  var dLat = toRad(lat2 - lat1);
  var dLng = toRad(lng2 - lng1);
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_R * c;
}

exports.main = async (event, context) => {
  // CMS 触发器传入的数据结构
  var routeData = event.data || event;
  var routeId = routeData._id;
  var manualTime = routeData.estimatedTime;   // 手动设置的游玩时间（>0 表示用户设了）

  if (!routeId) {
    return { success: false, error: '缺少路线ID' };
  }

  try {
    // 从数据库读取最新路线数据
    var routeRes = await db.collection('routes').doc(routeId).get();
    var route = routeRes.data;

    if (!route) {
      return { success: false, error: '路线不存在' };
    }

    // attractions 可能是 attractionId 数组或对象数组
    var attractions = route.attractions || [];
    if (attractions.length < 2) {
      await db.collection('routes').doc(routeId).update({
        data: {
          totalDistance: 0,
          estimatedTime: manualTime > 0 ? manualTime : 0,
          updateTime: db.serverDate()
        }
      });
      return { success: true, totalDistance: 0, estimatedTime: manualTime || 0, message: '景点不足2个，距离为0' };
    }

    // 提取景点 ID
    var ids = [];
    for (var i = 0; i < attractions.length; i++) {
      var a = attractions[i];
      if (typeof a === 'string') {
        ids.push(a);
      } else if (a.attractionId) {
        ids.push(a.attractionId);
      } else if (a._id) {
        ids.push(a._id);
      }
    }

    if (ids.length < 2) {
      return { success: false, error: '无法提取足够的景点ID' };
    }

    // 批量查询景点坐标
    var coordMap = {};
    for (var j = 0; j < ids.length; j++) {
      try {
        var attrRes = await db.collection('attractions').doc(ids[j]).field({ name: true, location: true, address: true }).get();
        if (attrRes.data && attrRes.data.location && attrRes.data.location.latitude) {
          coordMap[ids[j]] = {
            lat: attrRes.data.location.latitude,
            lng: attrRes.data.location.longitude,
            name: attrRes.data.name
          };
        }
      } catch (e) {
        console.warn('查询景点失败:', ids[j], e.message);
      }
    }

    // 按顺序计算总距离
    var totalDistance = 0;
    var validStops = [];
    for (var k = 0; k < ids.length; k++) {
      if (coordMap[ids[k]]) {
        validStops.push({ id: ids[k], name: coordMap[ids[k]].name });
      }
    }

    for (var m = 1; m < ids.length; m++) {
      var prev = coordMap[ids[m - 1]];
      var curr = coordMap[ids[m]];
      if (prev && curr) {
        totalDistance += haversine(prev.lat, prev.lng, curr.lat, curr.lng);
      }
    }

    // 预估时长：手动设置优先，否则自动计算（40km/h + 每个景点45分钟）
    var estimatedTime;
    if (manualTime > 0) {
      estimatedTime = manualTime;
    } else {
      var driveHours = totalDistance / 40;
      var stopHours = validStops.length * 0.75;
      estimatedTime = Math.round((driveHours + stopHours) * 10) / 10;
    }

    // 四舍五入距离到 1 位小数
    totalDistance = Math.round(totalDistance * 10) / 10;

    // 回写路线
    var updateFields = {
      totalDistance: totalDistance,
      estimatedTime: estimatedTime,
      attractionCount: ids.length,
      updateTime: db.serverDate()
    };
    await db.collection('routes').doc(routeId).update({ data: updateFields });

    return {
      success: true,
      totalDistance: totalDistance,
      estimatedTime: estimatedTime,
      stops: validStops,
      message: '计算完成: ' + totalDistance + 'km, ' + estimatedTime + 'h'
    };
  } catch (err) {
    console.error('calcRouteDistance error:', err);
    return { success: false, error: err.message };
  }
};
