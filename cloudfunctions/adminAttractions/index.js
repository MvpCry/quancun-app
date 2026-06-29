// cloudfunctions/adminAttractions/index.js - 后台：景点CRUD管理
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

async function checkAdmin(openid) {
  if (!openid) return false;
  try {
    var res = await db.collection('admins').where({ openid: openid, active: true }).count();
    return res.total > 0;
  } catch (e) { return false; }
}

exports.main = async (event, context) => {
  var wxContext = cloud.getWXContext();
  var openid = wxContext.OPENID;

  const { action, data } = event;

  // syncVillages 无需鉴权（一次性导入初始数据）
  if (action === 'syncVillages') {
    const villages = [
      { name:'里峪村', introduction:'里峪村位于泰山西麓岱岳区道朗镇，三面环山，森林覆盖率高达95%，负氧离子含量达19万个/cm³，是远近闻名的长寿村。村内有齐长城遗址、黄巢寨遗址等10余处自然人文景观。获评全国乡村旅游重点村、中国美丽休闲乡村。', description:'泰山脚下长寿村，齐长城遗址穿越，森林康养胜地', address:'山东省泰安市岱岳区道朗镇里峪村', category:'rural', tags:['美丽乡村','古村落','休闲观光','历史文化'], openTime:'全天', ticketPrice:0, rating:4.6, images:['/images/default-attraction.png'] },
      { name:'五埠岭村', introduction:'五埠岭村位于肥城市孙伯镇，始建于明洪武十四年（1381年），拥有600余年历史。村内房屋全部用青石垒砌，不用任何黏合材料却能屹立数百年。最独特的是"伙大门"建筑格局——门中有门、院中套院、巷中有巷，全国罕见。现存明清至民国石头院落200余处，获评国家AAAA级景区、中国传统村落。', description:'600年石头古村，"伙大门"建筑全国罕见，4A级景区', address:'山东省泰安市肥城市孙伯镇五埠岭村', category:'culture', tags:['古村落','历史文化','民俗文化','休闲观光'], openTime:'8:30-17:30', ticketPrice:0, rating:4.8, images:['/images/default-attraction.png'] },
      { name:'马蹄峪村', introduction:'马蹄峪村位于岱岳区下港镇，三面环山形如马蹄，森林覆盖率超过90%，空气洁净、山泉入户，是远近闻名的长寿村，80岁以上老人有30多位。拥有采摘园20余处，特产泰山板栗、杏、大樱桃，建有"泰山公社-静心谷"等特色民宿，获评山东省景区化村庄。', description:'形如马蹄的长寿秘境，90%森林覆盖，天然氧吧', address:'山东省泰安市岱岳区下港镇马蹄峪村', category:'rural', tags:['美丽乡村','休闲观光','登山','自然'], openTime:'全天', ticketPrice:0, rating:4.3, images:['/images/default-attraction.png'] },
      { name:'安家庄村', introduction:'安家庄村位于泰山区省庄镇，是国家AAA级景区"泰山安"景区的核心所在。养心谷投资10.8亿元打造35套庭院式民宿和高端康养度假区，安心谷设有望岳台、星空顶露营基地。入选国家森林乡村、山东省美丽村居试点，旅游路线入选全国乡村旅游精品线路。', description:'3A级"泰山安"景区，养心谷康养度假，星空露营', address:'山东省泰安市泰山区省庄镇安家庄村', category:'rural', tags:['休闲度假','民宿体验','亲子活动','休闲观光'], openTime:'9:00-18:00', ticketPrice:0, rating:4.5, images:['/images/default-attraction.png'] },
      { name:'上豹峪村', introduction:'上豹峪村位于新泰市龙廷镇，是西汉礼学大师高堂生（礼圣）的故里。拥有3000余亩蜜桃产业，千亩桃园连片成林，每年举办桃花节。建有礼圣文化博物馆和礼圣文化公园。依托圣水山旅游度假区（3A级），年接待游客10万人次，获评省级景区化村庄。', description:'礼圣故里，千亩桃花源，3A级圣水山度假区', address:'山东省泰安市新泰市龙廷镇上豹峪村', category:'culture', tags:['历史文化','民俗文化','休闲观光','亲子活动'], openTime:'8:00-18:00', ticketPrice:0, rating:4.4, images:['/images/default-attraction.png'] },
      { name:'朝阳庄村', introduction:'朝阳庄村位于新泰市羊流镇，始建于明崇祯年间。村域内建有泰山百合和园——总投资3.7亿元、流转土地2.6万亩，打造千亩百合谷，是国家一三产业融合示范区。清华大学乡村振兴工作站已入驻。获评全国乡村治理示范村、山东省景区化村庄。', description:'千亩百合花海，清华大学乡村振兴工作站驻地', address:'山东省泰安市新泰市羊流镇朝阳庄村', category:'rural', tags:['美丽乡村','休闲观光','亲子活动','自然'], openTime:'全天', ticketPrice:0, rating:4.3, images:['/images/default-attraction.png'] },
      { name:'埠阳庄村', introduction:'埠阳庄村位于泰山区邱家店镇，北依泰山、南濒大汶河，是国家旅游局命名的全国四个民俗风情旅游点之一，载入《国际旅游大词典》。已有来自35个国家近7000名外国友人来访。游客可体验赶牛耕地、摊煎饼、包水饺、抬花轿等北方乡村民俗，获评全国文明村。', description:'国际民俗旅游名村，35国友人到访，地道鲁中乡村体验', address:'山东省泰安市泰山区邱家店镇埠阳庄村', category:'culture', tags:['民俗文化','农家体验','历史文化','美食'], openTime:'全天', ticketPrice:0, rating:4.5, images:['/images/default-attraction.png'] },
      { name:'浮粮店村', introduction:'浮粮店村位于东平县旧县乡，坐落在东平湖东北岸青龙山山脊上，因古代水上粮草转运得名。现存120年以上历史的石头房子100余处，依山而建、层层叠叠，被誉为"崖居部落"。老宅已改造为15套崖居特色民宿。省级传统古村落。', description:'东平湖畔百年石头崖居，15套山脊民宿观湖赏日', address:'山东省泰安市东平县旧县乡浮粮店村', category:'rural', tags:['古村落','民宿体验','自然','历史文化'], openTime:'全天', ticketPrice:0, rating:4.2, images:['/images/default-attraction.png'] },
      { name:'北张村', introduction:'北张村位于岱岳区道朗镇，因3000平方米巨型墙体彩绘爆红网络，被称为"花田北张"。2018年邀请高校美术生创作了涵盖动物、动漫、星空等风格的巨幅墙绘。村内设有喵喵咖啡屋、乡韵彩墅民宿、知青博物馆、猪猪农场等，年吸引游客超10万人次，获评山东省景区化村庄。', description:'3000㎡网红墙绘艺术村，喵喵咖啡屋，花田打卡胜地', address:'山东省泰安市岱岳区道朗镇北张村', category:'family', tags:['休闲观光','亲子活动','美丽乡村','民宿体验'], openTime:'全天', ticketPrice:0, rating:4.4, images:['/images/default-attraction.png'] },
      { name:'马套村', introduction:'马套村位于泰山景区粥店街道，毗邻泰山桃花峪景区入口。村域内拥有大面积泰山女儿茶田和茶文化展示馆，游客可体验采茶、制茶全过程。村内建有马套水库、泰山特色民宿区，获评山东省森林村居、山东省乡村振兴示范村，是泰山脚下茶旅融合的特色乡村。', description:'泰山女儿茶之乡，毗邻桃花峪，茶旅融合体验', address:'山东省泰安市岱岳区粥店街道马套村', category:'rural', tags:['休闲观光','农家体验','自然','休闲度假'], openTime:'全天', ticketPrice:0, rating:4.1, images:['/images/default-attraction.png'] }
    ];
    const result = { added: [], skipped: [] };
    for (const v of villages) {
      const exist = await db.collection('attractions').where({ name: v.name }).count();
      if (exist.total > 0) { result.skipped.push(v.name); continue; }
      await db.collection('attractions').add({ data: { ...v, reviewCount:0, likeCount:0, isBanner:false, featured:true, location:null, createTime:db.serverDate(), updateTime:db.serverDate() } });
      result.added.push(v.name);
    }
    return { success: true, summary: '新增' + result.added.length + '个，已存在' + result.skipped.length + '个', added: result.added, skipped: result.skipped };
  }

  if (!await checkAdmin(openid)) {
    return { success: false, error: '无管理员权限', code: 'FORBIDDEN' };
  }

  try {
    switch (action) {
      case 'list': {
        var page = (data && data.page) || 1;
        var pageSize = (data && data.pageSize) || 50;
        var skip = (page - 1) * pageSize;
        var query = db.collection('attractions').orderBy('createTime', 'desc');
        var countRes = await query.count();
        var listRes = await query.skip(skip).limit(pageSize).get();
        return { list: listRes.data, total: countRes.total, hasMore: skip + pageSize < countRes.total };
      }

      case 'getById': {
        var res = await db.collection('attractions').doc(data.id).get();
        return { attraction: res.data };
      }

      case 'create': {
        // 新增景点 — 校验区县合法性
        var validDistricts = ['泰山区', '岱岳区', '东平县', '新泰市', '肥城市'];
        if (data.district && validDistricts.indexOf(data.district) === -1) {
          return { success: false, error: '区/县不合法，可选：' + validDistricts.join('、') };
        }
        // 规范化 location：禁止 null 入库（null 会导致后续 update 深度合并报错）
        var normalizedLocation = (data.location && data.location.latitude)
          ? { latitude: data.location.latitude, longitude: data.location.longitude }
          : {};

        const addRes = await db.collection('attractions').add({
          data: {
            ...data,
            // 确保结构化字段存在
            province: data.province || '山东省',
            city: data.city || '泰安市',
            district: data.district || '',
            town: data.town || '',
            village: data.village || '',
            location: normalizedLocation,
            rating: 0,
            reviewCount: 0,
            createTime: db.serverDate(),
            updateTime: db.serverDate()
          }
        });
        return { success: true, id: addRes._id };
      }

      case 'update': {
        // 更新景点 — 校验区县合法性
        var validDistricts = ['泰山区', '岱岳区', '东平县', '新泰市', '肥城市'];
        if (data.district && validDistricts.indexOf(data.district) === -1) {
          return { success: false, error: '区/县不合法，可选：' + validDistricts.join('、') };
        }
        const { id, ...updateData } = data;
        // 规范化 location：禁止 null 入库
        if ('location' in updateData) {
          var loc = updateData.location;
          updateData.location = (loc && loc.latitude)
            ? { latitude: loc.latitude, longitude: loc.longitude }
            : {};
        }
        await db.collection('attractions')
          .doc(id)
          .update({
            data: {
              ...updateData,
              updateTime: db.serverDate()
            }
          });
        return { success: true };
      }

      case 'batchUpdateRegion': {
        // 批量修正区域字段
        var ids = (data && data.ids) || [];
        if (!ids || ids.length === 0) {
          return { success: false, error: '请提供景点ID列表' };
        }
        var regionData = {
          province: (data && data.province) || '山东省',
          city: (data && data.city) || '泰安市',
          district: (data && data.district) || '',
          town: (data && data.town) || '',
          village: (data && data.village) || '',
          updateTime: db.serverDate()
        };
        var updated = 0;
        var errors = [];
        for (var i = 0; i < ids.length; i++) {
          try {
            await db.collection('attractions').doc(ids[i]).update({ data: regionData });
            updated++;
          } catch (e) {
            errors.push({ id: ids[i], error: e.message });
          }
        }
        return { success: true, updated: updated, total: ids.length, errors: errors };
      }

      case 'migrateRegions': {
        // 一次性迁移：解析现有 address → 写入 structured region 字段
        var allRes = await db.collection('attractions').limit(500).get();
        var list = allRes.data;
        var updated = 0;
        var skipped = 0;
        var errors = [];

        for (var i = 0; i < list.length; i++) {
          var a = list[i];
          // 已有结构化字段就跳过
          if (a.district) { skipped++; continue; }

          var addr = a.address || '';
          var province = '山东省';
          var city = '泰安市';
          var district = '';
          var town = '';
          var village = '';

          // 去掉省
          var afterProv = addr.replace(/^山东省/, '');
          // 去掉地级市"泰安市"
          var afterCity = afterProv.replace(/^泰安市/, '');
          // 匹配区/县/县级市
          var distMatch = afterCity.match(/^(泰山区|岱岳区|东平县|新泰市|肥城市)/);
          if (distMatch) {
            district = distMatch[0];
            var afterDist = afterCity.substring(distMatch[0].length);
            // 匹配乡镇/街道
            var townMatch = afterDist.match(/^(.{1,6}?[镇乡]|.{1,6}?街道)/);
            if (townMatch) {
              town = townMatch[0];
              var afterTown = afterDist.substring(townMatch[0].length);
              // 匹配村
              var villageMatch = afterTown.match(/^(.+?村)/);
              if (villageMatch) village = villageMatch[0];
            }
          }

          if (district) {
            try {
              await db.collection('attractions').doc(a._id).update({
                data: {
                  province: province,
                  city: city,
                  district: district,
                  town: town,
                  village: village,
                  updateTime: db.serverDate()
                }
              });
              updated++;
            } catch (e) {
              errors.push({ name: a.name, _id: a._id, error: e.message });
            }
          } else {
            errors.push({ name: a.name, _id: a._id, error: '无法从地址解析区县', address: addr });
          }
        }

        return { success: true, total: list.length, updated: updated, skipped: skipped, errors: errors };
      }

      case 'delete': {
        // 删除景点
        await db.collection('attractions')
          .doc(data.id)
          .remove();
        return { success: true };
      }

      case 'uploadImage': {
        // 上传图片到云存储
        // 注意：图片上传应该在小程序端使用 wx.cloud.uploadFile 完成
        // 此函数用于获取上传后的 fileID 并记录
        return { success: true };
      }

      case 'toggleFeatured': {
        var id = (data && data.id) || event.id;
        var item = await db.collection('attractions').doc(id).get();
        var newVal = !item.data.featured;
        await db.collection('attractions').doc(id).update({
          data: { featured: newVal, updateTime: db.serverDate() }
        });
        return { success: true, featured: newVal };
      }

      case 'toggleBanner': {
        var id = (data && data.id) || event.id;
        var item = await db.collection('attractions').doc(id).get();
        var newVal = !item.data.isBanner;
        await db.collection('attractions').doc(id).update({
          data: { isBanner: newVal, updateTime: db.serverDate() }
        });
        return { success: true, isBanner: newVal };
      }

      case 'batchImport': {
        // 批量导入景点
        if (!data || !data.list || data.list.length === 0) {
          return { error: '导入数据为空' };
        }

        const tasks = data.list.map(item => ({
          ...item,
          rating: 0,
          reviewCount: 0,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }));

        // 批量添加（云开发限制每次最多1000条）
        const results = [];
        for (let i = 0; i < tasks.length; i += 100) {
          const batch = tasks.slice(i, i + 100);
          // 逐条添加（简单方式）
          for (const item of batch) {
            const addRes = await db.collection('attractions').add({ data: item });
            results.push(addRes._id);
          }
        }

        return { success: true, count: results.length, ids: results };
      }

      case 'fixNullLocations': {
        // 批量修复 location: null → location: {}（防止后续 update 时深度合并报错）
        var allRes = await db.collection('attractions').limit(500).get();
        var list = allRes.data;
        var fixed = 0;
        var errors = [];
        for (var i = 0; i < list.length; i++) {
          if (list[i].location === null) {
            try {
              await db.collection('attractions').doc(list[i]._id).update({
                data: { location: {}, updateTime: db.serverDate() }
              });
              fixed++;
            } catch (e) {
              errors.push({ name: list[i].name, _id: list[i]._id, error: e.message });
            }
          }
        }
        return { success: true, total: list.length, fixed: fixed, errors: errors };
      }

      default:
        return { error: '未知操作' };
    }
  } catch (err) {
    console.error('adminAttractions error:', err);
    return { error: err.message };
  }
};
