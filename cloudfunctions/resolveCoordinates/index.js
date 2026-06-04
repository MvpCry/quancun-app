// cloudfunctions/resolveCoordinates/index.js
// 批量调用腾讯地图 geocoder 解析地址 → 坐标 → 回写数据库
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const https = require('https');

// 腾讯地图 WebService API Key（GCJ-02 坐标系）
const MAP_KEY = 'TVPBZ-LLDCN-KRSFF-SH3LU-AOSEQ-YSBSU';
const GEOCODER_URL = 'https://apis.map.qq.com/ws/geocoder/v1/';

/**
 * 调用腾讯地图 geocoder 解析一个地址
 * @returns {Promise<{lat: number, lng: number}>}
 */
function geocodeAddress(address) {
  return new Promise(function (resolve, reject) {
    var encodedAddr = encodeURIComponent(address);
    var url = GEOCODER_URL + '?address=' + encodedAddr + '&key=' + MAP_KEY;

    https.get(url, function (res) {
      var body = '';
      res.on('data', function (chunk) { body += chunk; });
      res.on('end', function () {
        try {
          var data = JSON.parse(body);
          if (data.status === 0 && data.result && data.result.location) {
            resolve({
              lat: data.result.location.lat,
              lng: data.result.location.lng
            });
          } else {
            reject({ code: data.status, message: data.message || 'geocoder 返回异常' });
          }
        } catch (e) {
          reject({ code: -1, message: 'JSON 解析失败: ' + e.message });
        }
      });
    }).on('error', function (e) {
      reject({ code: -1, message: '网络请求失败: ' + e.message });
    });
  });
}

/**
 * 延时工具
 */
function delay(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

exports.main = async function (event, context) {
  var action = event.action || 'batch';

  try {
    // ========== batch: 批量解析全部景点地址 ==========
    if (action === 'batch') {
      var countRes = await db.collection('attractions').get();
      var docs = countRes.data;
      var result = { total: docs.length, updated: 0, failed: 0, errors: [] };

      for (var i = 0; i < docs.length; i++) {
        var doc = docs[i];
        var address = doc.address;
        if (!address) {
          result.errors.push({ name: doc.name, _id: doc._id, error: '缺少地址' });
          result.failed++;
          continue;
        }

        try {
          var coords = await geocodeAddress(address);

          await db.collection('attractions').doc(doc._id).update({
            data: {
              location: { latitude: coords.lat, longitude: coords.lng },
              updateTime: db.serverDate()
            }
          });

          result.updated++;
          console.log('OK: ' + doc.name + ' → ' + coords.lat + ', ' + coords.lng);
        } catch (e) {
          result.errors.push({
            name: doc.name,
            _id: doc._id,
            address: address,
            error: e.message || JSON.stringify(e)
          });
          result.failed++;
          console.warn('FAIL: ' + doc.name + ' → ' + (e.message || JSON.stringify(e)));
        }

        // 间隔 200ms 防止 API 超频（5 QPS 限制）
        if (i < docs.length - 1) {
          await delay(200);
        }
      }

      // 同步更新路线内的坐标引用（重新读取 attractions 集合的最新坐标）
      try {
        var freshDocs = await db.collection('attractions').get();
        var coordLookup = {};
        freshDocs.data.forEach(function (d) {
          if (d.location && d.location.latitude) {
            coordLookup[d.name] = d.location;
          }
        });

        var routeRes = await db.collection('routes').get();
        for (var r = 0; r < routeRes.data.length; r++) {
          var route = routeRes.data[r];
          var syncedStops = (route.attractions || []).map(function (stop) {
            var newLoc = coordLookup[stop.name];
            if (newLoc) {
              return Object.assign({}, stop, { location: { latitude: newLoc.latitude, longitude: newLoc.longitude } });
            }
            return stop;
          });

          await db.collection('routes').doc(route._id).update({
            data: {
              attractions: syncedStops,
              updateTime: db.serverDate()
            }
          });
        }
      } catch (routeErr) {
        console.warn('路线坐标同步失败:', routeErr.message);
        result.routeSyncError = routeErr.message;
      }

      return {
        success: true,
        summary: result
      };
    }

    // ========== single: 解析单个地址 ==========
    if (action === 'single') {
      var address = event.address;
      if (!address) {
        return { success: false, message: '请传入 address 参数' };
      }

      var coords = await geocodeAddress(address);
      return { success: true, lat: coords.lat, lng: coords.lng };
    }

    // ========== clear: 清空全部坐标 ==========
    if (action === 'clear') {
      var clearResult = { attractions: 0, routes: 0 };

      // 清空 attractions 的 location
      var attrRes = await db.collection('attractions').get();
      for (var a = 0; a < attrRes.data.length; a++) {
        var ad = attrRes.data[a];
        if (ad.location) {
          await db.collection('attractions').doc(ad._id).update({
            data: { location: null, updateTime: db.serverDate() }
          });
          clearResult.attractions++;
        }
      }

      // 清空 routes 中各站点的 location
      var rRes = await db.collection('routes').get();
      for (var rr = 0; rr < rRes.data.length; rr++) {
        var rd = rRes.data[rr];
        var clearedStops = (rd.attractions || []).map(function (stop) {
          return Object.assign({}, stop, { location: null });
        });
        await db.collection('routes').doc(rd._id).update({
          data: { attractions: clearedStops, updateTime: db.serverDate() }
        });
        clearResult.routes++;
      }

      return { success: true, message: '已清空全部坐标', detail: clearResult };
    }

    return { success: false, message: '未知 action，支持: batch | single | clear' };

  } catch (err) {
    console.error('resolveCoordinates error:', err);
    return { success: false, error: err.message };
  }
};
