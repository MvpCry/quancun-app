// miniprogram/utils/map-service.js
// 腾讯地图 WebService API 封装
// 文档：https://lbs.qq.com/service/webService/webServiceGuide/webServiceOverview

var config = require('../config/map-key.js');

var API_BASE = config.apiBaseUrl;
var KEY = config.mapKey;

/**
 * 通用请求方法
 */
function request(endpoint, params) {
  return new Promise(function (resolve, reject) {
    params = params || {};
    params.key = KEY;

    // 构建查询字符串
    var queryParts = [];
    for (var k in params) {
      if (params.hasOwnProperty(k) && params[k] !== undefined && params[k] !== null) {
        queryParts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
      }
    }

    var url = API_BASE + endpoint + '?' + queryParts.join('&');

    wx.request({
      url: url,
      method: 'GET',
      timeout: 8000,   // 8秒超时
      success: function (res) {
        if (res.statusCode === 200 && res.data) {
          if (res.data.status === 0) {
            resolve(res.data.result || res.data);
          } else {
            reject({ code: res.data.status, message: res.data.message || '地图服务异常' });
          }
        } else {
          reject({ code: res.statusCode, message: '请求失败(' + res.statusCode + ')' });
        }
      },
      fail: function (err) {
        if (err.errMsg && err.errMsg.indexOf('timeout') >= 0) {
          reject({ code: -1, message: '请求超时，请检查网络' });
        } else {
          reject({ code: -1, message: '网络连接失败，请确认已在小程序后台添加 request 合法域名: https://apis.map.qq.com', detail: err });
        }
      }
    });
  });
}

// =============================================
//  1. 地址解析（地址 → 坐标）
// =============================================

/**
 * 地理编码：地址转坐标
 * @param {String} address - 详细地址
 * @param {String} region - 城市名（可选，如"泰安"）
 * @returns {Promise<{lat, lng}>}
 */
function geocoder(address, region) {
  return request('/ws/geocoder/v1/', {
    address: address,
    region: region || ''
  }).then(function (result) {
    if (result.location) {
      return {
        lat: result.location.lat,
        lng: result.location.lng
      };
    }
    throw { code: -2, message: '未找到该地址' };
  });
}

// =============================================
//  2. 逆地理编码（坐标 → 地址）
// =============================================

/**
 * 逆地理编码：坐标转地址
 * @param {Number} lat - 纬度
 * @param {Number} lng - 经度
 * @returns {Promise<{address, formatted_addresses, ad_info}>}
 */
function reverseGeocoder(lat, lng) {
  return request('/ws/geocoder/v1/', {
    location: lat + ',' + lng,
    get_poi: 1
  }).then(function (result) {
    return {
      address: result.address,
      formattedAddress: result.formatted_addresses,
      adInfo: result.ad_info,
      pois: result.pois || []
    };
  });
}

// =============================================
//  3. 地点搜索
// =============================================

/**
 * 地点搜索
 * @param {String} keyword - 搜索关键词
 * @param {String} region - 限定城市（如"泰安"）
 * @param {Number} pageIndex - 页码
 * @param {Number} pageSize - 每页条数
 * @returns {Promise<{list, total}>}
 */
function placeSearch(keyword, region, pageIndex, pageSize) {
  return request('/ws/place/v1/search/', {
    keyword: keyword,
    boundary: region ? 'region(' + region + ',0)' : undefined,
    page_size: pageSize || 20,
    page_index: pageIndex || 1
  }).then(function (result) {
    return {
      list: (result.data || []).map(function (poi) {
        return {
          id: poi.id,
          title: poi.title,
          address: poi.address,
          category: poi.category,
          location: {
            latitude: poi.location.lat,
            longitude: poi.location.lng
          },
          distance: poi._distance,
          tel: poi.tel
        };
      }),
      total: result.count || 0
    };
  });
}

// =============================================
//  4. 驾车路线规划（核心功能）
// =============================================

/**
 * 驾车路线规划
 * @param {Object} from - {latitude, longitude}
 * @param {Object} to - {latitude, longitude}
 * @returns {Promise<{distance, duration, polyline}>}
 */
function drivingRoute(from, to) {
  return request('/ws/direction/v1/driving/', {
    from: from.latitude + ',' + from.longitude,
    to: to.latitude + ',' + to.longitude,
    output: 'json',
    policy: 'LEAST_TIME'   // 最短时间
  }).then(function (result) {
    if (result.routes && result.routes.length > 0) {
      var route = result.routes[0];
      return {
        distance: route.distance,        // 米
        duration: route.duration,        // 秒
        polyline: parsePolyline(route.polyline)  // [{latitude, longitude}, ...]
      };
    }
    throw { code: -3, message: '未找到驾车路线' };
  });
}

/**
 * 解析腾讯地图 polyline 编码
 * polyline 格式：[lat1*1e6, lng1*1e6, lat2*1e6, lng2*1e6, ...]
 */
function parsePolyline(polyline) {
  if (!polyline || !Array.isArray(polyline)) return [];

  var points = [];
  for (var i = 0; i < polyline.length; i += 2) {
    if (i + 1 < polyline.length) {
      points.push({
        latitude: polyline[i] / 1000000,
        longitude: polyline[i + 1] / 1000000
      });
    }
  }
  return points;
}

/**
 * 多路径驾车路线（用于路线串联）
 * @param {Array} stops - [{latitude, longitude}, ...]
 * @returns {Promise<Array>} [{distance, duration, polyline}, ...]
 */
function multiDrivingRoutes(stops) {
  if (!stops || stops.length < 2) return Promise.resolve([]);

  var promises = [];
  for (var i = 0; i < stops.length - 1; i++) {
    promises.push(drivingRoute(stops[i], stops[i + 1]));
  }

  return Promise.all(promises);
}

// =============================================
//  5. 距离矩阵（批量计算多对多距离）
// =============================================

/**
 * 距离矩阵计算
 * 用于计算多个起终点之间的真实驾车距离和时间
 *
 * @param {Array} from - 起点数组 [{latitude, longitude}, ...]
 * @param {Array} to   - 终点数组 [{latitude, longitude}, ...]
 * @param {String} mode - driving | walking
 * @returns {Promise<Array>} rows[i].elements[j] = {distance, duration}
 */
function distanceMatrix(from, to, mode) {
  mode = mode || 'driving';

  var fromStr = from.map(function (p) {
    return p.latitude + ',' + p.longitude;
  }).join(';');

  var toStr = to.map(function (p) {
    return p.latitude + ',' + p.longitude;
  }).join(';');

  return request('/ws/distance/v1/matrix/', {
    mode: mode,
    from: fromStr,
    to: toStr
  }).then(function (result) {
    return (result.rows || []).map(function (row) {
      return {
        elements: (row.elements || []).map(function (el) {
          return {
            distance: el.distance,   // 米
            duration: el.duration    // 秒
          };
        })
      };
    });
  });
}

// =============================================
//  6. 周边搜索
// =============================================

/**
 * 周边搜索（搜索某个坐标附近的地点）
 * @param {Number} lat - 纬度
 * @param {Number} lng - 经度
 * @param {String} keyword - 搜索关键词
 * @param {Number} radius - 搜索半径（米）
 * @returns {Promise<{list, total}>}
 */
function nearbySearch(lat, lng, keyword, radius) {
  return request('/ws/place/v1/search/', {
    keyword: keyword || '旅游',
    boundary: 'nearby(' + lat + ',' + lng + ',' + (radius || 5000) + ')',
    page_size: 20,
    page_index: 1
  }).then(function (result) {
    return {
      list: (result.data || []).map(function (poi) {
        return {
          id: poi.id,
          title: poi.title,
          address: poi.address,
          category: poi.category,
          location: {
            latitude: poi.location.lat,
            longitude: poi.location.lng
          },
          distance: poi._distance
        };
      }),
      total: result.count || 0
    };
  });
}

// =============================================
//  7. IP 定位（获取当前城市）
// =============================================

/**
 * IP 定位
 * @returns {Promise<{lat, lng, city, province}>}
 */
function ipLocation() {
  return request('/ws/location/v1/ip/', {}).then(function (result) {
    if (result.location) {
      return {
        lat: result.location.lat,
        lng: result.location.lng,
        city: result.ad_info ? result.ad_info.city : '',
        province: result.ad_info ? result.ad_info.province : ''
      };
    }
    // 返回近似位置
    return {
      lat: result.lat || 36.2,
      lng: result.lng || 117.1,
      city: '',
      province: ''
    };
  });
}

module.exports = {
  geocoder: geocoder,
  reverseGeocoder: reverseGeocoder,
  placeSearch: placeSearch,
  drivingRoute: drivingRoute,
  multiDrivingRoutes: multiDrivingRoutes,
  distanceMatrix: distanceMatrix,
  nearbySearch: nearbySearch,
  ipLocation: ipLocation
};
