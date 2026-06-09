// cloudfunctions/syncVillages/index.js
// 一键导入10个泰安特色乡村到云数据库（检查重复，安全插入）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const villages = [
  {
    name: '里峪村',
    introduction: '里峪村位于泰山西麓岱岳区道朗镇，三面环山，森林覆盖率高达95%，负氧离子含量达19万个/cm³，是远近闻名的长寿村。村内有齐长城遗址、黄巢寨遗址、仰天神龟石等10余处自然人文景观。近年打造"泰山人家·春天里峪"品牌，发展农家乐32家、精品民宿20余套，获评全国乡村旅游重点村、中国美丽休闲乡村等多项国家级荣誉。',
    description: '泰山脚下长寿村，齐长城遗址穿越，森林康养胜地',
    images: ['/images/default-attraction.png'],
    location: null,
    address: '山东省泰安市岱岳区道朗镇里峪村',
    category: 'rural',
    tags: ['美丽乡村', '古村落', '休闲观光', '历史文化'],
    openTime: '全天',
    ticketPrice: 0,
    rating: 4.6
  },
  {
    name: '五埠岭村',
    introduction: '五埠岭村位于肥城市孙伯镇，始建于明洪武十四年（1381年），拥有600余年历史。村内房屋全部用青石垒砌，以"青石干茬缝砌墙技艺"闻名，不用任何黏合材料却能屹立数百年。最独特的是"伙大门"建筑格局——门中有门、院中套院、巷中有巷，五大家族共用一座大门楼，全国罕见。现存明清至民国石头院落200余处，获评国家AAAA级景区、中国传统村落、全国乡村旅游重点村。',
    description: '600年石头古村，"伙大门"建筑全国罕见，4A级景区',
    images: ['/images/default-attraction.png'],
    location: null,
    address: '山东省泰安市肥城市孙伯镇五埠岭村',
    category: 'culture',
    tags: ['古村落', '历史文化', '民俗文化', '休闲观光'],
    openTime: '8:30-17:30',
    ticketPrice: 0,
    rating: 4.8
  },
  {
    name: '马蹄峪村',
    introduction: '马蹄峪村位于岱岳区下港镇，三面环山形如马蹄，森林覆盖率超过90%，空气洁净、山泉入户，是远近闻名的长寿村，80岁以上老人有30多位。村内打造"一区三沟"旅游格局——休闲中心区+林果生态游+林下休闲游+山涧奇石探险游。拥有采摘园20余处，特产泰山板栗、杏、大樱桃，建有"泰山公社-静心谷""林海叠院"等特色民宿，获评山东省景区化村庄、省级旅游特色村。',
    description: '形如马蹄的长寿秘境，90%森林覆盖，天然氧吧',
    images: ['/images/default-attraction.png'],
    location: null,
    address: '山东省泰安市岱岳区下港镇马蹄峪村',
    category: 'rural',
    tags: ['美丽乡村', '休闲观光', '登山', '自然'],
    openTime: '全天',
    ticketPrice: 0,
    rating: 4.3
  },
  {
    name: '安家庄村',
    introduction: '安家庄村位于泰山区省庄镇北部山区，是国家AAA级景区"泰山安"景区的核心所在。景区包含养心谷和安心谷两大板块——养心谷投资10.8亿元打造35套庭院式民宿和高端康养度假区，安心谷设有望岳台、初心湖、星空顶露营基地等设施。村内建有苹果、草莓、核桃等生态采摘园，芝田星河露营基地可体验热气球。先后入选国家森林乡村、山东省美丽村居试点，旅游路线入选全国乡村旅游精品线路。',
    description: '3A级"泰山安"景区，养心谷康养度假，星空露营',
    images: ['/images/default-attraction.png'],
    location: null,
    address: '山东省泰安市泰山区省庄镇安家庄村',
    category: 'rural',
    tags: ['休闲度假', '民宿体验', '亲子活动', '休闲观光'],
    openTime: '9:00-18:00',
    ticketPrice: 0,
    rating: 4.5
  },
  {
    name: '上豹峪村',
    introduction: '上豹峪村位于新泰市龙廷镇东南部，是西汉礼学大师高堂生（礼圣）的故里。村内拥有3000余亩蜜桃和丹参产业，千亩桃园连片成林，每年春季举办桃花节。投资500余万元建成礼圣高堂生暨龙廷历史文化博物馆和礼圣文化公园。依托圣水山旅游度假区（国家3A级），建有七彩滑道、水上漂流、滑草场、跑马场等游乐项目，年接待游客10万人次，获评省级景区化村庄。',
    description: '礼圣故里，千亩桃花源，3A级圣水山度假区',
    images: ['/images/default-attraction.png'],
    location: null,
    address: '山东省泰安市新泰市龙廷镇上豹峪村',
    category: 'culture',
    tags: ['历史文化', '民俗文化', '休闲观光', '亲子活动'],
    openTime: '8:00-18:00',
    ticketPrice: 0,
    rating: 4.4
  },
  {
    name: '朝阳庄村',
    introduction: '朝阳庄村位于新泰市羊流镇，始建于明崇祯年间，南临蟠龙山。村域内建有泰山百合和园——总投资3.7亿元、流转土地2.6万亩，打造千亩百合谷，集种养结合、生态循环、观光旅游于一体，是国家一三产业融合示范区。村民变身产业工人，人均增收2万余元。清华大学乡村振兴工作站已入驻村庄。获评全国乡村治理示范村、山东省景区化村庄、山东省美丽乡村示范村。',
    description: '千亩百合花海，清华大学乡村振兴工作站驻地',
    images: ['/images/default-attraction.png'],
    location: null,
    address: '山东省泰安市新泰市羊流镇朝阳庄村',
    category: 'rural',
    tags: ['美丽乡村', '休闲观光', '亲子活动', '自然'],
    openTime: '全天',
    ticketPrice: 0,
    rating: 4.3
  },
  {
    name: '埠阳庄村',
    introduction: '埠阳庄村位于泰山区邱家店镇，北依泰山、南濒大汶河，是国家旅游局命名的全国四个民俗风情旅游点之一，载入《国际旅游大词典》。自1982年起，已有来自35个国家的近7000名外国友人来访。游客可与村民同吃同住同劳动，体验赶牛耕地、摊煎饼、包水饺、抬花轿等北方乡村民俗。村内建有民俗主题公园、音乐喷泉徒步道、乡村地名记忆馆，150余户达到接待标准，获评全国文明村。',
    description: '国际民俗旅游名村，35国友人到访，地道鲁中乡村体验',
    images: ['/images/default-attraction.png'],
    location: null,
    address: '山东省泰安市泰山区邱家店镇埠阳庄村',
    category: 'culture',
    tags: ['民俗文化', '农家体验', '历史文化', '美食'],
    openTime: '全天',
    ticketPrice: 0,
    rating: 4.5
  },
  {
    name: '浮粮店村',
    introduction: '浮粮店村位于东平县旧县乡，坐落在东平湖东北岸青龙山山脊上，因古代水上粮草转运而得名。村中现存120年以上历史的石头房子100余处，依山而建、层层叠叠，石头小路蜿蜒其间，被誉为"崖居部落"。老宅已改造为15套崖居特色民宿，设有会客厅、观景台等设施。村前可赏浩渺东平湖日出日落，周边有北齐摩崖石刻、楚霸王墓、水浒影视基地等景点，是省级传统古村落。',
    description: '东平湖畔百年石头崖居，15套山脊民宿观湖赏日',
    images: ['/images/default-attraction.png'],
    location: null,
    address: '山东省泰安市东平县旧县乡浮粮店村',
    category: 'rural',
    tags: ['古村落', '民宿体验', '自然', '历史文化'],
    openTime: '全天',
    ticketPrice: 0,
    rating: 4.2
  },
  {
    name: '北张村',
    introduction: '北张村位于岱岳区道朗镇，因3000平方米巨型墙体彩绘爆红网络，被称为"花田北张"。2018年邀请省内多所高校美术生，以"一花一世界、一墙一风景"为主题，创作了涵盖动物、动漫、星空等多种风格的巨幅墙绘。村内设有喵喵咖啡屋、乡韵彩墅主题民宿、鲜切花基地、知青博物馆、猪猪农场等文旅项目。从省级贫困村蜕变为年吸引游客超10万人次的网红艺术村，获评山东省景区化村庄。',
    description: '3000㎡网红墙绘艺术村，喵喵咖啡屋，花田打卡胜地',
    images: ['/images/default-attraction.png'],
    location: null,
    address: '山东省泰安市岱岳区道朗镇北张村',
    category: 'family',
    tags: ['休闲观光', '亲子活动', '美丽乡村', '民宿体验'],
    openTime: '全天',
    ticketPrice: 0,
    rating: 4.4
  },
  {
    name: '马套村',
    introduction: '马套村位于泰山景区粥店街道，毗邻泰山桃花峪景区入口，因清代分为南北马套而得名。村域内拥有大面积泰山女儿茶田和茶文化展示馆，游客可体验采茶、制茶全过程，品味正宗泰山女儿茶的清香甘醇。村内建有马套水库、泰山特色民宿区和民俗体验区，形成"以茶为媒、以旅兴村"的发展格局。获评山东省森林村居、山东省乡村振兴示范村，是泰山脚下茶旅融合的特色乡村。',
    description: '泰山女儿茶之乡，毗邻桃花峪，茶旅融合体验',
    images: ['/images/default-attraction.png'],
    location: null,
    address: '山东省泰安市岱岳区粥店街道马套村',
    category: 'rural',
    tags: ['休闲观光', '农家体验', '自然', '休闲度假'],
    openTime: '全天',
    ticketPrice: 0,
    rating: 4.1
  }
];

exports.main = async (event, context) => {
  const result = { added: [], skipped: [], errors: [] };

  for (const village of villages) {
    try {
      // 检查是否已存在同名景点
      const existRes = await db.collection('attractions')
        .where({ name: village.name })
        .count();

      if (existRes.total > 0) {
        result.skipped.push(village.name);
        continue;
      }

      // 插入新景点
      await db.collection('attractions').add({
        data: {
          ...village,
          reviewCount: 0,
          likeCount: 0,
          isBanner: false,
          featured: true,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      });

      result.added.push(village.name);
    } catch (err) {
      result.errors.push({ name: village.name, error: err.message });
    }
  }

  return {
    success: true,
    summary: '新增 ' + result.added.length + ' 个, 已存在跳过 ' + result.skipped.length + ' 个, 失败 ' + result.errors.length + ' 个',
    added: result.added,
    skipped: result.skipped,
    errors: result.errors
  };
};
