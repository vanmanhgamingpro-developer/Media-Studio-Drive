'use strict';
// Đóng gói thành 1 file bin\MediaPlayer.exe (Node SEA). Chạy trên Windows có Node 22.13+: node build.js
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
// build.js nằm trong "SETTING\js\"; R là thư mục SETTING\. PROJECT_ROOT là gốc dự án THẬT.
// EXE runtime luôn được tạo mới trong PROJECT_ROOT\bin\.
// (chứa public\, img\, video\, data\), nằm 1 cấp TRÊN SETTING\ — chỉ dùng để lấy asset public\.
const D = __dirname, R = path.join(D, '..'), PROJECT_ROOT = path.join(R, '..'), OUT = path.join(PROJECT_ROOT, 'bin'), EXE = path.join(OUT, 'MediaPlayer.exe'), BLOB = path.join(OUT, 'sea.blob');

// Kiểm tra các file nguồn thực sự được MediaPlayer.exe dùng khi build.
const srcOf = f => {
  const dirs = [R, path.join(R, 'ps1')];
  const candidates = dirs.flatMap(d => [path.join(d, f), path.join(d, f + '.txt')]);
  return candidates.find(fs.existsSync) || candidates[1];
};
const REQUIRED = ['tray.ps1'];
const missing = REQUIRED.filter(f => { try { return fs.statSync(srcOf(f)).size < 20; } catch { return true; } });
if (missing.length) {
  console.error('\n[LOI] Thieu hoac rong file nguon (ca ban goc lan ban .txt): ' + missing.join(', '));
  console.error('Cac file nay phai co mat trong thu muc nay (dang .txt cung duoc, khong bat buoc doi ten).');
  console.error('Xem huong dan trong DOI_TEN_FILE_SAU_KHI_GIAI_NEN.txt roi chay lai "node build.js".\n');
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });
// Xóa file exe cũ nếu tồn tại để tránh lỗi postject
if (fs.existsSync(EXE)) {
  console.log('[0/4] Xóa MediaPlayer.exe cũ...');
  try {
    fs.unlinkSync(EXE);
  } catch (e) {
    console.error('[CANH BAO] Không xóa được exe cũ:', e.message);
    console.error('Hãy đóng MediaPlayer và chạy lại.');
    process.exit(1);
  }
}
fs.writeFileSync(path.join(OUT, 'sea-config.json'), JSON.stringify({ main: path.join(D, 'server.js'), output: BLOB, disableExperimentalSEAWarning: true, useCodeCache: false,
  assets: { 'index.html': path.join(PROJECT_ROOT, 'public/index.html'), 'app.js': path.join(PROJECT_ROOT, 'public/app.js'), 'style.css': path.join(PROJECT_ROOT, 'public/style.css'), 'guard.js': path.join(PROJECT_ROOT, 'public/guard.js'), 'tray.ps1': srcOf('tray.ps1') } }, null, 2));
console.log('[1/4] Tạo SEA blob…'); execFileSync(process.execPath, ['--experimental-sea-config', path.join(OUT, 'sea-config.json')], { stdio: 'inherit' });
console.log('[2/4] Sao chép node.exe…'); fs.copyFileSync(process.execPath, EXE);
console.log('[3/4] Nhúng script + giao diện vào exe (postject, cần internet lần đầu)…');
// Kiểm tra files tồn tại
if (!fs.existsSync(EXE)) throw new Error('EXE không tồn tại: ' + EXE);
if (!fs.existsSync(BLOB)) throw new Error('BLOB không tồn tại: ' + BLOB);
// Chạy postject với shell và timeout dài hơn
try {
  execFileSync('npx', ['--yes', 'postject@1.0.0-alpha.6', EXE, 'NODE_SEA_BLOB', BLOB, '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'], { stdio: 'inherit', shell: true, timeout: 120000 });
} catch (e) {
  console.error('\n[LOI] Postject that bai. Thu chay thu cong:');
  console.error('npx --yes postject@1.0.0-alpha.6 "' + EXE + '" NODE_SEA_BLOB "' + BLOB + '" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2');
  throw e;
}
console.log('[4/4] Đặt chế độ không cửa sổ console…');
const b = fs.readFileSync(EXE), pe = b.readUInt32LE(0x3C);
if (b.toString('latin1', pe, pe + 4) !== 'PE\0\0') throw new Error('Không phải file PE (Windows)');
b.writeUInt16LE(2, pe + 24 + 68); fs.writeFileSync(EXE, b); // Subsystem = WINDOWS_GUI
fs.rmSync(BLOB, { force: true }); fs.rmSync(path.join(OUT, 'sea-config.json'), { force: true });
console.log('\nXong: ' + EXE + '\n(MediaPlayer.bat o goc se tu tao lai bin\ moi moi lan chay.)');
