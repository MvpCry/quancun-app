// cloudfunctions/batchImportData/index.js
// 批量导入景点数据：支持本地路径 /images/xxx.jpg 和云存储 cloud:// 路径
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

// ===== 合法分类校验 =====
const VALID_CATEGORIES = ['rural', 'red', 'family', 'culture'];

// ===== 合法标签白名单 =====
const KNOWN_TAGS = [
  '美丽乡村', '古村落', '农家体验', '民宿体验',
  '历史文化', '民俗文化', '泰山石刻', '休闲观光',
  '登山', '自然', '美食', '农特产', '休闲度假',
  '红色教育', '亲子活动', '摄影路线', '采摘体验'
];

exports.main = async (event, context) => {
  const { action = 'import', data } = event;

  // ========== 检查管理员权限 ==========
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  try {
    const adminCheck = await db.collection('admins')
      .where({ openid, active: true })
      .count();
    if (adminCheck.total === 0) {
      return { success: false, error: '无管理员权限。请先将你的 openid 加入 admins 集合。' };
    }
  } catch (e) {
    return { success: false, error: '鉴权失败: ' + e.message };
  }

  // ========== 预览模式：校验数据但不写入 ==========
  if (action === 'preview') {
    return previewImport(data);
  }

  // ========== 正式导入 ==========
  if (action === 'import') {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return { success: false, error: '请提供景点数组。格式: { action: "import", data: [...] }' };
    }
    return doImport(data);
  }

  return { success: false, error: '未知 action。支持: preview | import' };
};

// ===== 预览校验 =====
function previewImport(attractions) {
  if (!attractions || !Array.isArray(attractions) || attractions.length === 0) {
    return { success: false, error: '数据为空' };
  }

  const report = attractions.map((attr, i) => {
    const errors = [];
    const warnings = [];

    if (!attr.name || !attr.name.trim()) errors.push('缺少名称');
    if (!attr.introduction || !attr.introduction.trim()) errors.push('缺少详细介绍');
    if (!attr.address || !attr.address.trim()) warnings.push('缺少地址，坐标将无法自动解析');
    if (!attr.category || VALID_CATEGORIES.indexOf(attr.category) === -1) {
      errors.push('分类无效，可选: ' + VALID_CATEGORIES.join(', '));
    }
    if (!attr.images || !Array.isArray(attr.images) || attr.images.length === 0) {
      errors.push('至少需要1张图片');
    }
    if (attr.tags && Array.isArray(attr.tags)) {
      for (const t of attr.tags) {
        if (KNOWN_TAGS.indexOf(t) === -1) {
          warnings.push('未知标签 "' + t + '"，将被保留但建议使用已知标签');
        }
      }
    }

    return {
      index: i,
      name: attr.name || '(未命名)',
      status: errors.length > 0 ? '❌ 有问题' : (warnings.length > 0 ? '⚠️ 可导入（有警告）' : '✅ 可导入'),
      errors,
      warnings
    };
  });

  const errorCount = report.filter(r => r.errors.length > 0).length;
  const warningCount = report.filter(r => r.warnings.length > 0).length;

  return {
    success: true,
    mode: 'preview',
    total: attractions.length,
    canImport: errorCount === 0,
    errorCount,
    warningCount,
    report
  };
}

// ===== 执行导入 =====
async function doImport(attractions) {
  const results = { success: [], failed: [] };

  for (let i = 0; i < attractions.length; i++) {
    const attr = attractions[i];

    try {
      // 图片路径处理：支持 cloud:// 和 /images/ 两种格式
      let images = (attr.images || []).map(img => {
        if (!img) return '';
        // cloud:// 路径直接使用
        if (img.startsWith('cloud://')) return img;
        // /images/xxx 转为 miniprogram 相对路径
        if (img.startsWith('/images/')) return img;
        if (img.startsWith('images/')) return '/' + img;
        return img;
      });

      const doc = {
        name: attr.name.trim(),
        introduction: attr.introduction || attr.description || '',
        description: attr.description || attr.introduction || '',
        address: attr.address || '',
        category: attr.category || 'rural',
        tags: attr.tags || [],
        images,
        openTime: attr.openTime || '全天',
        ticketPrice: typeof attr.ticketPrice === 'number' ? attr.ticketPrice : 0,
        isBanner: !!attr.isBanner,
        featured: !!attr.featured,
        location: attr.location && attr.location.latitude ? attr.location : null,
        rating: typeof attr.rating === 'number' ? attr.rating : 0,
        reviewCount: typeof attr.reviewCount === 'number' ? attr.reviewCount : 0,
        likeCount: typeof attr.likeCount === 'number' ? attr.likeCount : 0,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      };

      const addRes = await db.collection('attractions').add({ data: doc });
      results.success.push({ index: i, name: attr.name, _id: addRes._id });
    } catch (err) {
      results.failed.push({ index: i, name: attr.name, error: err.message });
    }
  }

  return {
    success: true,
    message: '导入完成: ' + results.success.length + ' 成功, ' + results.failed.length + ' 失败',
    total: attractions.length,
    imported: results.success.length,
    failed: results.failed.length,
    detail: results
  };
}
