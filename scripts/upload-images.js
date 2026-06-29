// scripts/upload-images.js — 本地图片压缩后通过HTTP上传到微信云
// 用法:
//   node scripts/upload-images.js "图片目录" "景点名"
//   node scripts/upload-images.js "图片目录" "景点名" --url "https://xxx.service.tcloudbase.com/adminUpload/upload"
//
// 需要先部署 cloudfunctions/adminUpload 云函数（在微信开发者工具中右键 → 上传并部署）
// HTTP 触发器 URL 在云函数部署后，在微信云控制台 → 云函数 → adminUpload → 触发器 中查看

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ======== 配置 ========
const ENV = 'cloud1-d6gmuaxy558d92f62';
// HTTP 触发器 URL（部署云函数后在云控制台获取）
const DEFAULT_FUNCTION_URL = process.env.CLOUD_FUNCTION_URL || '';

// ======== 参数解析 ========
const args = process.argv.slice(2);
let IMG_DIR = '';
let ATTRACTION_NAME = '';
let FUNCTION_URL = DEFAULT_FUNCTION_URL;
let DRY_RUN = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url' && args[i + 1]) {
    FUNCTION_URL = args[++i];
  } else if (args[i] === '--dry-run') {
    DRY_RUN = true;
  } else if (!IMG_DIR) {
    IMG_DIR = args[i];
  } else if (!ATTRACTION_NAME) {
    ATTRACTION_NAME = args[i];
  }
}

if (!IMG_DIR) {
  console.error('用法: node scripts/upload-images.js <图片目录> [景点名称] [--url <云函数URL>] [--dry-run]');
  console.error('');
  console.error('使用步骤:');
  console.error('  1. 在微信开发者工具中部署 cloudfunctions/adminUpload 云函数');
  console.error('  2. 在云控制台获取 HTTP 触发器 URL');
  console.error('  3. 运行: node scripts/upload-images.js "d:/photos" "安家庄村" --url "https://..."');
  console.error('');
  console.error('或设置环境变量: export CLOUD_FUNCTION_URL="https://..."');
  process.exit(1);
}

console.log('📸 去俺村 — 图片上传工具 (HTTP 模式)');
console.log('  图片目录:', IMG_DIR);
console.log('  目标景点:', ATTRACTION_NAME || '(未指定)');
console.log('  云函数URL:', FUNCTION_URL || '(未设置)');
if (DRY_RUN) console.log('  🔍 试运行模式（不实际上传）');
console.log('');

// ======== 找到匹配的图片文件 ========
function findImages(dir, prefix) {
  const files = [];
  if (!fs.existsSync(dir)) {
    console.error('❌ 目录不存在:', dir);
    return files;
  }
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    let stat;
    try { stat = fs.statSync(fullPath); } catch (e) { continue; }
    if (!stat.isFile()) continue;
    // 如果指定了景点名，按前缀匹配；否则取所有图片
    if (prefix && !entry.startsWith(prefix)) continue;
    const ext = path.extname(entry).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      files.push({ path: fullPath, name: entry, size: stat.size, ext });
    }
  }
  files.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  return files;
}

// ======== 压缩图片 ========
async function compressImage(filePath, outputPath) {
  const sharp = require('sharp');
  try {
    let pipeline = sharp(filePath);
    const metadata = await pipeline.metadata();
    if (metadata.width > 1920) {
      pipeline = pipeline.resize(1920, null, { withoutEnlargement: true });
    }
    const outPath = outputPath.replace(/\.(png|webp|jpeg)$/i, '.jpg');
    await pipeline.jpeg({ quality: 85 }).toFile(outPath);
    const outStat = fs.statSync(outPath);
    const inStat = fs.statSync(filePath);
    const ratio = ((1 - outStat.size / inStat.size) * 100).toFixed(0);
    console.log(`  🗜️  压缩: ${path.basename(filePath)} (${(inStat.size/1024).toFixed(0)}KB → ${(outStat.size/1024).toFixed(0)}KB, -${ratio}%)`);
    return outPath;
  } catch (err) {
    console.error(`  ❌ 压缩失败: ${filePath} — ${err.message}`);
    return null;
  }
}

// ======== HTTP POST 到云函数 ========
function httpPost(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const body = JSON.stringify(data);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 120000
    };
    const mod = urlObj.protocol === 'https:' ? https : http;
    const req = mod.request(options, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve(JSON.parse(text));
        } catch (e) {
          resolve({ _raw: Buffer.concat(chunks).toString('utf8') });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
    req.write(body);
    req.end();
  });
}

// ======== 主流程 ========
async function main() {
  const images = findImages(IMG_DIR, ATTRACTION_NAME);

  if (images.length === 0) {
    console.error(`❌ 未找到匹配的图片文件 (目录: ${IMG_DIR}, 前缀: "${ATTRACTION_NAME}")`);
    const allFiles = fs.readdirSync(IMG_DIR).filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.png', '.jpg', '.jpeg', '.webp'].includes(ext);
    });
    console.log('\n目录中的图片文件:');
    allFiles.forEach(f => console.log('  -', f));
    process.exit(1);
  }

  console.log(`📋 找到 ${images.length} 张图片:`);
  images.forEach(img => console.log(`  - ${img.name} (${(img.size/1024).toFixed(0)}KB)`));
  console.log('');

  if (!FUNCTION_URL && !DRY_RUN) {
    console.error('⚠️  未设置云函数 URL，无法实际上传');
    console.error('');
    console.error('请先部署 cloudfunctions/adminUpload 云函数，然后通过以下方式之一提供 URL:');
    console.error('  1. 命令行参数: --url "https://..."');
    console.error('  2. 环境变量: export CLOUD_FUNCTION_URL="https://..."');
    console.error('');
    console.error('或者使用 --dry-run 先试运行查看效果');
    process.exit(1);
  }

  // 创建临时目录
  const tmpDir = path.join(__dirname, '..', '.tmp-upload');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  // 压缩图片
  const compressedImages = [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    console.log(`[${i + 1}/${images.length}] 处理: ${img.name}`);
    const compressedPath = path.join(tmpDir, img.name);
    const actualPath = await compressImage(img.path, compressedPath);
    if (actualPath) {
      compressedImages.push({ fileName: path.basename(actualPath), localPath: actualPath });
    }
  }

  if (compressedImages.length === 0) {
    console.error('❌ 没有成功压缩的图片');
    process.exit(1);
  }

  console.log(`\n📊 压缩完成: ${compressedImages.length}/${images.length} 张`);
  console.log('');

  if (DRY_RUN) {
    console.log('🔍 试运行模式 — 不会实际上传');
    console.log(`会向 ${FUNCTION_URL || '(未设置URL)'} 发送 ${compressedImages.length} 张图片`);
    console.log(`目标景点: "${ATTRACTION_NAME}"`);
    // 清理临时文件
    const tmpFiles = fs.readdirSync(tmpDir);
    tmpFiles.forEach(f => fs.unlinkSync(path.join(tmpDir, f)));
    fs.rmdirSync(tmpDir);
    return;
  }

  // 通过 HTTP 发送到云函数
  const imagePayloads = compressedImages.map(img => ({
    base64: fs.readFileSync(img.localPath).toString('base64'),
    fileName: img.fileName
  }));

  console.log(`📤 发送 ${imagePayloads.length} 张图片到云函数...`);
  try {
    const result = await httpPost(FUNCTION_URL, {
      action: 'uploadImages',
      name: ATTRACTION_NAME,
      images: imagePayloads
    });

    if (result.success) {
      console.log('\n🎉 上传成功！');
      console.log(`  已上传: ${result.uploaded}/${result.total} 张`);
      console.log('  云存储 fileID:');
      (result.fileIDs || []).forEach(id => console.log('    ' + id));
      if (result.errors && result.errors.length > 0) {
        console.log('  错误:');
        result.errors.forEach(e => console.log('    ❌', JSON.stringify(e)));
      }
    } else {
      console.error('\n❌ 云函数返回失败:', result.error || JSON.stringify(result));
    }
  } catch (err) {
    console.error('\n❌ 请求失败:', err.message);
    console.error('');
    console.error('请检查:');
    console.error('  1. 云函数是否已部署');
    console.error('  2. HTTP 触发器 URL 是否正确');
    console.error('  3. 网络连接是否正常');
  }

  // 清理临时目录
  try {
    const tmpFiles = fs.readdirSync(tmpDir);
    tmpFiles.forEach(f => fs.unlinkSync(path.join(tmpDir, f)));
    fs.rmdirSync(tmpDir);
  } catch (e) {}
}

main().catch(err => {
  console.error('❌ 执行失败:', err.message);
  process.exit(1);
});
