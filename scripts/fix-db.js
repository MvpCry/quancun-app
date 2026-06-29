// scripts/fix-db.js — 批量更新数据库 images 字段（修复 batch-upload 的 DB 写入）
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENV = 'cloud1-d6gmuaxy558d92f62';
const BUCKET = '636c-cloud1-d6gmuaxy558d92f62-1439369897';
const TMP = path.join(__dirname, '..', '.tmp-batch');

// 从 batch-upload.js 运行日志中提取的所有上传记录
const uploads = [
  { v: '上豹峪村', f: 'attractions/1782719926813_9aqq_上豹峪村.jpg' },
  { v: '上豹峪村', f: 'attractions/1782719930233_kb76_上豹峪村1.jpg' },
  { v: '上豹峪村', f: 'attractions/1782719933716_l4o2_上豹峪村2.jpg' },
  { v: '五埠岭村', f: 'attractions/1782719944340_zd07_五埠岭村.jpg' },
  { v: '五埠岭村', f: 'attractions/1782719947638_9rdw_五埠岭村1.jpg' },
  { v: '五埠岭村', f: 'attractions/1782719950722_t8zj_五埠岭村2.jpg' },
  { v: '五埠岭村', f: 'attractions/1782719954128_is3m_五埠岭村3.jpg' },
  { v: '北张村', f: 'attractions/1782719968065_swr6_北张村.jpg' },
  { v: '北张村', f: 'attractions/1782719971184_d4r1_北张村1.jpg' },
  { v: '北张村', f: 'attractions/1782719974522_59ag_北张村2.jpg' },
  { v: '北张村', f: 'attractions/1782719977688_5yge_北张村3.jpg' },
  { v: '北张村', f: 'attractions/1782719981051_10bl_北张村4.jpg' },
  { v: '北张村', f: 'attractions/1782719984216_tf1u_北张村5.jpg' },
  { v: '埠阳庄村', f: 'attractions/1782720002336_kbln_埠阳庄村.jpg' },
  { v: '埠阳庄村', f: 'attractions/1782720005575_t1iv_埠阳庄村1.jpg' },
  { v: '埠阳庄村', f: 'attractions/1782720008725_mp0k_埠阳庄村2.jpg' },
  { v: '埠阳庄村', f: 'attractions/1782720012246_a1u0_埠阳庄村3.jpg' },
  { v: '埠阳庄村', f: 'attractions/1782720015636_8p84_埠阳庄村4.jpg' },
  { v: '朱家洼村', f: 'attractions/1782720031522_tamh_朱家洼村.jpg' },
  { v: '朱家洼村', f: 'attractions/1782720034946_zged_朱家洼村1.jpg' },
  { v: '朱家洼村', f: 'attractions/1782720038084_95y5_朱家洼村2.jpg' },
  { v: '朱家洼村', f: 'attractions/1782720041299_lxhe_朱家洼村3.jpg' },
  { v: '朱家洼村', f: 'attractions/1782720044623_dogl_朱家洼村3.jpg' },
  { v: '水牛埠村', f: 'attractions/1782720060654_vy0v_水牛埠村.jpg' },
  { v: '水牛埠村', f: 'attractions/1782720064375_j27p_水牛埠村1.jpg' },
  { v: '浮粮店村', f: 'attractions/1782720072618_s0yx_浮粮店村.jpg' },
  { v: '浮粮店村', f: 'attractions/1782720075808_lf0g_浮粮店村1.jpg' },
  { v: '浮粮店村', f: 'attractions/1782720079030_up2s_浮粮店村2.jpg' },
  { v: '浮粮店村', f: 'attractions/1782720082279_8zr2_浮粮店村3.jpg' },
  { v: '王林坡村', f: 'attractions/1782720095879_lvgp_王琳坡村.jpg' },
  { v: '王林坡村', f: 'attractions/1782720099082_wugk_王琳坡村1.jpg' },
  { v: '王林坡村', f: 'attractions/1782720102176_er85_王琳坡村2.jpg' },
  { v: '王林坡村', f: 'attractions/1782720105455_1gti_王琳坡村3.jpg' },
  { v: '白马石村', f: 'attractions/1782720118948_jdwl_白马石村.jpg' },
  { v: '白马石村', f: 'attractions/1782720123007_cpb5_白马石村1.jpg' },
  { v: '白马石村', f: 'attractions/1782720126486_8vug_白马石村2.jpg' },
  { v: '白马石村', f: 'attractions/1782720129739_99lj_白马石村3.jpg' },
  { v: '白马石村', f: 'attractions/1782720132927_8w3i_白马石村4.jpg' },
  { v: '白马石村', f: 'attractions/1782720136322_wd1s_白马石村5.jpg' },
  { v: '白马石村', f: 'attractions/1782720139622_x5vh_白马石村6.jpg' },
  { v: '里峪村', f: 'attractions/1782720160589_36yc_里峪村.jpg' },
  { v: '里峪村', f: 'attractions/1782720164094_s6kc_里峪村1.jpg' },
  { v: '里峪村', f: 'attractions/1782720167260_g0qs_里峪村2.jpg' },
  { v: '里峪村', f: 'attractions/1782720170590_hrg3_里峪村3.jpg' },
  { v: '里峪村', f: 'attractions/1782720173648_tlll_里峪村4.jpg' },
  { v: '马套村', f: 'attractions/1782720189320_oekw_马套村.jpg' },
  { v: '马套村', f: 'attractions/1782720192636_xm8d_马套村1.jpg' },
  { v: '马套村', f: 'attractions/1782720195857_b6qo_马套村2.jpg' },
  { v: '马套村', f: 'attractions/1782720199134_rvtr_马套村3.jpg' },
  { v: '马套村', f: 'attractions/1782720202609_lkrp_马套村4.jpg' },
  { v: '马蹄峪村', f: 'attractions/1782720218889_1tn8_马蹄欲村.jpg' },
  { v: '马蹄峪村', f: 'attractions/1782720222262_enh6_马蹄欲村1.jpg' },
  { v: '马蹄峪村', f: 'attractions/1782720225720_3xwv_马蹄欲村2.jpg' },
  { v: '马蹄峪村', f: 'attractions/1782720229208_nr2a_马蹄欲村3.jpg' },
  { v: '马蹄峪村', f: 'attractions/1782720232456_pjhl_马蹄欲村4.jpg' },
  { v: '黄山头村', f: 'attractions/1782720248170_bxrr_黄山头村.jpg' },
  { v: '黄山头村', f: 'attractions/1782720251366_lh9c_黄山头村1.jpg' },
];

if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

const CMD_FILE = path.join(TMP, '_u.json');
let ok = 0, fail = 0;
const groupOk = {};

for (let i = 0; i < uploads.length; i++) {
  const u = uploads[i];
  const fid = 'cloud://' + ENV + '.' + BUCKET + '/' + u.f;

  const cmdObj = [{
    TableName: 'attractions',
    CommandType: 'UPDATE',
    Command: JSON.stringify({
      update: 'attractions',
      updates: [{ q: { name: u.v }, u: { '$push': { images: fid } } }]
    })
  }];

  fs.writeFileSync(CMD_FILE, JSON.stringify(cmdObj));

  try {
    // Use shell to substitute file content into command
    const shellCmd = 'tcb db nosql execute --env-id ' + ENV + ' --command "$(cat ' + CMD_FILE.replace(/\\/g, '/') + ')" --json 2>&1';
    const out = execSync(shellCmd, { encoding: 'utf8', timeout: 15000, shell: 'bash' });
    if (out.includes('"nModified"')) {
      ok++;
      groupOk[u.v] = (groupOk[u.v] || 0) + 1;
      process.stdout.write('.');
    } else {
      fail++;
      process.stdout.write('X');
    }
  } catch (e) {
    fail++;
    process.stdout.write('E');
  }
}

console.log('\n\nDone:', ok, 'OK,', fail, 'FAIL\n');

// Per-village summary
console.log('Per village:');
const villages = [...new Set(uploads.map(u => u.v))];
for (const v of villages) {
  const total = uploads.filter(u => u.v === v).length;
  const done = groupOk[v] || 0;
  console.log('  ' + (done === total ? '✅' : '❌') + ' ' + v + ': ' + done + '/' + total);
}
