'use strict';
// Tự thích nghi khi copy dự án giữa Windows <-> hosting/Linux. Chạy ở đầu start.js (mỗi lần khởi động, idempotent).
//  • Linux/hosting: PORT lấy từ biến của hosting (SERVER_PORT / PORT); không có thì giữ cổng cũ nếu rảnh, bận thì tìm cổng rảnh.
//                   Chuyển (không xoá) file exe của Windows sang Setting/_windows-only — GIỮ .bat/.cmd/ps1 để quay lại Windows dễ.
//  • Windows:       trả lại cổng Windows đã lưu trước đó, xoá binary cloudflared của Linux để tự tải bản đúng.
//  • config.yml của tunnel được viết lại đường dẫn theo máy hiện tại (tunnel.js → refreshConfig).
const fs = require('fs'), path = require('path'), net = require('net');
const ROOT = process.env.MP_ROOT ? path.resolve(process.env.MP_ROOT) : path.resolve(__dirname, '..', '..');
const SETTING = path.join(ROOT, 'Setting'), ENVF = path.join(SETTING, '.env'), MARK = path.join(SETTING, '.platform.json');
const WIN = process.platform === 'win32';
const say = m => { if (process.env.MP_VERBOSE === '1') console.log('[PLATFORM] ' + m); };
const rd = f => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const rdJson = f => { try { return JSON.parse(rd(f).replace(/^﻿/, '')); } catch { return {}; } };
const rm = p => { try { if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); return true; } } catch {} return false; };
const valid = n => Number.isInteger(n) && n >= 1 && n <= 65535;

function readEnvPort() { const m = /^\s*PORT\s*=\s*["']?(\d{1,5})/m.exec(rd(ENVF)); return m ? +m[1] : 0; }
function writeEnvPort(port) {
  let t = rd(ENVF); const eol = t.includes('\r\n') || (!t && WIN) ? '\r\n' : '\n';
  if (/^\s*PORT\s*=.*$/m.test(t)) t = t.replace(/^\s*PORT\s*=.*$/m, 'PORT=' + port);
  else t = 'PORT=' + port + eol + t;
  fs.mkdirSync(SETTING, { recursive: true }); fs.writeFileSync(ENVF, t);
}
const isFree = port => new Promise(ok => { const s = net.createServer(); s.once('error', () => ok(false)); s.once('listening', () => s.close(() => ok(true))); s.listen(port, '127.0.0.1'); });
async function freePort(from) { for (let p = from; p < from + 200; p++) if (valid(p) && await isFree(p)) return p; return from; }

async function sync() {
  const mark = rdJson(MARK), cur = readEnvPort() || 6556, changed = mark.os && mark.os !== process.platform;
  const next = { os: process.platform, winPort: mark.winPort || 0 };
  if (WIN) {
    if (changed && valid(mark.winPort) && mark.winPort !== cur) { writeEnvPort(mark.winPort); say(`Về Windows: trả cổng ${cur} → ${mark.winPort}`); }
    if (changed) say('Về Windows: sẽ dùng cloudflared.exe (tự tải nếu thiếu).');
    next.winPort = readEnvPort() || cur;
  } else {
    if (mark.os === 'win32' || !mark.os) next.winPort = mark.winPort || (mark.os === 'win32' ? cur : 0) || (changed ? cur : 0);
    const envPort = +process.env.SERVER_PORT || +process.env.PORT_OVERRIDE || +process.env.PORT || 0; // Pterodactyl: SERVER_PORT
    let port = valid(envPort) ? envPort : cur;
    if (!valid(envPort) && !(await isFree(port))) port = await freePort(port); // chỉ tìm cổng mới nếu cổng cũ đang bận
    if (port !== readEnvPort()) { writeEnvPort(port); say(`Hosting: đặt PORT=${port}` + (valid(envPort) ? ' (theo biến của hosting)' : ' (tự chọn)') + ` — trước đó ${cur}`); }
    process.env.PORT = String(port);
    // file chỉ dùng cho Windows → CHUYỂN (không xoá) vào Setting/_windows-only/ để lấy lại được; .bat/.cmd/ps1 giữ nguyên
    const keep = path.join(SETTING, '_windows-only'), moved = [];
    try { for (const f of fs.readdirSync(path.join(ROOT, 'bin'))) if (/\.(exe|blob)$/i.test(f)) { fs.mkdirSync(keep, { recursive: true }); fs.renameSync(path.join(ROOT, 'bin', f), path.join(keep, f)); moved.push('bin/' + f); } } catch {}
    if (moved.length) say('Đã chuyển file Windows vào Setting/_windows-only: ' + moved.join(', '));
  }
  if (changed) say(`Phát hiện chuyển nền tảng: ${mark.os} → ${process.platform}.`);
  try { fs.writeFileSync(MARK, JSON.stringify(next)); } catch {}
  try { require('./tunnel.js').refreshConfig && require('./tunnel.js').refreshConfig(); } catch {}
  return readEnvPort() || 6556;
}
module.exports = { sync };
