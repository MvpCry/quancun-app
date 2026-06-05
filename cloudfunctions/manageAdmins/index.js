// cloudfunctions/manageAdmins/index.js - 管理员后台管理
// 管理员可通过此云函数增删查 admins 集合，支持搜索用户
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

  var { action, targetOpenid, adminId, keyword } = event;

  try {
    switch (action) {

      // ========== 查询管理员列表 ==========
      case 'listAdmins': {
        // 查所有活跃管理员
        var countRes = await db.collection('admins')
          .where({ active: true })
          .count();
        var listRes = await db.collection('admins')
          .where({ active: true })
          .orderBy('createTime', 'desc')
          .get();

        var admins = listRes.data;

        // 联表查 users 获取昵称头像
        if (admins.length > 0) {
          var openids = admins.map(function (a) { return a.openid; });
          try {
            var usersRes = await db.collection('users')
              .where({ _openid: _.in(openids) })
              .get();
            var userMap = {};
            usersRes.data.forEach(function (u) {
              userMap[u._openid] = u;
            });
            admins = admins.map(function (a) {
              var user = userMap[a.openid];
              return {
                _id: a._id,
                openid: a.openid,
                active: a.active,
                createTime: a.createTime,
                nickName: user ? user.nickName : '未知用户',
                avatarUrl: user ? user.avatarUrl : ''
              };
            });
          } catch (e) {
            // users 集合可能为空，忽略联表错误
            admins = admins.map(function (a) {
              return {
                _id: a._id,
                openid: a.openid,
                active: a.active,
                createTime: a.createTime,
                nickName: '未知用户',
                avatarUrl: ''
              };
            });
          }
        }

        return {
          list: admins,
          total: countRes.total,
          currentOpenid: openid
        };
      }

      // ========== 添加管理员 ==========
      case 'addAdmin': {
        if (!targetOpenid || targetOpenid.trim().length === 0) {
          return { success: false, error: '请选择要添加的用户' };
        }
        var to = targetOpenid.trim();

        // 去重检查
        var existRes = await db.collection('admins')
          .where({ openid: to, active: true })
          .count();
        if (existRes.total > 0) {
          return { success: false, error: '该用户已是管理员' };
        }

        // 检查是否之前被移除过（存在但 inactive），有则恢复
        var inactiveRes = await db.collection('admins')
          .where({ openid: to, active: false })
          .get();
        if (inactiveRes.data.length > 0) {
          await db.collection('admins')
            .doc(inactiveRes.data[0]._id)
            .update({
              data: {
                active: true,
                updateTime: db.serverDate()
              }
            });
          return { success: true, message: '已恢复管理员权限' };
        }

        // 新增
        await db.collection('admins').add({
          data: {
            openid: to,
            active: true,
            createTime: db.serverDate()
          }
        });
        return { success: true, message: '已添加管理员' };
      }

      // ========== 移除管理员 ==========
      case 'removeAdmin': {
        if (!adminId) return { success: false, error: '缺少adminId' };

        // 查询该管理员记录，防止自己移除自己
        var docRes = await db.collection('admins').doc(adminId).get();
        if (!docRes.data) {
          return { success: false, error: '记录不存在' };
        }
        if (docRes.data.openid === openid) {
          return { success: false, error: '不能移除自己' };
        }

        await db.collection('admins')
          .doc(adminId)
          .update({
            data: {
              active: false,
              updateTime: db.serverDate()
            }
          });
        return { success: true, message: '已移除管理员' };
      }

      // ========== 搜索用户（按昵称模糊搜索）==========
      case 'searchUsers': {
        if (!keyword || keyword.trim().length === 0) {
          return { list: [], total: 0 };
        }
        var kw = keyword.trim();

        // 先查 users 集合
        var allRes = await db.collection('users')
          .where(_.or([
            { nickName: db.RegExp({ regexp: kw, options: 'i' }) }
          ]))
          .limit(50)
          .get();

        // 标记哪些已经是管理员
        var users = allRes.data;
        if (users.length > 0) {
          var openids = users.map(function (u) { return u._openid; });
          var adminRes = await db.collection('admins')
            .where({ openid: _.in(openids), active: true })
            .get();
          var adminSet = {};
          adminRes.data.forEach(function (a) { adminSet[a.openid] = true; });

          users = users.map(function (u) {
            return {
              _id: u._id,
              openid: u._openid,
              nickName: u.nickName,
              avatarUrl: u.avatarUrl,
              isAdmin: !!adminSet[u._openid]
            };
          });
        }

        return { list: users, total: users.length };
      }

      default:
        return { success: false, error: '未知操作: ' + action };
    }
  } catch (err) {
    console.error('manageAdmins error:', err);
    return { success: false, error: err.message };
  }
};
