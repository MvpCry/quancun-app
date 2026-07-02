// cloudfunctions/checkContent/index.js
// 微信内容安全预检：敏感词过滤 → cloud.openapi → HTTP 直调 → 拒发
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const https = require('https');

// ---------- 自定义敏感词检查 ----------
async function checkBannedWords(content) {
  try {
    var res = await db.collection('bannedWords')
      .where({ active: true })
      .get();
    var words = res.data;
    var lowerContent = content.toLowerCase();
    for (var i = 0; i < words.length; i++) {
      if (lowerContent.indexOf(words[i].word.toLowerCase()) !== -1) {
        return { isSafe: false, hitWord: words[i].word };
      }
    }
    return { isSafe: true };
  } catch (e) {
    console.warn('[checkContent] 敏感词查询失败:', e.message || e);
    return { isSafe: true };
  }
}

// ---------- 获取 access_token ----------
function getAccessToken(appid, secret) {
  return new Promise(function (resolve, reject) {
    var url = 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=' + appid + '&secret=' + secret;
    https.get(url, function (res) {
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        try {
          var json = JSON.parse(data);
          if (json.access_token) { resolve(json.access_token); }
          else { reject(new Error('获取access_token失败: ' + (json.errmsg || 'unknown'))); }
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// ---------- HTTP 直调 msgSecCheck v2 ----------
function msgSecCheckHttp(content, openid, accessToken) {
  return new Promise(function (resolve, reject) {
    var postData = JSON.stringify({ version: 2, scene: 2, content: content, openid: openid });
    var url = 'https://api.weixin.qq.com/wxa/msg_sec_check?access_token=' + accessToken;
    var req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    }, function (res) {
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        try {
          var json = JSON.parse(data);
          if (json.errcode === 0) {
            var suggest = (json.result && json.result.suggest) || 'pass';
            if (suggest === 'risky' || suggest === 'review') {
              resolve({ isSafe: false, suggest: suggest, label: json.result && json.result.label });
            } else {
              resolve({ isSafe: true });
            }
          } else {
            reject(new Error('msgSecCheck返回异常: ' + (json.errmsg || 'errcode=' + json.errcode)));
          }
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

exports.main = async function (event) {
  var content = (event.content || '').trim();
  var wxContext = cloud.getWXContext();
  var openid = wxContext.OPENID;

  if (!content || content.length < 2) {
    return { isSafe: false, errMsg: '内容过短' };
  }

  if (!openid) {
    return { isSafe: false, errMsg: '未获取到用户openid' };
  }

  // 方案 0: 自定义敏感词过滤
  var bannedResult = await checkBannedWords(content);
  if (!bannedResult.isSafe) {
    return { isSafe: false, errMsg: '内容违规', hitWord: bannedResult.hitWord };
  }

  // 方案 1: cloud.openapi v2
  try {
    var result = await cloud.openapi.security.msgSecCheck({
      version: 2,
      scene: 2,
      content: content,
      openid: openid
    });
    // v2: errcode===0 调用成功，判罚看 result.suggest
    if (result && result.errcode === 0) {
      var suggest = (result.result && result.result.suggest) || 'pass';
      return {
        isSafe: suggest !== 'risky' && suggest !== 'review',
        suggest: suggest,
        label: result.result && result.result.label
      };
    }
    throw new Error('msgSecCheck 返回异常: errcode=' + (result && result.errcode));
  } catch (err) {
    console.warn('[checkContent] cloud.openapi 失败，尝试 HTTP 直调:', err.errMsg || err.message);
  }

  // 方案 2: HTTP 直调微信 API
  try {
    var appid = cloud.getWXContext().APPID;
    var secret = process.env.WX_APPSECRET || '';
    if (!appid || !secret) {
      throw new Error('未配置 WX_APPSECRET 环境变量');
    }
    var token = await getAccessToken(appid, secret);
    var httpResult = await msgSecCheckHttp(content, openid, token);
    return httpResult;
  } catch (err2) {
    console.warn('[checkContent] HTTP 直调失败:', err2.message || err2);
  }

  // 方案 3: 全部失败 → 返回不安全，阻止提交
  console.error('[checkContent] 内容安全检测全部方案失败');
  return { isSafe: false, errMsg: '内容安全服务不可用，请稍后重试' };
};
