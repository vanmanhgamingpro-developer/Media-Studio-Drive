'use strict';
// MediaPlayer — chạy bằng Node.js (Windows / Linux / macOS / VPS hosting)
//
//   node start.js                 bật web; lần đầu tự cài Cloudflare Tunnel, hỏi miền phụ, in link;
//                                 các lần sau đã có tunnel thì TỰ BẬT web + tunnel, không hỏi gì
//   node start.js --reconfig      cài lại tunnel / đổi miền
//   node start.js --no-tunnel     chỉ chạy web (không tunnel)
//   node start.js --host=media    không hỏi, dùng media.<miền chính đã lưu> (cho chạy nền / systemd)
//   node start.js --host=media.example.com --name=ten-tunnel
// Cần Node.js 22.13 trở lên.
const fs = require('fs'), path = require('path'), net = require('net'), { spawn, spawnSync } = require('child_process');
const T = require('./Setting/js/tunnel.js');

const arg = k => { const m = process.argv.find(a => a.startsWith('--' + k + '=')); return m ? m.slice(k.length + 3) : ''; };
const flag = k => process.argv.includes('--' + k);
if (flag('help') || flag('h')) { console.log(require('fs').readFileSync(__filename, 'utf8').split('\n').slice(1, 12).map(l => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(0); }

const [maj, min] = process.versions.node.split('.').map(Number);
if (maj < 22 || (maj === 22 && min < 13)) { console.error('[LỖI] Cần Node.js >= 22.13 (đang dùng ' + process.versions.node + '). Tải tại https://nodejs.org'); process.exit(1); }
if (process.platform === 'win32' && process.stdout.isTTY) spawnSync('cmd', ['/c', 'chcp 65001 >nul'], { stdio: 'inherit' }); // hiện tiếng Việt đúng trên console Windows

const ROOT = __dirname, SERVER = path.join(ROOT, 'Setting', 'js', 'server.js'), say = T.say;
const ENVF = path.join(ROOT, 'Setting', '.env'), SRVLOG = path.join(ROOT, 'data', 'logs', 'server.log');
let srv = null, sup = null, stopping = false, crashes = [];

const blockLocalOn = () => { try { const m = /^[ \t]*BLOCK_LOCALHOST[ \t]*=[ \t]*["']?([A-Za-z0-9]+)/mi.exec(fs.readFileSync(ENVF, 'utf8')); return !!m && /^(on|1|true|yes)$/i.test(m[1]); } catch { return false; } };
const clearLogs = () => { // mỗi lần chạy: xoá log cũ
  for (const d of [path.join(ROOT, 'data', 'logs'), T.LOGS]) { try { for (const f of fs.readdirSync(d)) { try { fs.rmSync(path.join(d, f), { force: true }); } catch {} } } catch {} }
};
const lastLog = () => { try { return fs.readFileSync(SRVLOG, 'utf8').trim().split(/\r?\n/).slice(-6).join('\n'); } catch { return ''; } };

function startServer() {
  // server chạy im lặng (log vào data/logs/server.log); NODE_NO_WARNINGS ẩn cảnh báo SQLite
  srv = spawn(process.execPath, [SERVER], { cwd: ROOT, stdio: 'ignore', env: { ...process.env, NODE_NO_WARNINGS: '1' } });
  srv.on('error', e => console.log('[LỖI] Không chạy được server.js:', e.message));
  srv.on('close', (code, sig) => {
    if (stopping) return;
    if (code === 0) return shutdown(0);
    const now = Date.now(); crashes = crashes.filter(t => now - t < 60000); crashes.push(now);
    if (crashes.length >= 5) { console.log('[LỖI] Server sập liên tục — dừng. Log cuối:\n' + lastLog()); return shutdown(1); }
    setTimeout(startServer, 3000);
  });
}
function shutdown(code = 0) {
  if (stopping) return; stopping = true;
  try { sup && sup.stop(); } catch {}
  try { srv && srv.kill(); } catch {}
  setTimeout(() => process.exit(code), 800).unref();
}
process.on('SIGINT', () => shutdown(0)); process.on('SIGTERM', () => shutdown(0));

function waitPort(port, ms = 45000) {
  const t0 = Date.now();
  return new Promise(ok => { const tick = () => { const s = net.connect(port, '127.0.0.1'); s.once('connect', () => { s.destroy(); ok(true); }); s.once('error', () => { s.destroy(); Date.now() - t0 > ms ? ok(false) : setTimeout(tick, 600); }); }; tick(); });
}

async function tunnelFlow() {
  await T.ensureCloudflared();
  let redo = flag('reconfig') || !T.hasConfig();
  const want = arg('host') || process.env.TUNNEL_HOST;
  if (!redo && want) { const p = T.parseHost(want, T.readRoot()); if (!p.host || p.host !== T.readLinked().hostname) redo = true; } // --host khác miền đang dùng → cài lại
  if (redo) {
    T.setQuiet(false); // đang cài đặt → hiện đầy đủ để thấy link đăng nhập / câu hỏi
    if (!T.canPrompt() && !want) {
      say('[CẢNH BÁO] Chưa cài tunnel và không có terminal để nhập. Web vẫn chạy ở cổng nội bộ.\n   → Chạy 1 lần trong terminal:  node start.js --reconfig\n   → hoặc không cần nhập:       node start.js --host=media   (media.<miền chính đã lưu>)');
      return null;
    }
    await T.setup({ host: arg('host'), tunnelName: arg('name') });
  } else T.syncOrigin(T.readPort()); // ĐÃ CÓ tunnel: không hỏi gì, tự đưa web lên luôn
  T.closeInput();
  sup = T.superviseTunnel();
  return T.readLinked().hostname;
}

(async () => {
  const setup = flag('reconfig') || arg('host') || process.env.TUNNEL_HOST;
  if (!setup) { T.setQuiet(true); clearLogs(); console.clear(); } // chạy bình thường: xoá màn hình + log cũ, im lặng
  else console.log('==========================================================\n  MEDIAPLAYER — cài đặt tunnel\n==========================================================');
  await require('./Setting/js/platform.js').sync().catch(() => {}); // tự đổi PORT/dọn file theo Windows ↔ hosting
  startServer();
  const port = T.readPort();
  const auto = !flag('no-tunnel') && !flag('reconfig') && T.hasConfig() && !(arg('host') || process.env.TUNNEL_HOST);
  let early = null; if (auto) early = tunnelFlow().catch(e => { console.log('[LỖI TUNNEL] ' + e.message); return null; });
  const up = await waitPort(port);
  if (!up) { console.log('[LỖI] Web không mở được ở cổng ' + port + '. Log cuối:\n' + lastLog()); return; }

  let host = null;
  if (!flag('no-tunnel')) { try { host = early ? await early : await tunnelFlow(); } catch (e) { console.log('[LỖI TUNNEL] ' + e.message); T.closeInput(); } }

  if (setup) console.clear();
  const hide = blockLocalOn(); // BLOCK_LOCALHOST=on → ẩn mọi link
  console.log('[OK] MediaPlayer đã chạy.');
  if (!hide) { console.log('  Web      : http://127.0.0.1:' + port); if (host) console.log('  Link web : https://' + host); }
})();
