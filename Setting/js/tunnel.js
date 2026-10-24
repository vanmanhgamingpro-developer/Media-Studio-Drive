'use strict';
// Cloudflare Tunnel bằng Node.js — chạy trên Windows / Linux / macOS (VPS, hosting).
// Làm đúng các bước của CloudflareTunnelAuto.bat và DÙNG CHUNG thư mục Setting\cloudflare_Tunnel,
// nên cấu hình tạo bằng .bat hay bằng file này đều dùng lẫn được.
//
//   node Setting/js/tunnel.js setup [--host=media] [--name=ten-tunnel]   cài + đăng nhập + chọn miền + tạo tunnel
//   node Setting/js/tunnel.js start | stop | status | reset
// (thường không cần gọi trực tiếp: chạy  node start.js  ở thư mục gốc là tự làm hết)
const fs = require('fs'), path = require('path'), os = require('os'), https = require('https'), readline = require('readline');
const { spawn, spawnSync } = require('child_process');

const WIN = process.platform === 'win32', MAC = process.platform === 'darwin';
const ROOT = process.env.MP_ROOT ? path.resolve(process.env.MP_ROOT) : path.resolve(__dirname, '..', '..');
const SETTING = path.join(ROOT, 'Setting'), CF_DIR = path.join(SETTING, 'cloudflare_Tunnel');
const CREDS = path.join(CF_DIR, 'credentials'), LOGS = path.join(CF_DIR, 'logs'), BIN_DIR = path.join(ROOT, 'bin');
const CERT = path.join(CF_DIR, 'cert.pem'), CONFIG = path.join(CF_DIR, 'config.yml'), ROOTFILE = path.join(CF_DIR, 'root-domain.txt');
const FLAG = path.join(CF_DIR, 'disabled.flag'), PIDF = path.join(CF_DIR, 'tunnel.pid'), LINKED = path.join(CF_DIR, 'tunnel-linked.json'), ENVF = path.join(SETTING, '.env');
let CFX = process.env.CLOUDFLARED_BIN || path.join(BIN_DIR, WIN ? 'cloudflared.exe' : 'cloudflared');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const mkdirs = () => [CF_DIR, CREDS, LOGS, BIN_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));
function log(m) { try { mkdirs(); fs.appendFileSync(path.join(LOGS, 'setup.log'), new Date().toISOString() + ' ' + m + '\n'); } catch {} }
let QUIET = process.env.MP_QUIET === '1'; // quiet: chỉ ghi vào log file, trên màn hình chỉ hiện [LỖI]
const setQuiet = v => { QUIET = !!v; };
const say = (...a) => { if (!QUIET || /^\s*\[LỖI/.test(String(a[0]))) console.log(...a); log(a.join(' ')); };
const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '')); } catch { return {}; } };
const writeJson = (f, o) => fs.writeFileSync(f, JSON.stringify(o));

// ---------- nhập từ bàn phím (hàng đợi dùng chung, không mất dòng khi nhập qua pipe) ----------
let rl = null, eof = false; const lines = [], waiters = [];
function initIn() {
  if (rl) return; eof = false;
  rl = readline.createInterface({ input: process.stdin });
  rl.on('line', l => { const w = waiters.shift(); w ? w(l) : lines.push(l); });
  rl.on('close', () => { eof = true; rl = null; while (waiters.length) waiters.shift()(null); });
}
function ask(q, ms, def = '') { // → chuỗi; null nếu không còn đầu vào (stdin đã đóng)
  initIn(); process.stdout.write(q);
  return new Promise(ok => {
    if (lines.length) return ok(lines.shift());
    if (eof) return ok(null);
    let t = null; const w = v => { clearTimeout(t); ok(v); };
    if (ms) t = setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0) waiters.splice(i, 1); process.stdout.write('\n'); ok(def); }, ms);
    waiters.push(w);
  });
}
function closeInput() { if (rl) { rl.close(); rl = null; } try { process.stdin.pause(); } catch {} }
const canPrompt = () => !!process.stdin.isTTY || process.env.TUNNEL_FORCE_PROMPT === '1';

// ---------- mạng ----------
function httpGet(url, ms = 8000) {
  return new Promise(ok => { const r = https.get(url, { timeout: ms, headers: { 'User-Agent': 'MediaPlayer-Tunnel' } }, res => { res.resume(); ok(res.statusCode); }); r.on('timeout', () => { r.destroy(); ok(0); }); r.on('error', () => ok(0)); });
}
function download(url, dest, redirects = 8) {
  return new Promise((ok, no) => {
    const req = https.get(url, { headers: { 'User-Agent': 'MediaPlayer-Tunnel' } }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) { res.resume(); if (!redirects) return no(new Error('quá nhiều chuyển hướng')); return download(new URL(res.headers.location, url).href, dest, redirects - 1).then(ok, no); }
      if (res.statusCode !== 200) { res.resume(); return no(new Error('HTTP ' + res.statusCode)); }
      const total = +res.headers['content-length'] || 0, tmp = dest + '.part', f = fs.createWriteStream(tmp); let got = 0, last = 0;
      res.on('data', c => { got += c.length; if (total && process.stdout.isTTY && Date.now() - last > 300) { last = Date.now(); process.stdout.write('\r      Đang tải... ' + Math.round(got / total * 100) + '%'); } });
      res.pipe(f); res.on('error', no); f.on('error', no);
      f.on('finish', () => f.close(() => { if (process.stdout.isTTY) process.stdout.write('\r' + ' '.repeat(40) + '\r'); try { fs.renameSync(tmp, dest); ok(); } catch (e) { no(e); } }));
    });
    req.setTimeout(60000, () => req.destroy(new Error('hết thời gian chờ'))); req.on('error', no);
  });
}

// ---------- cloudflared ----------
function assetName() {
  const a = { x64: 'amd64', arm64: 'arm64', ia32: '386', arm: 'arm' }[process.arch] || 'amd64';
  if (WIN) return `cloudflared-windows-${a === 'arm64' || a === 'arm' ? 'amd64' : a}.exe`; // Windows ARM chạy bản amd64 qua giả lập
  if (MAC) return `cloudflared-darwin-${a === 'arm64' ? 'arm64' : 'amd64'}.tgz`;
  return `cloudflared-linux-${a}`;
}
function cfVersion(bin) { try { const r = spawnSync(bin, ['--version'], { encoding: 'utf8', windowsHide: true, timeout: 15000 }); return r.status === 0 ? (r.stdout || r.stderr || '').trim().split(/\r?\n/)[0] : ''; } catch { return ''; } }
async function ensureCloudflared() {
  mkdirs();
  let v = cfVersion(CFX); if (v) { say('[OK] cloudflared sẵn sàng:', v); return v; }
  if (!process.env.CLOUDFLARED_BIN && (v = cfVersion('cloudflared'))) { CFX = 'cloudflared'; say('[OK] Dùng cloudflared có sẵn trong hệ thống:', v); return v; }
  if (process.env.CLOUDFLARED_BIN) throw new Error('CLOUDFLARED_BIN không chạy được: ' + process.env.CLOUDFLARED_BIN);
  const name = assetName(), url = 'https://github.com/cloudflare/cloudflared/releases/latest/download/' + name;
  say('[INFO] Đang tải cloudflared (' + name + ')...'); log('download ' + url);
  const dest = MAC ? path.join(BIN_DIR, name) : CFX;
  try { await download(url, dest); } catch (e) { throw new Error('Tải cloudflared thất bại: ' + e.message + '\n       Tải tay từ https://github.com/cloudflare/cloudflared/releases rồi đặt vào ' + BIN_DIR); }
  if (MAC) { const r = spawnSync('tar', ['-xzf', dest, '-C', BIN_DIR], { encoding: 'utf8' }); try { fs.unlinkSync(dest); } catch {} if (r.status !== 0) throw new Error('Giải nén cloudflared thất bại: ' + (r.stderr || '')); }
  if (!WIN) try { fs.chmodSync(CFX, 0o755); } catch {}
  v = cfVersion(CFX); if (!v) throw new Error('cloudflared tải về nhưng không chạy được (sai kiểu CPU/hệ điều hành?)');
  say('[OK] Đã cài cloudflared:', v); return v;
}
const baseTun = (...a) => ['tunnel', '--origincert', CERT, ...a];
function cf(args, ms = 120000) {
  const r = spawnSync(CFX, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 26, timeout: ms, env: { ...process.env, TUNNEL_ORIGIN_CERT: CERT } });
  const stdout = r.stdout || '', stderr = r.stderr || ''; log('cf ' + args.filter(x => x !== CERT).join(' ') + ' -> ' + r.status);
  return { code: r.status === null ? -1 : r.status, stdout, stderr, out: stdout + stderr };
}
function tunnelIdOf(name) {
  const r = cf(baseTun('list', '-o', 'json')); if (r.code) return '';
  try { const t = (JSON.parse(r.stdout || 'null') || []).find(x => x && x.name === name); return t ? t.id : ''; } catch { return ''; }
}
function loginCloudflare() {
  return new Promise(ok => {
    const p = spawn(CFX, baseTun('login'), { stdio: 'inherit', env: { ...process.env, TUNNEL_ORIGIN_CERT: CERT } });
    p.on('error', e => { say('[LỖI]', e.message); ok(1); }); p.on('close', c => ok(c));
  });
}

// ---------- cấu hình ----------
function readPort() { try { for (let l of fs.readFileSync(ENVF, 'utf8').split(/\r?\n/)) { const m = /^\s*PORT\s*=\s*["']?(\d{2,5})/.exec(l); if (m) return +m[1]; } } catch {} return +process.env.PORT || 6556; }
const readLinked = () => readJson(LINKED);
const readRoot = () => { try { return fs.readFileSync(ROOTFILE, 'utf8').trim().toLowerCase(); } catch { return ''; } };
// ---------- file di động: 1 file chứa MỌI THỨ cần để chạy lại tunnel trên máy khác ----------
// Setting/tunnel-portable.json = {tunnelId, hostname, name, credentials}. Copy cả thư mục dự án (hoặc chỉ file này, hoặc đặt biến môi trường
// TUNNEL_PORTABLE = nội dung file mã hoá base64) sang máy mới → tự dựng lại credentials/ + config.yml + tunnel-linked.json, KHÔNG cài lại.
const PORTABLE = path.join(SETTING, 'tunnel-portable.json');
function savePortable() {
  try {
    const l = readLinked(); if (!l.tunnelId || !l.hostname) return;
    const cred = readJson(path.join(CREDS, l.tunnelId + '.json')); if (!cred.TunnelSecret) return;
    const name = readJson(path.join(CF_DIR, 'Cloudflare_Tunnel.json')).tunnel || '';
    const next = JSON.stringify({ v: 1, tunnelId: l.tunnelId, hostname: l.hostname, name, root: readRoot(), credentials: cred }, null, 2);
    let cur = ''; try { cur = fs.readFileSync(PORTABLE, 'utf8'); } catch {}
    if (cur !== next) { fs.writeFileSync(PORTABLE, next); say('[OK] Đã lưu cấu hình tunnel di động: ' + PORTABLE); }
  } catch (e) { log('savePortable: ' + e.message); }
}
function readPortable() {
  try { if (process.env.TUNNEL_PORTABLE) return JSON.parse(Buffer.from(process.env.TUNNEL_PORTABLE.trim(), 'base64').toString('utf8')); } catch {}
  const o = readJson(PORTABLE); return o && o.tunnelId ? o : null;
}
function restorePortable() { // chỉ bổ sung phần còn thiếu, không ghi đè cái đang có
  const o = readPortable(); if (!o || !o.tunnelId || !o.hostname || !o.credentials || !o.credentials.TunnelSecret) return false;
  const l = readLinked(), cf = path.join(CREDS, o.tunnelId + '.json');
  if (l.tunnelId && l.tunnelId !== o.tunnelId && fs.existsSync(path.join(CREDS, l.tunnelId + '.json'))) return false; // máy này đã có tunnel khác, giữ nguyên
  mkdirs(); let did = false;
  if (!fs.existsSync(cf)) { fs.writeFileSync(cf, JSON.stringify(o.credentials)); did = true; }
  if (l.tunnelId !== o.tunnelId || l.hostname !== o.hostname) { writeJson(LINKED, { tunnelId: o.tunnelId, hostname: o.hostname, created: new Date().toISOString() }); did = true; }
  if (!fs.existsSync(CONFIG)) { writeConfig(o.tunnelId, o.hostname, 'http://127.0.0.1:' + readPort()); did = true; }
  if (!readRoot() && o.root) try { fs.writeFileSync(ROOTFILE, o.root + '\r\n'); } catch {}
  if (did) say('[OK] Khôi phục tunnel từ cấu hình di động (' + o.hostname + ') — không cần cài lại.');
  return true;
}
// Đã cài rồi (ở Windows HOẶC hosting) = có miền + tunnelId + file credential → chạy luôn, không cài lại. config.yml mất/sai đường dẫn thì tự dựng lại.
function hasConfig() {
  restorePortable();
  const l = readLinked(); if (!l.hostname) return false;
  if (!l.tunnelId) return fs.existsSync(CONFIG); // kiểu cũ
  if (!fs.existsSync(path.join(CREDS, l.tunnelId + '.json'))) { say('[CẢNH BÁO] Thiếu ' + path.join(CREDS, l.tunnelId + '.json') + ' — copy file này từ máy đã cài tunnel (hoặc chạy node start.js --reconfig).'); return false; }
  if (!fs.existsSync(CONFIG)) { writeConfig(l.tunnelId, l.hostname, 'http://127.0.0.1:' + readPort()); say('[INFO] Tự dựng lại config.yml từ cấu hình đã lưu.'); }
  savePortable();
  return true;
}
function writeConfig(id, host, origin) {
  const q = s => "'" + String(s).replace(/'/g, "''") + "'";
  fs.writeFileSync(CONFIG, ['tunnel: ' + id, 'credentials-file: ' + q(path.join(CREDS, id + '.json')), '', 'ingress:', '  - hostname: ' + host, '    service: ' + origin, '  - service: http_status:404', '', 'loglevel: info', 'logfile: ' + q(path.join(LOGS, 'tunnel-run.log')), 'protocol: http2', ''].join('\n'));
}
function refreshConfig() { // config.yml tạo trên máy khác (VD Windows → host Linux) chứa đường dẫn sai → viết lại theo thư mục hiện tại
  try {
    const l = readLinked(); if (!l.tunnelId || !l.hostname) return;
    let origin = 'http://127.0.0.1:' + readPort();
    const before = (() => { try { return fs.readFileSync(CONFIG, 'utf8'); } catch { return ''; } })();
    writeConfig(l.tunnelId, l.hostname, origin);
    if (before && before !== fs.readFileSync(CONFIG, 'utf8')) say('[INFO] Đã sửa đường dẫn trong config.yml cho khớp thư mục hiện tại.');
    const cred = path.join(CREDS, l.tunnelId + '.json');
    if (!fs.existsSync(cred)) say('[LỖI] Thiếu file credential: ' + cred + '\n       → copy file ' + l.tunnelId + '.json vào thư mục đó, hoặc chạy: node start.js --reconfig');
  } catch (e) { log('refreshConfig: ' + e.message); }
}
function lastErr() { try { return fs.readFileSync(path.join(LOGS, 'tunnel-run.out.log'), 'utf8').trim().split(/\r?\n/).slice(-4).join('\n         '); } catch { return ''; } }
function syncOrigin(port) { // PORT trong .env đổi → cập nhật config.yml cho khớp
  try { const t = fs.readFileSync(CONFIG, 'utf8'), n = t.replace(/(service:\s*)http:\/\/127\.0\.0\.1:\d+/, '$1http://127.0.0.1:' + port); if (n !== t) { fs.writeFileSync(CONFIG, n); say('[INFO] Đã cập nhật cổng trong config.yml →', port); } } catch {}
}
function saveEnvHost(host) {
  try {
    let t = ''; try { t = fs.readFileSync(ENVF, 'utf8'); } catch {}
    const eol = t.includes('\r\n') || WIN ? '\r\n' : '\n';
    t = t.replace(/^[ \t]*#?[ \t]*CLOUDFLARE_HOSTNAME=.*\r?\n?/gm, '').replace(/^[ \t]*# Cloudflare Tunnel hostname.*\r?\n?/gm, '').trimEnd();
    fs.writeFileSync(ENVF, (t ? t + eol : '') + '# Cloudflare Tunnel hostname (tự ghi bởi tunnel.js)' + eol + 'CLOUDFLARE_HOSTNAME=' + host + eol);
  } catch (e) { log('env: ' + e.message); }
}

// Nhập "miền phụ": Enter = miền chính | "media" = media.<miền chính> | tên đầy đủ
function parseHost(input, root) {
  let s = String(input || '').trim().replace(/\s+/g, '').replace(/^https?:\/\//i, '').replace(/[/?#].*$/, '').toLowerCase().replace(/\.+$/, '');
  if (!s) return root ? { host: root, root, type: 'MIỀN CHÍNH' } : { err: 'Chưa có miền chính — hãy nhập tên miền đầy đủ (VD: example.com).' };
  if (!s.includes('.')) return root ? { host: s + '.' + root, root, type: 'MIỀN PHỤ' } : { err: '"' + s + '" không có dấu chấm và chưa có miền chính để ghép vào.' };
  if (!root) return { host: s, root: s, type: 'MIỀN CHÍNH' };
  if (s === root) return { host: s, root, type: 'MIỀN CHÍNH' };
  if (s.endsWith('.' + root)) return { host: s, root, type: 'MIỀN PHỤ' };
  return { host: s, root: s, type: 'MIỀN CHÍNH', changed: true };
}
const cleanTunnelName = s => String(s || '').replace(/[^a-zA-Z0-9-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);

// ---------- cài đặt đầy đủ ----------
async function setup(opts = {}) {
  mkdirs();
  say('=== CLOUDFLARE TUNNEL - MEDIAPLAYER (Node.js) ===');
  say('[1/9] Kiểm tra Internet...');
  if (!process.env.TUNNEL_SKIP_CHECK && !(await httpGet('https://www.cloudflare.com', 10000))) throw new Error('Không kết nối được Internet.');
  say('[2/9] Kiểm tra / cài cloudflared...');
  await ensureCloudflared();

  say('[3/9] Đăng nhập Cloudflare — mở link bên dưới (trên VPS: copy link, mở bằng trình duyệt ở máy bạn) rồi CHỌN ĐÚNG TÊN MIỀN (zone).');
  for (const f of [CERT]) try { fs.unlinkSync(f); } catch {} // luôn đăng nhập lại để chọn đúng miền (giống bản .bat)
  const t0 = Date.now(), code = await loginCloudflare(), def = path.join(os.homedir(), '.cloudflared', 'cert.pem');
  if (!fs.existsSync(CERT) && fs.existsSync(def) && fs.statSync(def).mtimeMs >= t0 - 5000) { fs.copyFileSync(def, CERT); try { fs.unlinkSync(def); } catch {} log('moved default cert'); }
  if (!fs.existsSync(CERT)) throw new Error('Đăng nhập Cloudflare chưa xong (không có cert.pem).' + (fs.existsSync(def) ? '\n       Có cert cũ ở ' + def + ' làm cloudflared từ chối đăng nhập — hãy xoá file đó rồi chạy lại.' : '') + (code ? ' (mã ' + code + ')' : ''));
  say('[OK] Đã đăng nhập Cloudflare.');

  const port = readPort(), origin = 'http://127.0.0.1:' + port;
  say('[4/9] Cổng MediaPlayer: ' + port + '  (đọc từ Setting/.env)');

  // ---- hỏi miền ----
  say('[5/9] Chọn tên miền');
  let root = ''; try { root = fs.readFileSync(ROOTFILE, 'utf8').trim().toLowerCase(); } catch {}
  let picked = null;
  const given = opts.host || process.env.TUNNEL_HOST;
  if (given) { picked = parseHost(given, root); if (picked.err) throw new Error(picked.err); }
  while (!picked) {
    if (!root) {
      const r = await ask('      Nhập MIỀN CHÍNH đã thêm vào Cloudflare (VD: example.com): ');
      if (r === null) throw new Error('Không có đầu vào để nhập tên miền. Chạy trong terminal, hoặc dùng --host=media.example.com / biến TUNNEL_HOST.');
      const p = parseHost(r, ''); if (p.err || !p.host.includes('.')) { say('[LỖI] Cần tên miền đầy đủ, có dấu chấm.'); continue; }
      root = p.host; fs.writeFileSync(ROOTFILE, root + '\r\n');
    }
    const r = await ask(`      Nhập MIỀN PHỤ (VD: media → media.${root}) hoặc tên đầy đủ. Enter = dùng miền chính ${root}: `);
    if (r === null) throw new Error('Không có đầu vào để nhập miền phụ. Dùng --host=... hoặc biến TUNNEL_HOST.');
    const p = parseHost(r, root); if (p.err) { say('[LỖI]', p.err); continue; }
    if (p.changed) { const y = await ask(`[CẢNH BÁO] "${p.host}" khác miền chính đã lưu (${root}). Dùng làm miền chính mới? (Y/N): `); if (y === null || !/^y/i.test(y.trim())) continue; }
    picked = p;
  }
  const host = picked.host; root = picked.root; fs.writeFileSync(ROOTFILE, root + '\r\n');
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) say('[CẢNH BÁO] Tên miền có thể không hợp lệ:', host);
  say(`[OK] Miền: ${host} (${picked.type})`);

  let name = cleanTunnelName(opts.tunnelName || process.env.TUNNEL_NAME);
  const auto = ('auto-' + host.replace(/[.\/\\:]/g, '-')).slice(0, 50);
  if (!name && (canPrompt() || lines.length)) { const r = await ask(`[5b/9] Tên tunnel (Enter = ${auto}): `); name = cleanTunnelName(r || '') || auto; }
  if (!name) name = auto;
  say('[OK] Tên tunnel: ' + name);

  // ---- dọn tunnel cũ của dự án ----
  const old = readLinked();
  if (old.tunnelId) { // KHÔNG xoá gì: chỉ chuyển cấu hình cũ vào thư mục backup (tunnel cũ trên Cloudflare cũng được giữ nguyên)
    const bk = path.join(CF_DIR, 'backup-' + Date.now()); fs.mkdirSync(bk, { recursive: true });
    for (const f of [CONFIG, LINKED, path.join(CREDS, old.tunnelId + '.json')]) try { if (fs.existsSync(f)) fs.copyFileSync(f, path.join(bk, path.basename(f))); } catch {}
    say(`[INFO] Cấu hình cũ (${old.hostname}) đã sao lưu vào ${bk}`);
  }

  // ---- tạo tunnel ----
  say('[6/9] Tạo Cloudflare Tunnel: ' + name);
  const newCred = path.join(CREDS, '_new-' + Math.floor(Math.random() * 1e6) + '.json');
  let id = tunnelIdOf(name);
  if (id && !fs.existsSync(path.join(CREDS, id + '.json'))) { say('[INFO] Tunnel đã có nhưng thiếu credential — xoá và tạo lại...'); cf(baseTun('delete', '-f', name)); id = ''; }
  if (id) say('[OK] Tunnel đã tồn tại, dùng lại.');
  else {
    let r = cf(baseTun('create', '--credentials-file', newCred, name));
    if (r.code) { name += '-' + Math.floor(Math.random() * 9000 + 1000); say('[INFO] Tên trùng, thử lại: ' + name); r = cf(baseTun('create', '--credentials-file', newCred, name)); }
    if (r.code) throw new Error('Không tạo được tunnel:\n' + r.out.trim());
    say('[OK] Đã tạo tunnel: ' + name);
    id = tunnelIdOf(name);
  }
  say('[7/9] Lấy Tunnel ID...');
  if (!id) throw new Error('Không lấy được Tunnel ID của "' + name + '".');
  say('[OK] Tunnel ID: ' + id);
  if (fs.existsSync(newCred)) fs.renameSync(newCred, path.join(CREDS, id + '.json'));
  else if (!fs.existsSync(path.join(CREDS, id + '.json'))) throw new Error('Không thấy file credential của tunnel trong ' + CREDS);

  say('[8/9] Tạo config.yml...');
  writeConfig(id, host, origin);
  const v = cf(['--config', CONFIG, 'tunnel', 'ingress', 'validate']);
  if (v.code) throw new Error('Config ingress không hợp lệ:\n' + v.out.trim());
  say('[OK] Config ingress hợp lệ.');

  say(`[9/9] Tạo DNS route: ${host} => ${name}`);
  const d = cf(baseTun('route', 'dns', '--overwrite-dns', name, host));
  if (d.code) {
    say('[CẢNH BÁO] ADD ROUTE LỖI — đây là lý do miền phụ chưa liên kết được:\n' + '-'.repeat(58) + '\n' + d.out.trim() + '\n' + '-'.repeat(58));
    say('Nguyên nhân thường gặp:\n - "' + host + '" không nằm trong ZONE đã chọn ở bước đăng nhập → chạy lại và chọn đúng miền chứa nó.\n - Đã có DNS record trùng tên đang trỏ nơi khác → vào Cloudflare > DNS xoá rồi chạy lại.\n - Tài khoản không có quyền sửa DNS của zone này.');
  } else say(`[OK] Đã liên kết "${host}" vào Cloudflare.`);

  // ---- lưu trạng thái (cùng định dạng bản .bat) ----
  const now = new Date().toISOString();
  writeJson(LINKED, { tunnelId: id, hostname: host, created: now });
  writeJson(path.join(CF_DIR, 'Cloudflare_Tunnel.json'), { tunnel: name, tunnelId: id, hostname: host, origin });
  writeJson(path.join(CF_DIR, 'setup-state.json'), { status: 'completed', timestamp: now, hostname: host });
  writeJson(path.join(CF_DIR, 'result.json'), { success: !d.code, hostname: host, tunnelId: id, timestamp: now });
  try { fs.unlinkSync(FLAG); } catch {}
  saveEnvHost(host);
  try { fs.unlinkSync(CERT); } catch {} // cert chỉ cần lúc cài; chạy tunnel dùng credentials. (Cài lại sẽ đăng nhập lại.)
  savePortable();
  return { host, tunnelId: id, tunnelName: name, origin, dnsOk: !d.code };
}

// ---------- chạy / dừng ----------
const cfRunningWin = () => { try { const r = spawnSync('tasklist', ['/FI', 'IMAGENAME eq cloudflared.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true }); return /cloudflared\.exe/i.test(r.stdout || ''); } catch { return false; } };
function superviseTunnel() { // giữ cloudflared luôn chạy (tự bật lại khi sập); dùng trong start.js
  refreshConfig();
  let child = null, stopped = false, delay = 2000, timer = null;
  const run = () => {
    if (stopped) return;
    if (fs.existsSync(FLAG) || (WIN && cfRunningWin())) { timer = setTimeout(run, 8000); return; } // đang tắt chủ động / đã có tiến trình khác (khay hệ thống Windows)
    const out = fs.openSync(path.join(LOGS, 'tunnel-run.out.log'), 'a'), t0 = Date.now();
    child = spawn(CFX, ['--no-autoupdate', '--config', CONFIG, 'tunnel', 'run'], { stdio: ['ignore', out, out], windowsHide: true, cwd: CF_DIR });
    try { fs.writeFileSync(PIDF, String(child.pid)); } catch {}
    child.on('error', e => say('[LỖI] cloudflared:', e.message));
    child.on('close', c => { try { fs.closeSync(out); } catch {} child = null; if (stopped) return; if (Date.now() - t0 > 60000) delay = 2000; say(`[CẢNH BÁO] cloudflared dừng (mã ${c}), chạy lại sau ${delay / 1000}s...`); { const e = lastErr(); if (e) say('         Lý do: ' + e); } timer = setTimeout(run, delay); delay = Math.min(delay * 2, 30000); });
  };
  run();
  return { stop() { stopped = true; clearTimeout(timer); if (child) try { child.kill(); } catch {} try { fs.unlinkSync(PIDF); } catch {} }, get pid() { return child && child.pid; } };
}
function startDetached() {
  if (!fs.existsSync(CONFIG)) throw new Error('Chưa cấu hình tunnel. Chạy: node Setting/js/tunnel.js setup');
  try { fs.unlinkSync(FLAG); } catch {}
  refreshConfig();
  const out = fs.openSync(path.join(LOGS, 'tunnel-run.out.log'), 'a');
  const p = spawn(CFX, ['--no-autoupdate', '--config', CONFIG, 'tunnel', 'run'], { detached: true, stdio: ['ignore', out, out], windowsHide: true, cwd: CF_DIR }); p.unref();
  fs.writeFileSync(PIDF, String(p.pid)); return p.pid;
}
function stopTunnel() {
  try { fs.writeFileSync(FLAG, 'off'); } catch {}
  let pid = 0; try { pid = +fs.readFileSync(PIDF, 'utf8'); } catch {}
  if (WIN) spawnSync('taskkill', ['/IM', 'cloudflared.exe', '/T', '/F'], { windowsHide: true });
  else if (pid) try { process.kill(pid); } catch {}
  try { fs.unlinkSync(PIDF); } catch {}
}
async function waitPublic(host, tries = 20) { // chờ link HTTPS truy cập được (DNS/tunnel có thể cần vài chục giây)
  for (let i = 0; i < tries; i++) { const c = await httpGet('https://' + host, 8000); if (c >= 200 && c < 500) return c; await sleep(3000); }
  return 0;
}
function status() {
  const l = readLinked(); let pid = 0; try { pid = +fs.readFileSync(PIDF, 'utf8'); } catch {}
  let alive = false; if (pid) try { process.kill(pid, 0); alive = true; } catch {}
  console.log('cloudflared :', cfVersion(CFX) || '(chưa cài)');
  console.log('config.yml  :', fs.existsSync(CONFIG) ? 'có' : 'KHÔNG CÓ');
  console.log('miền        :', l.hostname ? 'https://' + l.hostname : '(chưa cài)');
  console.log('tiến trình  :', alive ? 'đang chạy (pid ' + pid + ')' : (WIN && cfRunningWin() ? 'đang chạy' : 'không chạy'), fs.existsSync(FLAG) ? '[đã tắt chủ động]' : '');
  try { console.log('--- log (10 dòng cuối) ---\n' + fs.readFileSync(path.join(LOGS, 'tunnel-run.log'), 'utf8').trim().split(/\r?\n/).slice(-10).join('\n')); } catch {}
}
function reset() {
  const l = readLinked(); stopTunnel();
  if (l.tunnelId && fs.existsSync(CERT) && cfVersion(CFX)) cf(baseTun('delete', '-f', l.tunnelId));
  for (const f of [CONFIG, LINKED, path.join(CF_DIR, 'Cloudflare_Tunnel.json'), path.join(CF_DIR, 'setup-state.json'), path.join(CF_DIR, 'result.json'), CERT, l.tunnelId && path.join(CREDS, l.tunnelId + '.json')]) if (f) try { fs.unlinkSync(f); } catch {}
  console.log('Đã gỡ cấu hình tunnel trong dự án (miền chính đã lưu được giữ lại).');
}

module.exports = { setQuiet, LOGS, savePortable, restorePortable, refreshConfig, ROOT, CF_DIR, ask, closeInput, canPrompt, ensureCloudflared, setup, parseHost, readLinked, readRoot, readPort, hasConfig, syncOrigin, superviseTunnel, waitPublic, startDetached, stopTunnel, status, reset, say };

if (require.main === module) {
  const arg = k => { const m = process.argv.find(a => a.startsWith('--' + k + '=')); return m ? m.slice(k.length + 3) : ''; };
  (async () => {
    const cmd = process.argv[2] || 'help';
    if (cmd === 'setup') { const r = await setup({ host: arg('host'), tunnelName: arg('name') }); closeInput(); console.log('\nXong. Link: https://' + r.host + '\nChạy tunnel: node Setting/js/tunnel.js start   (hoặc node start.js)'); }
    else if (cmd === 'ready') process.exit(hasConfig() ? 0 : 1);
    else if (cmd === 'save') { savePortable(); }
    else if (cmd === 'start') { if (!hasConfig()) { console.log('Chưa cài tunnel.'); process.exit(1); } await ensureCloudflared(); if (WIN && cfRunningWin()) { console.log('Tunnel đang chạy sẵn.'); process.exit(0); } console.log('Đã bật tunnel, pid', startDetached()); }
    else if (cmd === 'stop') { stopTunnel(); console.log('Đã tắt tunnel.'); }
    else if (cmd === 'status') status();
    else if (cmd === 'reset') reset();
    else console.log('Dùng: node tunnel.js setup [--host=media] [--name=ten] | start | stop | status | reset');
    process.exit(0);
  })().catch(e => { console.error('\n[LỖI] ' + e.message); log('ERROR ' + e.message); process.exit(1); });
}
