// scripts/batch-upload.js — 批量压缩+上传所有景点图片到云存储
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sharp = require('sharp');

const IMG_DIR = 'd:/xwechat_files/wxid_h0zgmmszslw522_095f/msg/file/2026-06/去俺村乡村照片(1)/去俺村乡村照片';
const ENV = 'cloud1-d6gmuaxy558d92f62';
const TMP_DIR = path.join(__dirname, '..', '.tmp-batch');
const BUCKET = '636c-cloud1-d6gmuaxy558d92f62-1439369897';

// 图片文件名 → DB 景点名映射（处理拼写差异）
const NAME_MAP = {
  '王琳坡村': '王林坡村',
  '马蹄欲村': '马蹄峪村',
};

// 已处理过的景点（安家庄村已有4张新图）
const SKIP = ['安家庄村'];

function normalizeName(fileName) {
  // 去掉数字序号和扩展名：白马石村1.jpg → 白马石村
  return fileName.replace(/[0-9]*\.[^.]+$/, '').replace(/[0-9]+$/, '');
}

function tcb(cmd) {
  const fullCmd = `tcb ${cmd} --env-id ${ENV} --json 2>&1`;
  try {
    return execSync(fullCmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, timeout: 120000 });
  } catch (e) {
    return e.stdout || e.message;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // Step 1: 扫描图片并按景点分组
  const allFiles = fs.readdirSync(IMG_DIR).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
  const groups = {};

  for (const file of allFiles) {
    const rawName = normalizeName(file);
    const dbName = NAME_MAP[rawName] || rawName;
    if (SKIP.includes(dbName)) {
      console.log(`  ⏭️  跳过: ${file} (${dbName} 已处理)`);
      continue;
    }
    if (!groups[dbName]) groups[dbName] = [];
    groups[dbName].push(path.join(IMG_DIR, file));
  }

  const villageNames = Object.keys(groups).sort();
  console.log(`📋 待处理: ${villageNames.length} 个景点, ${Object.values(groups).flat().length} 张图片\n`);

  if (villageNames.length === 0) {
    console.log('没有需要处理的图片');
    return;
  }

  // Step 2: 创建临时目录
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

  // Step 3: 逐景点处理
  let totalUploaded = 0;
  const results = [];

  for (let vi = 0; vi < villageNames.length; vi++) {
    const village = villageNames[vi];
    const imagePaths = groups[village];
    console.log(`[${vi + 1}/${villageNames.length}] 🏘️  ${village} (${imagePaths.length}张)`);

    const uploadedIDs = [];

    for (let ii = 0; ii < imagePaths.length; ii++) {
      const imgPath = imagePaths[ii];
      const imgName = path.basename(imgPath);
      const outName = imgName.replace(/\.(png|webp|jpeg)$/i, '.jpg');
      const outPath = path.join(TMP_DIR, outName);

      // 压缩
      try {
        const metadata = await sharp(imgPath).metadata();
        let pipeline = sharp(imgPath);
        if (metadata.width > 1920) {
          pipeline = pipeline.resize(1920, null, { withoutEnlargement: true });
        }
        await pipeline.jpeg({ quality: 85 }).toFile(outPath);
        const inSize = fs.statSync(imgPath).size;
        const outSize = fs.statSync(outPath).size;
        const ratio = ((1 - outSize / inSize) * 100).toFixed(0);
        console.log(`  🗜️  ${imgName}: ${(inSize/1024).toFixed(0)}KB → ${(outSize/1024).toFixed(0)}KB (-${ratio}%)`);
      } catch (err) {
        console.error(`  ❌ 压缩失败: ${imgName} — ${err.message}`);
        continue;
      }

      // 上传
      const timestamp = Date.now();
      const rand = Math.random().toString(36).substring(2, 6);
      const cloudPath = `attractions/${timestamp}_${rand}_${outName}`;

      const uploadOut = tcb(`storage upload "${outPath}" "${cloudPath}"`);
      if (uploadOut.includes('上传文件成功')) {
        const fileID = `cloud://${ENV}.${BUCKET}/${cloudPath}`;
        uploadedIDs.push(fileID);
        console.log(`  ✅ 上传: ${cloudPath}`);
      } else {
        console.log(`  ❌ 上传失败: ${cloudPath}`);
        // 打印错误信息
        const errLine = uploadOut.split('\n').find(l => l.includes('error') || l.includes('Error') || l.includes('fail'));
        if (errLine) console.log(`     ${errLine.trim()}`);
      }

      // 小延迟避免限流
      await sleep(300);
    }

    if (uploadedIDs.length === 0) {
      console.log(`  ⚠️  无成功上传，跳过数据库更新\n`);
      results.push({ village, uploaded: 0, total: imagePaths.length });
      continue;
    }

    // 更新数据库：写 JSON 文件 + shell cat 传参，避免嵌套转义
    let dbOk = 0;
    for (const fid of uploadedIDs) {
      const cmdObj = [{
        TableName: 'attractions',
        CommandType: 'UPDATE',
        Command: JSON.stringify({
          update: 'attractions',
          updates: [{ q: { name: village }, u: { $push: { images: fid } } }]
        })
      }];
      const tmpFile = path.join(TMP_DIR, '_cmd.json');
      fs.writeFileSync(tmpFile, JSON.stringify(cmdObj));
      // 使用反斜杠转义的特殊格式，和之前手动测试成功的格式一致
      const cmdJson = JSON.stringify(cmdObj).replace(/"/g, '\\"');
      const dbOut = tcb(`db nosql execute --command "${cmdJson}"`);
      if (dbOut.includes('"nModified"')) {
        dbOk++;
      } else {
        console.log(`  ❌ DB更新失败: ${fid.split('/').pop()}`);
        const errMatch = dbOut.match(/"message":"([^"]+)"/);
        if (errMatch) console.log(`     ${errMatch[1]}`);
      }
      await sleep(200);
    }

    console.log(`  📝 DB: ${dbOk}/${uploadedIDs.length} 写入成功\n`);
    results.push({ village, uploaded: uploadedIDs.length, dbWritten: dbOk, total: imagePaths.length });
    totalUploaded += dbOk;
  }

  // Step 4: 清理 + 汇总
  try {
    const tmpFiles = fs.readdirSync(TMP_DIR);
    tmpFiles.forEach(f => fs.unlinkSync(path.join(TMP_DIR, f)));
    fs.rmdirSync(TMP_DIR);
  } catch (e) {}

  console.log('═══════════════════════════════════');
  console.log('📊 批量上传完成:');
  for (const r of results) {
    const status = r.dbWritten === r.total ? '✅' : r.dbWritten > 0 ? '⚠️' : '❌';
    console.log(`  ${status} ${r.village}: ${r.dbWritten}/${r.total} 张`);
  }
  console.log(`\n🎉 总计: ${totalUploaded} 张图片已入库`);
}

main().catch(err => {
  console.error('❌ 执行失败:', err.message);
  process.exit(1);
});
