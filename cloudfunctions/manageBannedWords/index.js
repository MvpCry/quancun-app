// cloudfunctions/manageBannedWords/index.js - 敏感词库后台管理
// 管理员可通过此云函数增删改查 bannedWords 集合
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

async function checkAdmin(openid) {
  if (!openid) return false;
  try {
    var res = await db.collection('admins')
      .where({ openid: openid, active: true })
      .count();
    return res.total > 0;
  } catch (e) { return false; }
}

exports.main = async (event, context) => {
  var wxContext = cloud.getWXContext();
  var openid = wxContext.OPENID;

  // 管理员鉴权
  var isAdmin = await checkAdmin(openid);
  if (!isAdmin) {
    return { success: false, error: '无管理员权限', code: 'FORBIDDEN' };
  }

  var { action, word, wordId, page, pageSize } = event;

  try {
    switch (action) {

      // ========== 添加敏感词 ==========
      case 'add':
        if (!word || word.trim().length === 0) {
          return { success: false, error: '请输入敏感词' };
        }
        var w = word.trim();

        // 去重检查
        var existRes = await db.collection('bannedWords')
          .where({ word: w })
          .count();
        if (existRes.total > 0) {
          return { success: false, error: '该敏感词已存在' };
        }

        await db.collection('bannedWords').add({
          data: {
            word: w,
            active: true,
            createTime: db.serverDate()
          }
        });
        return { success: true, message: '已添加: ' + w };

      // ========== 删除/禁用敏感词 ==========
      case 'remove':
        if (!wordId) return { success: false, error: '缺少wordId' };
        await db.collection('bannedWords')
          .doc(wordId)
          .update({ data: { active: false, updateTime: db.serverDate() } });
        return { success: true, message: '已禁用' };

      // ========== 恢复敏感词 ==========
      case 'enable':
        if (!wordId) return { success: false, error: '缺少wordId' };
        await db.collection('bannedWords')
          .doc(wordId)
          .update({ data: { active: true, updateTime: db.serverDate() } });
        return { success: true, message: '已启用' };

      // ========== 物理删除敏感词 ==========
      case 'delete':
        if (!wordId) return { success: false, error: '缺少wordId' };
        await db.collection('bannedWords').doc(wordId).remove();
        return { success: true, message: '已删除' };

      // ========== 批量导入 ==========
      case 'batchAdd':
        if (!event.words || !Array.isArray(event.words) || event.words.length === 0) {
          return { success: false, error: '请提供敏感词数组' };
        }
        var added = 0, skipped = 0;
        for (var i = 0; i < event.words.length; i++) {
          var bw = event.words[i].trim();
          if (!bw) continue;
          try {
            var dupRes = await db.collection('bannedWords').where({ word: bw }).count();
            if (dupRes.total > 0) { skipped++; continue; }
            await db.collection('bannedWords').add({
              data: { word: bw, active: true, createTime: db.serverDate() }
            });
            added++;
          } catch (e) { skipped++; }
        }
        return { success: true, message: '导入完成', added: added, skipped: skipped };

      // ========== 查询列表 ==========
      case 'list': {
        var p = page || 1;
        var ps = pageSize || 50;
        var skip = (p - 1) * ps;
        var countRes = await db.collection('bannedWords').where({ active: true }).count();
        var listRes = await db.collection('bannedWords')
          .where({ active: true })
          .orderBy('createTime', 'desc')
          .skip(skip)
          .limit(ps)
          .get();
        return {
          list: listRes.data,
          total: countRes.total,
          page: p,
          pageSize: ps,
          hasMore: skip + ps < countRes.total
        };
      }

      // ========== 搜索 ==========
      case 'search': {
        if (!event.keyword) return { list: [], total: 0 };
        var kw = event.keyword.trim();
        var allRes = await db.collection('bannedWords')
          .where(_.or([
            { word: db.RegExp({ regexp: kw, options: 'i' }) }
          ]))
          .limit(100)
          .get();
        return { list: allRes.data, total: allRes.data.length };
      }

      default:
        return { success: false, error: '未知操作: ' + action };
    }
  } catch (err) {
    console.error('manageBannedWords error:', err);
    return { success: false, error: err.message };
  }
};
