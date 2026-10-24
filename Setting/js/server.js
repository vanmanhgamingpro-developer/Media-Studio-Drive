'use strict';
// Web Media Player — 1 file, KHÔNG cần npm/Node khi đã đóng gói thành MediaPlayer.exe (xem build.js)
const path = require('path'), fs = require('fs'), crypto = require('crypto'), http = require('http'), zlib = require('zlib'), https = require('https'), net = require('net'), tls = require('tls'), os = require('os');
const { execFile, spawn } = require('child_process'), { pipeline } = require('stream');
const { DatabaseSync } = require('node:sqlite');
let sea = null; try { sea = require('node:sea'); } catch {}
const IS_SEA = !!(sea && sea.isSea && sea.isSea()), WIN = process.platform === 'win32', ARGS = new Set(process.argv.filter(a => a.startsWith('--')));
// Chạy từ Explorer (có cửa sổ console) → tự chạy lại ở chế độ ẩn. Thêm --console để xem log trực tiếp.
if (IS_SEA && WIN && process.stdout.isTTY && !ARGS.has('--console') && !ARGS.has('--run')) { spawn(process.execPath, [...ARGS, '--run'], { detached: true, stdio: 'ignore', windowsHide: true }).unref(); process.exit(0); }

// ---- tự nhận diện thư mục: exe/bat đặt ở đâu cũng chạy; dùng thư mục video/ảnh có sẵn (tên nào cũng được trong danh sách) ----
const VID_NAMES = ['video', 'videos', 'vid', 'phim', 'clip', 'clips', 'movies'], IMG_NAMES = ['img', 'imgs', 'image', 'images', 'anh', 'photo', 'photos', 'picture', 'pictures', 'pic', 'pics'];
const norm = n => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
const findDir = (root, names) => { try { for (const e of fs.readdirSync(root, { withFileTypes: true })) if (e.isDirectory() && names.includes(norm(e.name))) return path.join(root, e.name); } catch {} return null; };
const looksLikeRoot = d => !!(findDir(d, VID_NAMES) || findDir(d, IMG_NAMES) || findDir(d, ['data']));
// server.js nam trong Setting\js\.
// PROJECT_ROOT la goc du an THAT, chua public\, img\, video\, data\ - nam 1 cap TREN Setting\.
// Chi dung khi CHUA dong goi - ban .exe (IS_SEA) doc asset thang tu du lieu nhung san nen khong
// dung toi cac duong dan nay (xem SETTING_DIR ben duoi de co duong dan Setting\ dung o CA 2 che do).
const SETTING_ROOT = path.join(__dirname, '..');
const PROJECT_ROOT = path.join(SETTING_ROOT, '..');
const BASE = IS_SEA ? path.dirname(process.execPath) : PROJECT_ROOT;
const ROOT = process.env.MP_ROOT ? path.resolve(process.env.MP_ROOT) : looksLikeRoot(BASE) ? BASE : looksLikeRoot(path.dirname(BASE)) ? path.dirname(BASE) : BASE; // exe trong dist\ → dùng thư mục dự án bên ngoài nếu ở đó đã có video/img/data
const DATA = path.join(ROOT, 'data'); let VID = findDir(ROOT, VID_NAMES) || path.join(ROOT, 'video'), IMG = findDir(ROOT, IMG_NAMES) || path.join(ROOT, 'img'); const TMP = path.join(DATA, 'tmp'), LOGS = path.join(DATA, 'logs');
const THUMBS = path.join(DATA, 'thumbs'), ORIG = path.join(DATA, 'originals');
[DATA, TMP, LOGS, THUMBS, ORIG].forEach(d => fs.mkdirSync(d, { recursive: true })); // CHỈ DÙNG GOOGLE DRIVE: không còn tạo/đọc thư mục video/ + img/ trên máy
for (const f of fs.readdirSync(TMP)) fs.rmSync(path.join(TMP, f), { force: true, recursive: true });

// ---- thu muc Setting\ o CHAY THAT (dung dung ca 2 che do dev/da dong goi, KHAC voi SETTING_ROOT
// o tren vi SETTING_ROOT dung __dirname - vo nghia khi da dong goi thanh .exe (SEA)). ROOT o tren
// da tu nhan dung goc du an trong ca 2 che do, nen Setting\ luon la ROOT + "Setting".
const SETTING_DIR = path.join(ROOT, 'Setting');
try { fs.mkdirSync(SETTING_DIR, { recursive: true }); } catch {}

// ---- file .env (nam trong thu muc Setting\): cho phep doi CONG (PORT) ----
const ENV_FILE = path.join(SETTING_DIR, '.env');
const OLD_ENV_FILE = path.join(ROOT, '.env'); // ban truoc day tung dat .env o goc du an - tu chuyen vao Setting\ neu co
if (!fs.existsSync(ENV_FILE) && fs.existsSync(OLD_ENV_FILE)) { try { fs.renameSync(OLD_ENV_FILE, ENV_FILE); } catch {} }
if (!fs.existsSync(ENV_FILE)) {
  try {
    fs.writeFileSync(ENV_FILE,
      '# Cong web (PORT). Co the doi khi MediaPlayer dang chay; he thong se tu dong ap dung.\r\n' +
      'PORT=6556\r\n', 'utf8');
  } catch {}
}
try {
  for (let line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (m[1] === 'PORT' || !(m[1] in process.env)) process.env[m[1]] = v; // PORT trong Setting\.env la nguon cau hinh uu tien
  }
} catch {}

// Thư mục video/ảnh tuỳ chọn (vd. ổ Google Drive for desktop: G:\My Drive\WEB-VIDEO\Video) — đặt MP_VIDEO_DIR / MP_IMG_DIR trong Setting\.env
// (đã bỏ MP_VIDEO_DIR / MP_IMG_DIR: video/ảnh chỉ nhận từ Google Drive)
let PORT = Number.parseInt(String(process.env.PORT || '').trim(), 10);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) PORT = 6556;
const HOST = '127.0.0.1';
let URL_ = `http://${HOST}:${PORT}`;
const MAX_UPLOAD = 20 * 1024 ** 3;
const DIR = { video: VID, image: IMG };

// ---- log ----
const logf = path.join(LOGS, 'server.log'); try { if (fs.statSync(logf).size > 5e6) fs.renameSync(logf, logf + '.old'); } catch {}
const logS = fs.createWriteStream(logf, { flags: 'a' });
const say = (...a) => { const l = `[${new Date().toISOString()}] ${a.join(' ')}`; logS.write(l + '\n'); if (process.stdout.isTTY && process.env.MP_VERBOSE === '1') console.log(l); };
process.on('uncaughtException', e => say('uncaught:', e.stack || e)); process.on('unhandledRejection', e => say('rejection:', e && e.stack || e));
// asset(): trong exe đã đóng gói (IS_SEA), đọc thẳng từ dữ liệu nhúng sẵn. Khi chạy dev
// (node server.js, chưa đóng gói), đọc từ đĩa — với .ps1/.cmd, chấp nhận CẢ tên gốc (đã đổi
// tên) LẪN tên gốc + ".txt" (chưa đổi tên) để không bắt buộc phải đổi tên tay các file này.
const crlf = b => Buffer.from(b.toString('utf8').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'), 'utf8');
const asset = n => {
  if (IS_SEA) { const b = Buffer.from(sea.getRawAsset(n)); return /\.ps1$|\.cmd$/.test(n) ? crlf(b) : b; }
  if (/\.ps1$|\.cmd$/.test(n)) {
    // Chap nhan file .ps1/.cmd trong Setting\, Setting\ps1\ hoac goc du an de tuong thich nguoc
    // neu ai do van con sap xep theo kieu cu. Thu theo thu tu, dung cai dau tien ton tai.
    const dirs = [
      SETTING_ROOT, path.join(SETTING_ROOT, 'ps1'),
      PROJECT_ROOT, path.join(PROJECT_ROOT, 'ps1'),
    ];
    const candidates = dirs.flatMap(d => [path.join(d, n), path.join(d, n + '.txt')]);
    const hit = candidates.find(fs.existsSync);
    // QUAN TRONG: cac file .ps1/.cmd nguon tren dia dung xuong dong kieu Unix (LF don, khong co
    // CR) - file .cmd (Windows Batch) voi cac khoi if/for nhieu dong trong dau ngoac () co the
    // chay SAI (nhay lung tung, bao loi "'x' is not recognized...") tren mot so may/phien ban
    // cmd.exe neu thieu CR truoc LF. Luon chuan hoa ve CRLF (chuan Windows) O DAY - 1 cho duy
    // nhat - truoc khi dua di dung (ghi ra file That/nhung vao exe), ke ca khi da dong goi (SEA).
    return crlf(fs.readFileSync(hit || candidates[0]));
  }
  return fs.readFileSync(path.join(PROJECT_ROOT, 'public/' + n));
};

// ---- secret key (mã hoá mật khẩu SMTP / Google secret) ----
const kf = path.join(DATA, 'secret.key'); if (!fs.existsSync(kf)) fs.writeFileSync(kf, crypto.randomBytes(32), { mode: 0o600 });
const KEY = fs.readFileSync(kf);
const enc = t => { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', KEY, iv); const b = Buffer.concat([c.update(t, 'utf8'), c.final()]); return Buffer.concat([iv, c.getAuthTag(), b]).toString('base64'); };
const dec = s => { const b = Buffer.from(s, 'base64'), d = crypto.createDecipheriv('aes-256-gcm', KEY, b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'); };
const sha = s => crypto.createHash('sha256').update(s).digest('hex'), rnd = n => crypto.randomBytes(n).toString('base64url');
const safeEq = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// ---- mật khẩu: scrypt (có sẵn trong Node, không cần module native) ----
const SC = { N: 1 << 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };
const hashPw = pw => new Promise((ok, no) => { const s = crypto.randomBytes(16); crypto.scrypt(pw, s, 32, SC, (e, k) => e ? no(e) : ok(`scrypt$${s.toString('base64')}$${k.toString('base64')}`)); });
const verifyPw = (pw, h) => new Promise(ok => { const [t, s, k] = String(h).split('$'); if (t !== 'scrypt' || !s || !k) return ok(false); crypto.scrypt(pw, Buffer.from(s, 'base64'), 32, SC, (e, d) => ok(!e && crypto.timingSafeEqual(d, Buffer.from(k, 'base64')))); });
let DUMMY = ''; hashPw('dummy-password').then(h => DUMMY = h);

// ---- Google Drive (RIÊNG TƯ): video/ảnh nằm trên Drive, máy chủ đọc danh sách + phát qua API, KHÔNG cần file trên máy ----
// Cấu hình: Setting\.env (GDRIVE_ROOT_FOLDER_ID hoặc GDRIVE_VIDEO_FOLDER_ID + GDRIVE_IMAGE_FOLDER_ID) + Setting\drive\service-account.json hoặc oauth.json
// Không đặt cấu hình Drive → chạy như cũ với thư mục video/ + img/ trên máy.
const GD_DIRS = [...new Set([path.join(SETTING_DIR, 'drive'), path.join(BASE, 'Setting', 'drive'), path.join(PROJECT_ROOT, 'Setting', 'drive'), path.join(path.dirname(process.execPath), '..', 'Setting', 'drive')].map(d => path.resolve(d)))]; let GD_DIR = GD_DIRS[0]; // khoá có thể nằm ở Setting\drive của thư mục dự án thật
const GD_API = (process.env.MP_GDRIVE_API || 'https://www.googleapis.com').replace(/\/+$/, ''), GD_TOKEN_URL = process.env.MP_GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const GD_SCOPE = 'https://www.googleapis.com/auth/drive', GD_FOLDER = 'application/vnd.google-apps.folder';
const GD = { on: false, creds: null, root: '', vid: '', img: '', name: String(process.env.GDRIVE_ROOT_NAME || 'WEB-Video').trim() || 'WEB-Video', err: '', cfgErr: '' };
const gdId = v => { v = String(v || '').trim(); const m = /\/folders\/([\w-]+)/.exec(v) || /[?&]id=([\w-]+)/.exec(v); return m ? m[1] : v; }; // dán nguyên link thư mục Drive cũng được
(function gdInit() {
  let clientOnly = '', names = [], bad = [];
  for (const d of GD_DIRS) { // lấy thư mục đầu tiên có file .json
    let l = []; try { l = fs.readdirSync(d).filter(n => /\.json$/i.test(n)); } catch {}
    if (l.length) { GD_DIR = d; names = l.sort((x, y) => (y === 'oauth.json') - (x === 'oauth.json')); break; }
  }
  for (const n of names) { // nhận file JSON tên bất kỳ trong Setting\drive\
    let j; try { j = JSON.parse(fs.readFileSync(path.join(GD_DIR, n), 'utf8').replace(/^\uFEFF/, '')); } catch { bad.push(n); say('Drive: file', n, 'không phải JSON hợp lệ'); continue; }
    if (j && j.client_email && j.private_key) { GD.creds = { ...j, type: 'sa' }; break; }
    if (j && j.client_id && j.client_secret && j.refresh_token) { GD.creds = { ...j, type: 'oauth' }; break; }
    if (j && (j.installed || j.web)) clientOnly = n;
  }
  if (GD.creds) GD.cfgErr = '';
  else if (clientOnly) GD.cfgErr = 'File ' + clientOnly + ' chỉ là "OAuth client" — CHƯA đăng nhập Google. Hãy chạy Setting\\Drive-Login.cmd để tạo oauth.json rồi chạy lại MediaPlayer.';
  else if (bad.length) GD.cfgErr = 'File ' + bad.join(', ') + ' trong Setting\\drive không phải JSON hợp lệ.';
  else GD.cfgErr = 'Không thấy khoá Google Drive (oauth.json hoặc service-account.json) trong ' + GD_DIRS[0] + ' → web KHÔNG đọc video/ảnh trên máy, nên đang trống. Xem HUONG-DAN-GOOGLE-DRIVE.txt.';
  if (GD.cfgErr) say('Drive LỖI:', GD.cfgErr);
  else say('Drive: dùng khoá trong', GD_DIR);
  GD.root = gdId(process.env.GDRIVE_ROOT_FOLDER_ID); GD.vid = gdId(process.env.GDRIVE_VIDEO_FOLDER_ID); GD.img = gdId(process.env.GDRIVE_IMAGE_FOLDER_ID);
  GD.on = !!GD.creds; // chỉ chạy bằng Drive; không đặt ID thì tự tìm thư mục WEB-Video (gồm Video + img) trong "Drive của tôi"
})();
const GD_EVERY = Math.max(10, Math.min(+process.env.GDRIVE_SCAN_SECONDS || 30, 3600)) * 1000;
const THUMB_CONC = Math.max(1, Math.min(+process.env.GDRIVE_THUMB_CONCURRENCY || 6, 8)); // tối đa 8: đặt cao hơn (vd 300) chỉ làm nghẽn mạng/CPU, không nhanh thêm // ảnh xem trước từ Drive: tải // nhiều cái cùng lúc (chỉ chờ mạng, không tốn CPU) thay vì xếp hàng từng cái

function gdHttp(url, { method = 'GET', headers = {}, body = null, signal, timeout = 25000 } = {}) { // http/https thuần, không cần thư viện
  return new Promise((ok, no) => {
    const u = new URL(url), tm = setTimeout(() => rq.destroy(new Error('Drive không phản hồi (timeout)')), timeout), rq = (u.protocol === 'http:' ? http : https).request(u, { method, headers, signal }, r => { clearTimeout(tm); ok(r); }); rq.on('error', e => { clearTimeout(tm); no(e); }); // timeout chỉ áp cho tới lúc có phản hồi đầu tiên (phát video bị tạm dừng không bị cắt)
    if (body && typeof body.pipe === 'function') { body.on('error', e => rq.destroy(e)); body.pipe(rq); } else rq.end(body || undefined);
  });
}
const gdRead = async r => { const c = []; for await (const x of r) c.push(x); return Buffer.concat(c); };
const gdThumbLink = new Map(); let gdStreams = 0; // thumbnailLink lấy từ lần quét danh sách (làm mới mỗi vài chục giây); gdStreams = số luồng phát video đang chạy
let gdTok = { v: '', exp: 0 }, gdTokP = null;
function gdToken(force) {
  if (!force && gdTok.v && gdTok.exp > Date.now() + 60e3) return Promise.resolve(gdTok.v);
  if (gdTokP) return gdTokP;
  return gdTokP = (async () => {
    try {
      const c = GD.creds; let body, url = GD_TOKEN_URL;
      if (c.type === 'sa') { // service account: tự ký JWT (RS256) bằng crypto có sẵn
        const now = Math.floor(Date.now() / 1000), b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
        const un = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: c.client_email, scope: GD_SCOPE, aud: c.token_uri || GD_TOKEN_URL, iat: now, exp: now + 3600 });
        body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: un + '.' + crypto.sign('RSA-SHA256', Buffer.from(un), c.private_key).toString('base64url') });
        if (c.token_uri && !process.env.MP_GOOGLE_TOKEN_URL) url = c.token_uri;
      } else body = new URLSearchParams({ grant_type: 'refresh_token', client_id: c.client_id, client_secret: c.client_secret, refresh_token: c.refresh_token });
      const r = await gdHttp(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
      const t = (await gdRead(r)).toString('utf8'); let j = {}; try { j = JSON.parse(t); } catch {}
      if (!j.access_token) throw new Error('Không lấy được token Google Drive: ' + (j.error_description || j.error || r.statusCode));
      gdTok = { v: j.access_token, exp: Date.now() + (+j.expires_in || 3600) * 1000 }; return gdTok.v;
    } finally { gdTokP = null; }
  })();
}
async function gdCall(url, o = {}, noAuth) { // → IncomingMessage; tự làm mới token khi 401, thử lại khi 429/5xx
  const stream = !!(o.body && o.body.pipe); let force = false;
  for (let i = 0; ; i++) {
    const headers = { ...o.headers }; if (!noAuth) headers.Authorization = 'Bearer ' + await gdToken(force);
    const r = await gdHttp(url, { ...o, headers });
    if (r.statusCode === 401 && !force && !noAuth && !stream) { r.resume(); force = true; continue; }
    if ((r.statusCode === 429 || r.statusCode >= 500) && i < 3 && !stream) { r.resume(); await sleep(500 * 2 ** i); continue; }
    return r;
  }
}
async function gdJson(url, o) {
  const r = await gdCall(url, o), t = (await gdRead(r)).toString('utf8'); let j = null; try { j = JSON.parse(t); } catch {}
  if (r.statusCode >= 300) { const m = j && j.error && (j.error.message || j.error); throw Object.assign(new Error('Drive ' + r.statusCode + (m ? ': ' + m : '')), { status: r.statusCode }); }
  return j || {};
}
const gdQ = o => new URLSearchParams(o).toString();
async function gdList(folder, depth = 0, out = []) { // mọi file (kể cả thư mục con) trong 1 thư mục
  let tok = '';
  do {
    const p = { q: `'${folder}' in parents and trashed=false`, fields: 'nextPageToken,files(id,name,thumbnailLink,mimeType,size,modifiedTime,description,videoMediaMetadata(durationMillis,width,height),imageMediaMetadata(width,height))', pageSize: '1000', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' }; if (tok) p.pageToken = tok;
    const j = await gdJson(GD_API + '/drive/v3/files?' + gdQ(p));
    for (const f of j.files || []) { if (f.mimeType === GD_FOLDER) { if (depth < 10) await gdList(f.id, depth + 1, out); } else if (!/^application\/vnd\.google-apps\./.test(f.mimeType || '')) out.push(f); }
    tok = j.nextPageToken || '';
  } while (tok);
  return out;
}
async function gdResolve() { // chỉ đặt thư mục GỐC → tự tìm (hoặc tạo) thư mục con Video + img bên trong
  if (GD.vid && GD.img) return;
  if (!GD.root) { // tìm thư mục theo tên (mặc định WEB-Video), KHÔNG phân biệt hoa/thường; ưu tiên thư mục nằm trong "Drive của tôi"
    const key = x => norm(String(x || '')).replace(/[\s_-]+/g, ''), want = key(GD.name), pick = fs_ => (fs_ || []).filter(f => key(f.name) === want);
    const inRoot = await gdJson(GD_API + '/drive/v3/files?' + gdQ({ q: `'root' in parents and mimeType='${GD_FOLDER}' and trashed=false`, fields: 'files(id,name)', pageSize: '1000', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' })).catch(() => ({}));
    let hit = pick(inRoot.files);
    if (!hit.length) { // không nằm ngay ở Drive của tôi → tìm cả thư mục được chia sẻ
      const first = GD.name.split(/[\s_-]+/)[0].replace(/[\\']/g, '');
      const f = await gdJson(GD_API + '/drive/v3/files?' + gdQ({ q: `name contains '${first}' and mimeType='${GD_FOLDER}' and trashed=false`, fields: 'files(id,name)', pageSize: '200', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' }));
      hit = pick(f.files);
    }
    if (!hit.length) throw new Error(`Không thấy thư mục "${GD.name}" trong "Drive của tôi" của tài khoản đã đăng nhập (kiểm tra tên thư mục, hoặc đăng nhập đúng tài khoản Google, hoặc điền GDRIVE_ROOT_FOLDER_ID)`);
    GD.root = hit[0].id;
  }
  const j = await gdJson(GD_API + '/drive/v3/files?' + gdQ({ q: `'${GD.root}' in parents and mimeType='${GD_FOLDER}' and trashed=false`, fields: 'files(id,name)', pageSize: '200', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' }));
  const find = names => (j.files || []).find(f => names.includes(norm(f.name)));
  const mk = async name => { try { return (await gdJson(GD_API + '/drive/v3/files?supportsAllDrives=true&fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: GD_FOLDER, parents: [GD.root] }) })).id; } catch (e) { say('Drive: không tạo được thư mục', name, '-', e.message); return ''; } };
  if (!GD.vid) GD.vid = (find(VID_NAMES) || {}).id || await mk('Video');
  if (!GD.img) GD.img = (find(IMG_NAMES) || {}).id || await mk('img');
}
const GD_EXT = { 'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm', 'video/x-matroska': '.mkv', 'video/ogg': '.ogv', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif' };
function gdClassify(f) { // → { kind, mime, ext } | null  (tên file ngẫu nhiên / không có đuôi vẫn nhận nhờ mimeType của Drive)
  const name = f.name || '', ext = path.extname(name).toLowerCase(), dm = String(f.mimeType || '').toLowerCase();
  if (!(+f.size > 0) || PARTIAL.test(name)) return null;
  let kind = '', mime = '';
  if (/^(video|image)\/[\w.+-]+$/.test(dm)) { kind = dm.slice(0, dm.indexOf('/')); mime = dm; }
  else if (EV[ext]) { kind = 'video'; mime = EV[ext]; } else if (EI[ext]) { kind = 'image'; mime = EI[ext]; }
  if (!kind) return null;
  if (kind === 'video' && (ext === '.mkv' || ext === '.webm') && !/^video\/(x-matroska|webm)$/.test(mime)) mime = EV[ext];
  return { kind, mime, ext: ext && /^\.[a-z0-9]{1,6}$/.test(ext) ? ext : GD_EXT[mime] || (kind === 'video' ? '.mp4' : '.jpg') };
}
let gdBusy = false, gdAgain = false, gdSig = null;
async function scanDrive(force) {
  if (gdBusy) { gdAgain = gdAgain || !!force; return; } gdBusy = true;
  try {
    await gdResolve();
    const seen = new Map(); for (const d of [GD.vid, GD.img]) if (d) for (const f of await gdList(d)) seen.set(f.id, f); // lỗi mạng/API → ném ra, KHÔNG xoá gì trong CSDL
    const items = [];
    for (const f of seen.values()) {
      if (f.thumbnailLink) gdThumbLink.set(f.id, f.thumbnailLink);
      const c = gdClassify(f); if (!c) continue;
      const vm = f.videoMediaMetadata || f.imageMediaMetadata || {}, desc = String(f.description || '').split(/\r?\n/)[0].trim().slice(0, 200);
      items.push({ gid: f.id, kind: c.kind, mime: c.mime, name: f.id + c.ext, title: desc || path.basename(f.name, path.extname(f.name)) || f.name, size: +f.size, mtime: Date.parse(f.modifiedTime) || 0, dur: (+vm.durationMillis || 0) / 1000, w: +vm.width || 0, h: +vm.height || 0 });
    }
    const sig = items.map(i => `${i.gid}|${i.title}|${i.size}|${i.mtime}|${i.dur}`).sort().join('\n');
    if (!force && sig === gdSig) return; gdSig = sig;
    const old = new Map(db.prepare('SELECT id,gid,size,mtime FROM media WHERE gid IS NOT NULL').all().map(r => [r.gid, r]));
    const ins = db.prepare(`INSERT INTO media(id,kind,filename,title,mime,size,mtime,added_at,gid)VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(kind,filename) DO UPDATE SET title=excluded.title,mime=excluded.mime,size=excluded.size,mtime=excluded.mtime,gid=excluded.gid,info=CASE WHEN media.size<>excluded.size OR media.mtime<>excluded.mtime THEN NULL ELSE media.info END,q=CASE WHEN media.size<>excluded.size OR media.mtime<>excluded.mtime THEN 0 ELSE media.q END,dur=CASE WHEN media.size<>excluded.size OR media.mtime<>excluded.mtime THEN 0 ELSE media.dur END,bad=CASE WHEN media.size<>excluded.size OR media.mtime<>excluded.mtime THEN NULL ELSE media.bad END,bad_src=CASE WHEN media.size<>excluded.size OR media.mtime<>excluded.mtime THEN NULL ELSE media.bad_src END`);
    tx(() => {
      const keep = new Set(items.map(i => i.gid));
      for (const i of items) { const o = old.get(i.gid); if (o && (o.size !== i.size || o.mtime !== i.mtime)) { fs.rmSync(thumbPath(o.id), { force: true }); spriteRm(o.id); thumbFail.delete(o.id); } ins.run(rnd(9), i.kind, i.name, i.title, i.mime, i.size, i.mtime, Date.now(), i.gid); }
      for (const r of db.prepare('SELECT id,gid FROM media').all()) if (!r.gid || !keep.has(r.gid)) { db.prepare('DELETE FROM media WHERE id=?').run(r.id); fs.rmSync(thumbPath(r.id), { force: true }); spriteRm(r.id); thumbFail.delete(r.id); } // file đã xoá khỏi Drive (hoặc file cũ trên máy) → bỏ khỏi web
    });
    const row = db.prepare('SELECT id,q FROM media WHERE gid=?');
    const updImg = db.prepare('UPDATE media SET q=1,info=? WHERE id=?');
    for (const i of items) { // thời lượng/kích thước lấy thẳng từ Drive — không cần tải file
      const r = row.get(i.gid); if (!r || r.q) continue;
      if (i.kind === 'image') updImg.run(JSON.stringify({ v: PROC_VER, w: i.w, h: i.h }), r.id);
      else if (i.dur > 0) setInfo(r.id, { dur: i.dur, w: i.w, h: i.h, drive: 1 });
    }
    broadcast(); queueMissing();
  } finally { gdBusy = false; if (gdAgain) { gdAgain = false; scanDrive(true).catch(e => say('drive scan:', e.message)); } }
}
let ffAct = 0; const ffWait = [], ffSlot = () => ffAct < 1 ? (ffAct++, Promise.resolve()) : new Promise(ok => ffWait.push(ok)), ffFree = () => { if (ffWait.length) ffWait.shift()(); else ffAct--; };
async function gdThumb_(r) { // ảnh xem trước: ưu tiên thumbnail của Drive, không có thì để ffmpeg đọc trực tiếp từ Drive
  const th = thumbPath(r.id), tmp = path.join(TMP, 'th_' + r.id + '.jpg');
  const tryLink = async link => {
    const u = link.replace(/=s\d+(-c)?$/, '') + '=s480', own = /(^|\.)(googleusercontent|googleapis)\.com$/.test(new URL(u).hostname) || new URL(u).host === new URL(GD_API).host;
    const sg = AbortSignal.timeout(12000), rs = await gdCall(u, { signal: sg }, !own);
    if (rs.statusCode !== 200) { say('Drive thumb HTTP', rs.statusCode, r.id); rs.resume(); return false; }
    fs.writeFileSync(tmp, await gdRead(rs)); if (fs.statSync(tmp).size > 200) { fs.renameSync(tmp, th); return true; } return false;
  };
  try {
    const c = gdThumbLink.get(r.gid); if (c) { try { if (await tryLink(c)) return 'link'; } catch {} gdThumbLink.delete(r.gid); } // link có sẵn từ lần quét; hết hạn/lỗi mới hỏi API
    const j = await gdJson(`${GD_API}/drive/v3/files/${encodeURIComponent(r.gid)}?` + gdQ({ fields: 'thumbnailLink', supportsAllDrives: 'true' }));
    if (j.thumbnailLink && await tryLink(j.thumbnailLink)) return 'api';
    if (!j.thumbnailLink) say('Drive chưa có thumbnailLink cho', r.id, r.kind, '→ dùng ffmpeg');
  } catch (e) { say('Drive thumbnail:', r.id, e.message); } finally { fs.rmSync(tmp, { force: true }); }
  if (!FF.ok) return false;
  const tok = await gdToken().catch(() => ''); if (!tok) return false;
  await ffSlot(); try { // ffmpeg đọc qua mạng nặng CPU/băng thông → chỉ 1 việc cùng lúc, tránh lag máy
  return await makeThumb(`${GD_API}/drive/v3/files/${encodeURIComponent(r.gid)}?alt=media&supportsAllDrives=true`, r.kind, +r.dur || 0, r.id, ['-rw_timeout', '15000000', '-headers', `Authorization: Bearer ${tok}\r\n`]) ? 'ffmpeg' : false; } finally { ffFree(); }
}
const tst = { n: 0, ms: 0, link: 0, api: 0, ffmpeg: 0, fail: 0 };
async function gdThumb(r) { // luôn trả về trong tối đa 60 giây (kể cả khi mạng treo) → không bao giờ kẹt ô tải ảnh
  const t0 = Date.now(); let res = false; try { res = await Promise.race([gdThumb_(r), sleep(60000).then(() => false)]); } catch { res = false; }
  const dt = Date.now() - t0; if (!res || res === 'ffmpeg' || dt > 4000) say('thumb', res || 'LỖI', r.id, dt + 'ms', r.kind, 'dur=' + Math.round(+r.dur || 0) + 's', 'size=' + Math.round((+r.size || 0) / 1048576) + 'MB');
  tst.n++; tst.ms += Date.now() - t0; tst[res || 'fail']++; if (tst.n % 10 === 0) { say('thumb stats:', JSON.stringify({ ...tst, avgMs: Math.round(tst.ms / tst.n), waiting: thumbWait.length, active: thumbAct })); }
  return res;
}
async function processDrive(job, r) {
  let inf = {}; try { inf = JSON.parse(r.info || '{}') || {}; } catch {}
  if (r.kind === 'video' && !job.thumbOnly && FF.ok && inf.drive && !inf.nopr) { // đọc codec thật bằng ffprobe qua HTTP (chỉ tải phần đầu/đuôi file) để cảnh báo video không phát được
    for (let i = 0; gdStreams && i < 200; i++) await sleep(3000); // đang phát video → nhường toàn bộ băng thông Drive cho video
    const tok = await gdToken().catch(() => ''); let d = null;
    if (tok) { const o = await run(FFPROBE, ['-v', 'error', '-rw_timeout', '15000000', '-headers', `Authorization: Bearer ${tok}\r\n`, '-print_format', 'json', '-show_format', '-show_streams', `${GD_API}/drive/v3/files/${encodeURIComponent(r.gid)}?alt=media&supportsAllDrives=true`], r.id, true, 30000); try { d = o && JSON.parse(o); } catch {} }
    if (d && d.format && d.streams) { const { vs, info } = infoOf(d); if (!vs) info.err = 'File không có luồng hình ảnh'; else if (!(info.dur > 0)) info.dur = inf.dur || 0; setInfo(r.id, info); }
    else setInfo(r.id, { ...inf, nopr: 1 });
  }
  if (!thumbTime(r.id) && !await gdThumb(r)) failThumb(r.id);
  broadcast();
}
// ---- SỬA VIDEO LỖI TRÊN DRIVE: tải về → ghi lại thành MP4 mới y chang (giữ nguyên hình, chỉ ghi lại âm thanh AAC, bỏ gói hỏng) → kiểm tra → tải lên Drive → chuyển bản cũ vào Thùng rác ----
const repairQ = [], repairing = new Set(); let repairBusy = false;
function enqueueRepair(id) { if (repairing.has(id)) return false; repairing.add(id); repairQ.push(id); converting.add(id); broadcast(); repairPump(); return true; }
async function repairPump() { if (repairBusy) return; repairBusy = true; try { while (repairQ.length) { const id = repairQ.shift(); try { await repairDrive(id); } catch (e) { say('Sửa video LỖI:', id, e.message); const r = db.prepare('SELECT title FROM media WHERE id=?').get(id); errlog('repair', r ? r.title : id, id, 'Sửa video thất bại: ' + e.message); } finally { repairing.delete(id); converting.delete(id); broadcast(); } } } finally { repairBusy = false; } }
async function repairDrive(id) {
  const r = db.prepare('SELECT * FROM media WHERE id=?').get(id); if (!r || !r.gid || r.kind !== 'video') throw new Error('không tìm thấy video trên Drive');
  const tag = rnd(8).replace(/\W/g, 'x'), src = path.join(TMP, tag + '_in'), out = path.join(TMP, tag + '_out.mp4'), LONG = 8 * 3600 * 1000;
  try {
    say('Sửa video: tải', r.title); // 1) tải bản gốc
    const dl = await gdCall(`${GD_API}/drive/v3/files/${encodeURIComponent(r.gid)}?alt=media&supportsAllDrives=true`);
    if (dl.statusCode !== 200) { dl.resume(); throw new Error('không tải được từ Drive (' + dl.statusCode + ')'); }
    await new Promise((ok, no) => pipeline(dl, fs.createWriteStream(src), e => e ? no(e) : ok()));
    const probe = async f => { const o = await run(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', f], id, true); try { return o && JSON.parse(o); } catch { return null; } };
    const d0 = await probe(src); if (!d0) throw new Error('ffprobe không đọc được file gốc'); const { vs, au, info } = infoOf(d0); if (!vs) throw new Error('file không có luồng hình ảnh');
    const vOk = info.vc === 'h264' && /^yuvj?420p$/.test(info.pf || 'yuv420p') && !info.hi && info.geo !== false, tail = ['-movflags', '+faststart', '-f', 'mp4', out]; // pixel không vuông / video xoay → KHÔNG giữ nguyên hình, mã hoá lại để đúng khung
    const base = ['-y', '-nostdin', '-v', 'error', '-threads', String(FF_THREADS), '-err_detect', 'ignore_err', '-fflags', '+discardcorrupt+genpts', '-i', src, '-map', '0:v:0', '-map', '0:a:0?', '-sn', '-dn'];
    const x264 = ['-c:v', 'libx264', '-vf', VF_FIX, '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-profile:v', 'high'], aac = ['-c:a', 'aac', '-b:a', '192k', '-ac', '2'];
    const tries = [[...base, ...(vOk ? ['-c:v', 'copy'] : x264), ...aac, ...tail], [...base, ...x264, ...aac, ...tail]]; // lần 1: giữ nguyên hình; lần 2 (nếu lần 1 lỗi): mã hoá lại cả hình
    let good = false, why = '';
    for (let i = 0; i < tries.length && !good; i++) {
      if (i === 1 && vOk === false) break; // lần 2 trùng lần 1
      fs.rmSync(out, { force: true }); say('Sửa video: ghi lại lần', i + 1, r.title);
      if (await run(FFMPEG, tries[i], id, true, LONG) === null) { why = lastErr || 'ffmpeg thất bại'; continue; }
      const d2 = await probe(out); if (!d2 || Math.abs((+d2.format.duration || 0) - info.dur) > Math.max(3, info.dur * 0.02)) { why = 'file mới lệch thời lượng'; continue; }
      if (au && await run(FFMPEG, ['-v', 'error', '-xerror', '-i', out, '-map', '0:a:0', '-f', 'null', '-'], id, true, LONG) === null) { why = 'âm thanh file mới vẫn lỗi: ' + lastErr; continue; } // 2) kiểm tra giải mã toàn bộ âm thanh
      good = true;
    }
    if (!good) throw new Error(why || 'không tạo được file mới hợp lệ');
    if (!GD.vid) { try { await gdResolve(); } catch {} } if (!GD.vid) throw new Error('chưa xác định được thư mục Video trên Drive');
    const st = fs.statSync(out), name = crypto.randomBytes(16).toString('hex') + '.mp4'; say('Sửa video: tải lên', r.title, st.size);
    await gdUpload(out, st.size, name, 'video/mp4', r.title, GD.vid); // 3) tải bản mới lên (giữ nguyên tiêu đề)
    try { await gdTrash(r.gid); } catch (e) { if (e.status !== 404) throw new Error('đã tạo bản mới nhưng không xoá được bản cũ trên Drive: ' + e.message + (e.status === 403 ? ' (cần quyền Biên tập viên)' : '')); } // 4) chỉ xoá bản cũ SAU KHI bản mới đã lên Drive
    db.prepare('DELETE FROM media WHERE id=?').run(r.id); fs.rmSync(thumbPath(r.id), { force: true }); spriteRm(r.id); thumbFail.delete(r.id);
    say('Sửa video: xong, đã thay bản cũ', r.title); scanSafe(true);
  } finally { fs.rmSync(src, { force: true }); fs.rmSync(out, { force: true }); }
}
function serveDrive(req, res, r, o = {}) { return serveDrive_(req, res, r, o).catch(e => { say('Drive stream:', r.id, e.message); if (!res.headersSent) { res.writeHead(502, { 'Cache-Control': 'no-store' }); res.end(); } else res.destroy(); }); }
const rcache = new Map(), RC_MAX = 128 * 1024 * 1024; let rcBytes = 0; // LRU trong RAM cho các đoạn video đã tải trọn vẹn từ Drive
const rcGet = k => { const b = rcache.get(k); if (b) { rcache.delete(k); rcache.set(k, b); } return b; };
const rcSet = (k, b) => { rcache.set(k, b); rcBytes += b.length; while (rcBytes > RC_MAX && rcache.size > 1) { const [k0, b0] = rcache.entries().next().value; rcache.delete(k0); rcBytes -= b0.length; } };
async function serveDrive_(req, res, r, o) { // phát/tua (Range) trực tiếp từ Drive qua máy chủ — trình duyệt không bao giờ thấy link Drive hay token
  const size = r.size, etag = `"${size}-${Math.floor(r.mtime)}"`, rg = req.headers.range, ir = req.headers['if-range'];
  const h = { 'Content-Type': r.mime, 'Accept-Ranges': 'bytes', ETag: etag, 'Cache-Control': o.cache || 'public, max-age=600', 'Content-Disposition': o.dl ? "attachment; filename*=UTF-8''" + encodeURIComponent(o.dl) : 'inline' };
  if (!rg && req.headers['if-none-match'] === etag) { res.writeHead(304, h); return res.end(); }
  let start = 0, end = size - 1, code = 200; const m = /^bytes=(\d*)-(\d*)$/.exec(rg || '');
  if (m && (m[1] || m[2]) && (!ir || ir === etag)) {
    if (m[1] === '') start = Math.max(size - +m[2], 0);
    else { start = +m[1]; if (m[2] !== '') end = Math.min(+m[2], end); else if (o.chunk) end = Math.min(start + CHUNK - 1, end); }
    if (start > end || start >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); return res.end(); }
    code = 206; h['Content-Range'] = `bytes ${start}-${end}/${size}`;
  }
  h['Content-Length'] = end - start + 1;
  if (req.method === 'HEAD') { res.writeHead(code, h); return res.end(); }
  const ck = `${r.gid}|${Math.floor(r.mtime)}|${start}-${end}`, hit = rcGet(ck);
  if (hit) { res.writeHead(code, h); return res.end(hit); }
  gdStreams++; const ac = new AbortController(); res.on('close', () => { gdStreams--; ac.abort(); });
  const up = await gdCall(`${GD_API}/drive/v3/files/${encodeURIComponent(r.gid)}?alt=media&supportsAllDrives=true`, { headers: { Range: `bytes=${start}-${end}` }, signal: ac.signal });
  if (up.statusCode !== 200 && up.statusCode !== 206) { up.resume(); res.writeHead(up.statusCode === 404 ? 404 : 502, { 'Cache-Control': 'no-store' }); return res.end(); }
  res.writeHead(code, h); up.on('error', () => res.destroy());
  const want = end - start + 1, bufs = []; let got = 0;
  if (want > 0 && want <= CHUNK) { up.on('data', d => { got += d.length; bufs.push(d); }); up.on('end', () => { if (got === want) rcSet(ck, Buffer.concat(bufs)); }); }
  up.pipe(res);
}
async function gdUpload(file, size, name, mime, title, folder) { // tải lên Drive (resumable) với TÊN NGẪU NHIÊN; tên gốc lưu vào "mô tả" để web hiện làm tiêu đề
  const init = await gdCall(`${GD_API}/upload/drive/v3/files?` + gdQ({ uploadType: 'resumable', supportsAllDrives: 'true', fields: 'id' }), { method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(size) }, body: JSON.stringify({ name, parents: [folder], description: title, mimeType: mime }) });
  if (init.statusCode >= 300 || !init.headers.location) { const t = (await gdRead(init)).toString('utf8'); let m = ''; try { m = JSON.parse(t).error.message; } catch {} throw new Error('Drive ' + init.statusCode + (m ? ': ' + m : '')); }
  init.resume();
  const put = await gdHttp(init.headers.location, { method: 'PUT', headers: { 'Content-Length': String(size), 'Content-Type': mime }, body: fs.createReadStream(file) });
  const t = (await gdRead(put)).toString('utf8'); if (put.statusCode >= 300) { let m = ''; try { m = JSON.parse(t).error.message; } catch {} throw new Error('Drive ' + put.statusCode + (m ? ': ' + m : '')); }
  try { return JSON.parse(t).id; } catch { return ''; }
}
const gdTrash = id => gdJson(`${GD_API}/drive/v3/files/${encodeURIComponent(id)}?` + gdQ({ supportsAllDrives: 'true', fields: 'id' }), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) }); // vào Thùng rác Drive (khôi phục được)

// ---- database + migrations ----
const db = new DatabaseSync(path.join(DATA, 'app.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL; PRAGMA temp_store = MEMORY; PRAGMA cache_size = -32000; PRAGMA mmap_size = 134217728; PRAGMA busy_timeout = 5000;'); // WAL + NORMAL: ghi nhanh hơn nhiều mà vẫn an toàn
const tx = fn => { db.exec('BEGIN'); try { fn(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } };
const MIGRATIONS = [`
CREATE TABLE admin_users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE sessions(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE, token_hash TEXT UNIQUE NOT NULL, csrf TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE password_reset_tokens(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE, token_hash TEXT UNIQUE NOT NULL, expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE media(id TEXT PRIMARY KEY, kind TEXT NOT NULL, filename TEXT NOT NULL, title TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, mtime INTEGER NOT NULL, added_at INTEGER NOT NULL, UNIQUE(kind, filename));
CREATE TABLE settings(k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE audit_logs(id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, actor TEXT, action TEXT NOT NULL, detail TEXT);`,
`ALTER TABLE media ADD COLUMN info TEXT;`,
`ALTER TABLE admin_users ADD COLUMN username TEXT; CREATE UNIQUE INDEX ux_admin_username ON admin_users(username) WHERE username IS NOT NULL; CREATE INDEX ix_media_size ON media(kind, size);`,
`ALTER TABLE media ADD COLUMN dur REAL NOT NULL DEFAULT 0; ALTER TABLE media ADD COLUMN bad TEXT; ALTER TABLE media ADD COLUMN bad_src TEXT; ALTER TABLE media ADD COLUMN q INTEGER NOT NULL DEFAULT 0;
UPDATE media SET dur=COALESCE(json_extract(info,'$.dur'),0); CREATE INDEX ix_media_dur ON media(kind, dur);`,
`ALTER TABLE media ADD COLUMN gid TEXT; CREATE UNIQUE INDEX ux_media_gid ON media(gid) WHERE gid IS NOT NULL;`,
`CREATE INDEX IF NOT EXISTS ix_media_added ON media(kind, added_at); CREATE INDEX IF NOT EXISTS ix_media_title ON media(kind, title COLLATE NOCASE);`];
for (let v = db.prepare('PRAGMA user_version').get().user_version; v < MIGRATIONS.length; v++) tx(() => { db.exec(MIGRATIONS[v]); db.exec(`PRAGMA user_version = ${v + 1}`); });
const getSet = k => { const r = db.prepare('SELECT v FROM settings WHERE k=?').get(k); return r ? JSON.parse(r.v) : null; };
const setSet = (k, v) => db.prepare('INSERT INTO settings(k,v)VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').run(k, JSON.stringify(v));
const audit = (actor, action, detail) => db.prepare('INSERT INTO audit_logs(ts,actor,action,detail)VALUES(?,?,?,?)').run(Date.now(), actor || null, action, detail || null);
const hasAdmin = () => !!db.prepare("SELECT 1 FROM admin_users WHERE password_hash LIKE 'scrypt$%' OR password_hash='!' LIMIT 1").get(); // tài khoản argon2 cũ coi như chưa có → đặt lại từ localhost

// ---- nhận diện video/ảnh theo NỘI DUNG (không phụ thuộc đuôi file) ----
const EV = { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo', '.wmv': 'video/x-ms-wmv', '.asf': 'video/x-ms-asf', '.flv': 'video/x-flv', '.f4v': 'video/mp4', '.ts': 'video/mp2t', '.m2ts': 'video/mp2t', '.mts': 'video/mp2t', '.mpg': 'video/mpeg', '.mpeg': 'video/mpeg', '.mpe': 'video/mpeg', '.vob': 'video/mpeg', '.3gp': 'video/3gpp', '.3g2': 'video/3gpp2', '.ogv': 'video/ogg', '.divx': 'video/x-msvideo', '.rm': 'video/vnd.rn-realvideo', '.rmvb': 'video/vnd.rn-realvideo', '.mxf': 'application/mxf' };
const EI = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.jfif': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.bmp': 'image/bmp' };
const PARTIAL = /\.(part|crdownload|tmp|temp|download|aria2|opdownload|!ut|!qb|filepart)$/i;
function sniff(b, ext) {
  const s = (a, z) => b.toString('latin1', a, z), n = b.length;
  if (n >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return ['image', 'image/jpeg'];
  if (n >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return ['image', 'image/png'];
  if (s(0, 4) === 'GIF8') return ['image', 'image/gif'];
  if (s(0, 4) === 'RIFF') { const t = s(8, 12); if (t === 'WEBP') return ['image', 'image/webp']; if (t === 'AVI ') return ['video', 'video/x-msvideo']; return null; }
  if (n > 18 && b[0] === 0x42 && b[1] === 0x4D && [12, 40, 52, 56, 64, 108, 124].includes(b.readUInt32LE(14))) return ['image', 'image/bmp'];
  if (n >= 12 && s(4, 8) === 'ftyp') { const br = s(8, 12); if (/^avi[fs]$/.test(br)) return ['image', 'image/avif']; if (/^(heic|heix|hevx|mif1|msf1|heim|heis)$/.test(br)) return null; if (/^(M4A |M4B |F4A )/.test(br)) return null; return ['video', br === 'qt  ' ? 'video/quicktime' : br.startsWith('3g') ? 'video/3gpp' : 'video/mp4']; }
  if (n >= 8 && ['moov', 'mdat', 'wide', 'free', 'skip'].includes(s(4, 8))) return ['video', 'video/mp4'];
  if (n >= 4 && b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3) return ['video', s(0, 64).includes('webm') ? 'video/webm' : 'video/x-matroska'];
  if (s(0, 3) === 'FLV') return ['video', 'video/x-flv'];
  if (n >= 8 && b.subarray(0, 4).equals(Buffer.from([0x30, 0x26, 0xB2, 0x75])) && ext !== '.wma') return ['video', 'video/x-ms-asf'];
  if (s(0, 4) === 'OggS') return ext === '.ogv' ? ['video', 'video/ogg'] : null;
  if (n >= 4 && b[0] === 0 && b[1] === 0 && b[2] === 1 && (b[3] === 0xBA || b[3] === 0xB3)) return ['video', 'video/mpeg'];
  if (n >= 377 && b[0] === 0x47 && b[188] === 0x47 && b[376] === 0x47) return ['video', 'video/mp2t'];
  if (n >= 380 && b[4] === 0x47 && b[196] === 0x47 && b[388] === 0x47) return ['video', 'video/mp2t'];
  return null;
}
function classify(fp, st, extName) { // → { kind, mime } | null   (cache theo size+mtime)
  const key = st.size + ':' + st.mtimeMs, hit = clsCache.get(fp); if (hit && hit.key === key) return hit.res;
  const ext = (extName || path.extname(fp)).toLowerCase(); if (PARTIAL.test(extName || fp)) return null;
  let b = Buffer.alloc(512); try { const fd = fs.openSync(fp, 'r'); try { b = b.subarray(0, fs.readSync(fd, b, 0, 512, 0)); } finally { fs.closeSync(fd); } } catch { return null; }
  const sn = sniff(b, ext); let res = null;
  if (sn) res = { kind: sn[0], mime: sn[1] };
  else if (EV[ext]) res = { kind: 'video', mime: EV[ext] }; else if (EI[ext]) res = { kind: 'image', mime: EI[ext] };
  if (res && res.kind === 'video' && (ext === '.mkv' || ext === '.webm') && sn) res.mime = sn[1];
  clsCache.set(fp, { key, res }); return res;
}
const clsCache = new Map(), thumbFail = new Set();
const failThumb = id => { thumbFail.add(id); setTimeout(() => thumbFail.delete(id), 120e3).unref(); }; // lỗi tạm (429/mạng) → tự thử lại sau 2 phút, không bỏ hẳn
// Ảnh xem trước TẠO THEO YÊU CẦU: trình duyệt chỉ xin ảnh đang hiện trên màn hình → server làm ngay cái đó (cái xin sau cùng làm trước), không phải chờ xếp hàng cả thư viện
const thumbJobs = new Map(), thumbWait = []; let thumbAct = 0;
const thumbLim = () => gdStreams ? Math.min(2, THUMB_CONC) : THUMB_CONC; // đang phát video → chỉ 2 ảnh cùng lúc, dành băng thông Drive cho video
const thumbSlot = () => thumbAct < thumbLim() ? (thumbAct++, Promise.resolve()) : new Promise(ok => thumbWait.push(ok));
const thumbFree = () => { if (thumbAct > thumbLim() || !thumbWait.length) { thumbAct--; return; } thumbWait.pop()(); };
function ensureThumb(r) {
  let p = thumbJobs.get(r.id); if (p) return p;
  const i = thumbQueue.findIndex(q => q.id === r.id); if (i >= 0) thumbQueue.splice(i, 1); // đã có người xem → bỏ khỏi hàng chờ nền
  p = (async () => { await thumbSlot(); try { if (!thumbTime(r.id) && !await gdThumb(r)) failThumb(r.id); } catch (e) { failThumb(r.id); } finally { thumbFree(); } })().finally(() => thumbJobs.delete(r.id));
  thumbJobs.set(r.id, p); return p;
}
const uniqueName = (dir, name) => { const e = path.extname(name), b = path.basename(name, e); let n = name, i = 2; while (fs.existsSync(path.join(dir, n))) n = `${b} (${i++})${e}`; return n; };
const cleanName = n => { let x = path.basename(String(n || '')).replace(/[\x00-\x1f<>:"/\\|?*]/g, '_').replace(/^[. ]+|[. ]+$/g, '').slice(0, 180); if (/^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(x)) x = '_' + x; return x || 'file'; };

// ---- ffmpeg (tuỳ chọn): tìm cạnh file exe, thư mục bin, hoặc PATH ----
const bin = n => { for (const p of [path.join(ROOT, n + (WIN ? '.exe' : '')), path.join(ROOT, 'bin', n + (WIN ? '.exe' : ''))]) if (fs.existsSync(p)) return p; return n; };
let FFMPEG = bin('ffmpeg'), FFPROBE = bin('ffprobe'); const FF = { ok: false }, DL = { pct: -1 }, queue = [], convQueue = [], thumbQueue = [], busy = new Set(), converting = new Set(); let working = false, thumbWorkers = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FF_THREADS = Math.max(1, Math.floor(os.cpus().length / 4)), procs = new Map(); let lastStream = 0, lastErr = ''; // ffmpeg chỉ dùng ~1/4 số nhân + ưu tiên thấp → máy không bị 100% CPU
const run = (b, args, id, low, ms) => new Promise(ok => {
  const c = execFile(b, args, { windowsHide: true, maxBuffer: 1 << 26, ...(ms ? { timeout: ms, killSignal: 'SIGKILL' } : {}) }, (e, out, err) => { procs.delete(c); lastErr = e ? String(err || e.message || '').trim().split(/\r?\n/).slice(-3).join(' | ').replace(/ @ 0x[0-9a-f]+/gi, '').slice(0, 500) : ''; ok(e ? null : out); });
  procs.set(c, id || ''); try { os.setPriority(c.pid, low ? os.constants.priority.PRIORITY_LOW : os.constants.priority.PRIORITY_BELOW_NORMAL); } catch {}
});
const rmOrig = id => { try { for (const f of fs.readdirSync(ORIG)) if (f.startsWith(id + '_')) fs.rmSync(path.join(ORIG, f), { force: true }); } catch {} };
const thumbPath = id => path.join(THUMBS, id + '.jpg');
const thumbTime = id => { try { const s = fs.statSync(thumbPath(id)); return s.size > 200 ? Math.floor(s.mtimeMs) : 0; } catch { return 0; } };
// ---- Ảnh ghép xem trước thanh tua (kiểu "storyboard" của YouTube): 1 tấm JPEG chứa ~100 khung hình, tạo 1 lần rồi lưu lại ----
// Trình duyệt tải 1 tấm này là rê chuột tới đâu hiện ngay khung hình tới đó, không phải tua thẻ <video> ẩn qua mạng nữa.
const spritePath = id => path.join(THUMBS, id + '.sprite.jpg'), spriteMetaPath = id => path.join(THUMBS, id + '.sprite.json');
const spriteRm = id => { fs.rmSync(spritePath(id), { force: true }); fs.rmSync(spriteMetaPath(id), { force: true }); spriteFail.delete(id); };
const spriteFail = new Map(), spriteJobs = new Map(), spriteWait = []; let spriteAct = 0;
const spriteMeta = id => { try { if (fs.statSync(spritePath(id)).size < 500) return null; return JSON.parse(fs.readFileSync(spriteMetaPath(id), 'utf8')); } catch { return null; } };
function ensureSprite(r) {
  let p = spriteJobs.get(r.id); if (p) return p;
  p = (async () => {
    if (spriteAct >= 1) await new Promise(ok => spriteWait.push(ok)); else spriteAct++; // mỗi lần chỉ 1 video được tạo ảnh ghép → không tranh CPU / băng thông Drive
    try { if (!spriteMeta(r.id) && !await makeSprite(r)) spriteFail.set(r.id, Date.now()); }
    catch (e) { spriteFail.set(r.id, Date.now()); say('sprite:', r.id, e.message); }
    finally { const nx = spriteWait.shift(); if (nx) nx(); else spriteAct--; }
  })().finally(() => spriteJobs.delete(r.id));
  spriteJobs.set(r.id, p); return p;
}
async function makeSprite(r) {
  if (!FF.ok || r.kind !== 'video') return false;
  let inf = {}; try { inf = JSON.parse(r.info || '{}') || {}; } catch {}
  const dur = +inf.dur || +r.dur || 0; if (!(dur > 0.5)) return false;
  const COLS = 10, FH = 120, MAXN = 100, step = Math.max(1, dur / MAXN), n = Math.min(MAXN, Math.ceil(dur / step)), rows = Math.ceil(n / COLS);
  let FW = 2 * Math.round(FH * (inf.w > 0 && inf.h > 0 ? inf.w / inf.h : 16 / 9) / 2); FW = Math.min(320, Math.max(64, FW));
  let src, pre = [];
  if (r.gid) { const tok = await gdToken().catch(() => ''); if (!tok) return false; src = `${GD_API}/drive/v3/files/${encodeURIComponent(r.gid)}?alt=media&supportsAllDrives=true`; pre = ['-rw_timeout', '30000000', '-headers', `Authorization: Bearer ${tok}\r\n`]; }
  else src = path.join(DIR[r.kind], r.filename);
  const out = path.join(TMP, 'sp_' + r.id + '.jpg'); fs.rmSync(out, { force: true });
  // chỉ giải mã khung hình chính (keyframe) → nhanh, ít tốn CPU; fps lấp đầy các mốc thời gian đều nhau
  const vf = `tpad=stop_mode=clone:stop_duration=${Math.ceil(step * 6 + 10)},fps=1/${step.toFixed(4)},scale=${FW}:${FH}:force_original_aspect_ratio=decrease,pad=${FW}:${FH}:(ow-iw)/2:(oh-ih)/2:black,format=yuvj420p,tile=${COLS}x${rows}`;
  await run(FFMPEG, ['-y', '-v', 'error', '-threads', '2', '-skip_frame', 'nokey', ...pre, '-i', src, '-an', '-sn', '-dn', '-vf', vf, '-frames:v', '1', '-q:v', '5', '-strict', 'unofficial', out], r.id, true, 25 * 60e3);
  try { if (fs.statSync(out).size < 500) throw 0; fs.renameSync(out, spritePath(r.id)); } catch { fs.rmSync(out, { force: true }); return false; }
  fs.writeFileSync(spriteMetaPath(r.id), JSON.stringify({ n, cols: COLS, w: FW, h: FH, step: +step.toFixed(4) })); return true;
}
const PROC_VER = 3;
// ---- nhật ký lỗi video: mỗi video không phát được có 1 dòng ghi rõ nguyên nhân (data\logs\video-errors.log, đồng thời vào server.log) ----
const errf = path.join(LOGS, 'video-errors.log'); try { if (fs.statSync(errf).size > 2e6) fs.renameSync(errf, errf + '.old'); } catch {}
function errlog(src, title, id, reason, extra) {
  let l = `[${new Date().toISOString()}] [${src}] "${title}" (${id}) → ${reason}` + (extra ? ' | ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''); l = l.replace(/[\r\n\u2028\u2029]+/g, ' ').slice(0, 1500);
  try { fs.appendFileSync(errf, l + '\n'); } catch {} say('VIDEO LỖI:', title, '→', reason);
}
// ---- đọc thời lượng/codec thẳng từ header file (JS thuần, không cần ffmpeg, gần như không tốn CPU) ----
const V_OK = new Set(['h264', 'vp8', 'vp9', 'av1', 'hevc']), A_OK = new Set(['aac', 'mp3', 'opus', 'vorbis', 'flac']), WEB_MIME = /^video\/(mp4|webm|quicktime|ogg)$/;
const VMAP = { avc1: 'h264', avc3: 'h264', hvc1: 'hevc', hev1: 'hevc', mp4v: 'mpeg4', av01: 'av1', vp09: 'vp9', vp08: 'vp8' }, AMAP = { mp4a: 'aac', 'ac-3': 'ac3', 'ec-3': 'eac3', Opus: 'opus', fLaC: 'flac', '.mp3': 'mp3', dtsc: 'dts', dtse: 'dts', dtsh: 'dts', alac: 'alac' };
const EMAP = { 'V_MPEG4/ISO/AVC': 'h264', 'V_MPEGH/ISO/HEVC': 'hevc', V_VP8: 'vp8', V_VP9: 'vp9', V_AV1: 'av1', A_AAC: 'aac', 'A_MPEG/L3': 'mp3', A_OPUS: 'opus', A_VORBIS: 'vorbis', A_FLAC: 'flac', A_AC3: 'ac3', A_EAC3: 'eac3', A_DTS: 'dts' };
function judge(m, mime) { // → chuỗi nguyên nhân nếu CHẮC CHẮN không phát được trên trình duyệt (HEVC chỉ bị coi là lỗi khi trình duyệt thật sự báo lỗi)
  const why = [];
  if (!WEB_MIME.test(mime)) why.push(`định dạng chứa (container) ${mime} — trình duyệt không phát trực tiếp, cần chuyển sang MP4`);
  if (m && !m.drive) {
    if (!m.vc) why.push('file không có luồng hình ảnh');
    else if (!V_OK.has(m.vc)) why.push(`codec hình ${String(m.vc).toUpperCase()} — trình duyệt không hỗ trợ`);
    else if (m.vc === 'h264' && (m.hi || /10|422|444/.test(m.pf || ''))) why.push('H.264 10-bit/4:2:2/4:4:4 — trình duyệt không hỗ trợ');
    if (m.ac && !A_OK.has(m.ac)) why.push(`codec âm thanh ${String(m.ac).toUpperCase()} — trình duyệt không hỗ trợ`);
  }
  return why.join('; ');
}
function boxes(b, s, e, cb) { let p = s; while (p + 8 <= e) { let sz = b.readUInt32BE(p), hl = 8; const t = b.toString('latin1', p + 4, p + 8); if (sz === 1) { if (p + 16 > e) return; sz = Number(b.readBigUInt64BE(p + 8)); hl = 16; } else if (sz === 0) sz = e - p; if (sz < hl) return; const end = Math.min(p + sz, e); if (cb(t, p + hl, end) === false) return; p = end; } }
function readMp4(fp, size) {
  let fd; try {
    fd = fs.openSync(fp, 'r'); const hb = Buffer.alloc(16); let pos = 0, late = false, moov = null;
    for (let i = 0; i < 300 && pos + 8 <= size; i++) {
      if (fs.readSync(fd, hb, 0, 16, pos) < 8) break; let sz = hb.readUInt32BE(0), hl = 8; const t = hb.toString('latin1', 4, 8);
      if (sz === 1) { sz = Number(hb.readBigUInt64BE(8)); hl = 16; } else if (sz === 0) sz = size - pos; if (sz < hl) break;
      if (t === 'moov') { if (sz > 128 << 20) return null; moov = Buffer.alloc(sz - hl); fs.readSync(fd, moov, 0, sz - hl, pos + hl); break; }
      if (t === 'mdat') late = true; pos += sz;
    }
    if (!moov) return null; let dur = 0, vt = null, at = null;
    boxes(moov, 0, moov.length, (t, s, e) => {
      if (t === 'mvhd') { const v = moov[s], ts = moov.readUInt32BE(s + (v ? 20 : 12)), d = v ? Number(moov.readBigUInt64BE(s + 24)) : moov.readUInt32BE(s + 16); if (ts) dur = d / ts; }
      else if (t === 'trak') { const tr = {};
        boxes(moov, s, e, (t2, s2, e2) => { if (t2 !== 'mdia') return; boxes(moov, s2, e2, (t3, s3, e3) => {
          if (t3 === 'hdlr') tr.type = moov.toString('latin1', s3 + 8, s3 + 12);
          else if (t3 === 'minf') boxes(moov, s3, e3, (t4, s4, e4) => { if (t4 !== 'stbl') return; boxes(moov, s4, e4, (t5, s5, e5) => { if (t5 !== 'stsd') return;
            const es = s5 + 8, esz = moov.readUInt32BE(es); tr.fmt = moov.toString('latin1', es + 4, es + 8);
            if (tr.type === 'vide') { tr.w = moov.readUInt16BE(es + 32); tr.h = moov.readUInt16BE(es + 34); boxes(moov, es + 86, Math.min(es + esz, e5), (t6, s6) => { if (t6 === 'avcC') tr.prof = moov[s6 + 1]; }); } }); }); }); });
        if (tr.type === 'vide' && !vt) vt = tr; else if (tr.type === 'soun' && !at) at = tr; }
    });
    const nm = (t, M) => t ? (M[t.fmt] || String(t.fmt).toLowerCase().trim()) : '';
    return { dur, w: vt && vt.w, h: vt && vt.h, vc: nm(vt, VMAP), ac: nm(at, AMAP), hi: !!(vt && [110, 122, 244, 44].includes(vt.prof)), fast: !late };
  } catch { return null; } finally { if (fd !== undefined) try { fs.closeSync(fd); } catch {} }
}
function ebml(b, s, e, cb) { let p = s; while (p < e) { const f = b[p]; if (!f) return; let l = 1, m = 0x80; while (!(f & m)) { m >>= 1; l++; } if (l > 4 || p + l >= e) return; const id = b.readUIntBE(p, l); p += l; const g = b[p]; if (!g) return; let n = 1; m = 0x80; while (!(g & m)) { m >>= 1; n++; } if (p + n > e) return; let sz = g & (m - 1); for (let i = 1; i < n; i++) sz = sz * 256 + b[p + i]; p += n; const end = sz === 2 ** (7 * n) - 1 ? e : Math.min(p + sz, e); if (cb(id, p, end) === false) return; p = end; } }
function readEbml(fp) { // mkv/webm: Info → Duration, Tracks → codec
  let fd; try {
    fd = fs.openSync(fp, 'r'); const buf = Buffer.alloc(1 << 20), n = fs.readSync(fd, buf, 0, buf.length, 0), m = { dur: 0, vc: '', ac: '' }; let ts = 1e6;
    const uint = (s, e) => { let v = 0; for (let i = s; i < e; i++) v = v * 256 + buf[i]; return v; }, str = (s, e) => buf.toString('latin1', s, e).replace(/\0.*$/, '');
    ebml(buf, 0, n, (id, s, e) => { if (id !== 0x18538067) return; ebml(buf, s, e, (id2, s2, e2) => {
      if (id2 === 0x1549A966) ebml(buf, s2, e2, (id3, s3, e3) => { if (id3 === 0x2AD7B1) ts = uint(s3, e3); else if (id3 === 0x4489) m.dur = (e3 - s3 === 8 ? buf.readDoubleBE(s3) : e3 - s3 === 4 ? buf.readFloatBE(s3) : 0) * ts / 1e9; });
      else if (id2 === 0x1654AE6B) ebml(buf, s2, e2, (id3, s3, e3) => { if (id3 !== 0xAE) return; const t = {};
        ebml(buf, s3, e3, (id4, s4, e4) => { if (id4 === 0x83) t.type = uint(s4, e4); else if (id4 === 0x86) t.codec = str(s4, e4); else if (id4 === 0xE0) ebml(buf, s4, e4, (id5, s5, e5) => { if (id5 === 0xB0) t.w = uint(s5, e5); else if (id5 === 0xBA) t.h = uint(s5, e5); }); });
        const c = EMAP[t.codec] || String(t.codec || '').toLowerCase(); if (t.type === 1 && !m.vc) { m.vc = c; m.w = t.w; m.h = t.h; } else if (t.type === 2 && !m.ac) m.ac = c; }); }); });
    return m.vc || m.dur ? m : null;
  } catch { return null; } finally { if (fd !== undefined) try { fs.closeSync(fd); } catch {} }
}
const quickMeta = (fp, mime, size) => { try { if (/^video\/(mp4|quicktime|3gpp)/.test(mime)) return readMp4(fp, size); if (mime === 'video/webm' || mime === 'video/x-matroska') return readEbml(fp); } catch {} return null; };
function setInfo(id, info) { // lưu thông tin + thời lượng + (nếu có) nguyên nhân không phát được; ghi log khi có lỗi mới
  const r = db.prepare('SELECT kind,title,size,mime,bad,bad_src FROM media WHERE id=?').get(id); if (!r) return;
  const why = r.kind === 'video' ? (info.err || judge(info, r.mime)) : ''; let bad = why || null, src = why ? 'server' : null;
  if (!why && r.bad && r.bad_src === 'client') { bad = r.bad; src = 'client'; } // trình duyệt đã báo lỗi thật → giữ cho tới khi chuyển đổi/phát được
  db.prepare('UPDATE media SET info=?,dur=?,q=1,bad=?,bad_src=? WHERE id=?').run(JSON.stringify({ v: PROC_VER, ...info }), +info.dur || 0, bad, src, id);
  if (bad && bad !== r.bad) errlog(src, r.title, id, bad, { size: r.size, mime: r.mime, vc: info.vc, ac: info.ac, pf: info.pf, dur: Math.round(info.dur || 0) });
}
let qiT = 0;
function quickIndex() { // lập chỉ mục nhanh mọi file mới (thời lượng, codec, lỗi) — làm từng đợt nhỏ, không dùng ffmpeg
  clearTimeout(qiT); const rows = db.prepare('SELECT id,kind,title,filename,mime,size,info FROM media WHERE q=0 AND gid IS NULL LIMIT 40').all(); let n = 0;
  for (const r of rows) {
    if (r.kind === 'image') { db.prepare('UPDATE media SET q=1,info=? WHERE id=?').run(JSON.stringify({ v: PROC_VER }), r.id); n++; continue; }
    const fp = path.join(VID, r.filename); if (busy.has(fp)) continue; n++;
    let old = null; try { old = r.info ? JSON.parse(r.info) : null; } catch {}
    const m = quickMeta(fp, r.mime, r.size);
    if (m) setInfo(r.id, { dur: m.dur, w: m.w, h: m.h, vc: m.vc, ac: m.ac, hi: m.hi });
    else if (old && old.vc) { delete old.pend; delete old.v; setInfo(r.id, old); }
    else { const why = judge(null, r.mime); db.prepare('UPDATE media SET q=1,info=NULL,bad=?,bad_src=? WHERE id=?').run(why || null, why ? 'server' : null, r.id); if (why) errlog('server', r.title, r.id, why, { mime: r.mime, size: r.size }); }
  }
  if (rows.length) { broadcast(); queueMissing(); }
  if (db.prepare('SELECT 1 FROM media WHERE q=0 AND gid IS NULL LIMIT 1').get()) qiT = setTimeout(quickIndex, n ? 40 : 3000);
}
const queued = id => queue.some(q => q.id === id) || convQueue.some(q => q.id === id) || thumbQueue.some(q => q.id === id) || converting.has(id);
function queueMissing() { // ffmpeg sẵn sàng: tự chuyển các video server đã xác định là không tương thích trình duyệt
  if (!FF.ok && !GD.on) return;
  for (const r of db.prepare('SELECT id,kind,info,bad,bad_src,gid FROM media WHERE q=1').all()) {
    if (queued(r.id)) continue;
    if (r.gid) { // file trên Drive: không chuyển đổi tại máy; chỉ đọc codec (nếu có ffprobe) + làm ảnh xem trước
      let inf = {}; try { inf = JSON.parse(r.info || '{}') || {}; } catch {}
      if (!thumbTime(r.id) && !thumbFail.has(r.id)) thumbQueue.push({ id: r.id, thumbOnly: true, drv: true }); // ảnh bìa trước, song song
      else if (r.kind === 'video' && FF.ok && inf.drive && !inf.nopr) queue.push({ id: r.id, drv: true }); // đọc codec sau khi đã có ảnh (tuần tự, nhường video đang phát)
      continue;
    }
    if (!FF.ok) continue;
    if (r.kind === 'video' && r.bad && r.bad_src === 'server' && !/^Chuyển đổi thất bại:/i.test(String(r.bad))) {
      convQueue.push({ id: r.id, conv: true, auto: true });
      continue;
    }
    if (!r.info && r.kind === 'video') queue.push({ id: r.id });
    else if (!thumbTime(r.id) && !thumbFail.has(r.id)) thumbQueue.push({ id: r.id, thumbOnly: true });
  }
  pump(); pumpThumbs();
}
async function pump() { if (working) return; working = true;
  while (queue.length || convQueue.length) { const j = queue.length ? queue.shift() : convQueue.shift(); if (!j) continue; try { await processMedia(j); } catch (e) { say('ffmpeg:', e.message); } await sleep(j.conv ? 300 : j.drv ? 1500 : 1500); } // nghỉ giữa các việc → CPU trung bình gần 0
  working = false; }
function pumpThumbs() { // ảnh xem trước (Drive): chạy TỐI ĐA THUMB_CONC việc CÙNG LÚC — chỉ chờ mạng (tải thumbnailLink có sẵn của
  // Drive), hầu như không tốn CPU, nên gộp lại chờ từng cái như hàng đợi chuyển đổi sẽ RẤT CHẬM khi thư viện nhiều file.
  while (thumbWorkers < (gdStreams ? 1 : THUMB_CONC) && thumbQueue.length) { thumbWorkers++; thumbWorker(); }
}
async function thumbWorker() {
  try { while (thumbQueue.length) { const j = thumbQueue.shift(); if (!j) continue; try { await processMedia(j); } catch (e) { say('thumb:', e.message); } await sleep(30); } }
  finally { thumbWorkers--; }
}
async function makeThumb(file, kind, dur, id, pre = []) { // thử nhiều mốc thời gian; ép về JPEG 4:2:0 chuẩn
  const th = thumbPath(id), vf = 'scale=w=480:h=480:force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p';
  const at = kind === 'video' ? (pre.length ? [Math.min(dur * 0.05, 20), 0] : [Math.min(dur * 0.1, 60), Math.min(dur * 0.02, 5), 0]) : [null];
  for (const t of at) {
    fs.rmSync(th, { force: true });
    await run(FFMPEG, ['-y', '-v', 'error', '-threads', '1', ...(t === null ? [] : ['-ss', String(+t.toFixed(2))]), ...pre, '-i', file, '-frames:v', '1', '-an', '-sn', '-vf', vf, '-strict', 'unofficial', '-q:v', '4', th], id, true, pre.length ? 25000 : 45000);
    if (thumbTime(id)) return true;
  }
  return false;
}
const WEB_A = ['aac', 'mp3'];
const VF_FIX = 'scale=trunc(iw*sar/2)*2:trunc(ih/2)*2,setsar=1'; // chuẩn hoá khi mã hoá lại: bỏ méo pixel (SAR), kích thước chẵn → hình không bị phóng/cắt/kéo giãn
const infoOf = d => { const vs = d.streams.find(x => x.codec_type === 'video'), au = d.streams.find(x => x.codec_type === 'audio');
  return { vs, au, info: { dur: +d.format.duration || 0, w: vs && vs.width, h: vs && vs.height, vc: vs && vs.codec_name, ac: au && au.codec_name, pf: vs && vs.pix_fmt, geo: !(vs && (!/^(1:1|0:1|N\/A)?$/.test(vs.sample_aspect_ratio || '') || +((vs.tags || {}).rotate) || (vs.side_data_list || []).some(x => +x.rotation))), hi: !!(vs && vs.codec_name === 'h264' && /^High (10|4:2:2|4:4:4)/i.test(vs.profile || '')) } }; };
async function diagnose(r) {
  if (r.gid) return; // chi tiết luồng của 1 video (khi trình duyệt báo lỗi) → ghi log
  const fp = path.join(VID, r.filename), o = await run(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', fp], r.id, true);
  if (!o) return errlog('ffprobe', r.title, r.id, 'ffprobe không đọc được file (hỏng/cắt dở?)', lastErr);
  let d; try { d = JSON.parse(o); } catch { return; }
  errlog('ffprobe', r.title, r.id, 'Chi tiết luồng', { container: d.format.format_name, bitrate: d.format.bit_rate, dur: d.format.duration, streams: d.streams.map(x => `${x.codec_type}:${x.codec_name}${x.profile ? '/' + x.profile : ''}${x.pix_fmt ? '/' + x.pix_fmt : ''}${x.width ? ' ' + x.width + 'x' + x.height : ''}${x.channels ? ' ' + x.channels + 'ch' : ''}`) });
}
async function processMedia({ id, thumbOnly, conv }) {
  const r = db.prepare('SELECT * FROM media WHERE id=?').get(id); if (!r) return;
  if (r.gid) return processDrive({ id, thumbOnly, conv }, r);
  let fp = path.join(DIR[r.kind], r.filename); busy.add(fp);
  try {
    const probe = async f => { const o = await run(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', f], id, true); try { return o && JSON.parse(o); } catch { return null; } };
    if (thumbOnly) { let i = {}; try { i = JSON.parse(r.info || '{}'); } catch {} if (!await makeThumb(fp, r.kind, i.dur || 0, id)) thumbFail.add(id); return broadcast(); }
    const d = await probe(fp);
    if (!d) { const why = 'Không đọc được file (hỏng, cắt dở hoặc không phải video hợp lệ)' + (lastErr ? ' — ' + lastErr : ''); setInfo(id, r.kind === 'video' ? { err: why } : {}); if (!await makeThumb(fp, r.kind, 0, id)) thumbFail.add(id); return broadcast(); }
    let { vs, au, info } = infoOf(d);
    if (r.kind === 'video') { if (!vs) info.err = 'File không có luồng hình ảnh'; else if (!(info.dur > 0)) info.err = 'Không xác định được thời lượng'; }
    let convFailed = false;
    if (conv && r.kind === 'video' && vs && !info.err) { // tự chuyển khi server/client xác định video không tương thích; nhận cả WebM có codec/audio không phù hợp
      const ext = path.extname(fp).toLowerCase(), isMp4 = r.mime === 'video/mp4' || r.mime === 'video/quicktime', audOk = !au || WEB_A.includes(au.codec_name);
      const vOk = info.vc === 'h264' && /^yuvj?420p$/.test(info.pf || 'yuv420p') && !info.hi && info.geo !== false, need = !isMp4 || !vOk || !audOk || !fastOk(fp, fs.statSync(fp)), trans = !vOk;
      if (!need) { if (await run(FFMPEG, ['-v', 'error', '-threads', '1', '-xerror', '-t', '8', '-i', fp, '-f', 'null', '-'], id, true) === null) { info.err = 'Lỗi giải mã: ' + (lastErr || 'file hỏng hoặc bị cắt dở'); errlog('ffmpeg', r.title, id, info.err); } }
      else {
        const out = path.join(TMP, rnd(8).replace(/\W/g, 'x') + '.mp4');
        const args = ['-y', '-nostdin', '-v', 'error', '-threads', String(FF_THREADS), '-i', fp, '-map', '0:v:0', '-map', '0:a:0?', '-sn', '-dn',
          ...(trans ? ['-c:v', 'libx264', '-vf', VF_FIX, '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-threads', String(FF_THREADS)] : ['-c:v', 'copy']),
          ...(audOk ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', '192k', '-ac', '2']), '-movflags', '+faststart', '-f', 'mp4', out];
        converting.add(id); broadcast();
        let ok = false, d2 = null, why = '';
        try {
          if (await run(FFMPEG, args, id, true) !== null) {
            d2 = await probe(out);
            if (d2 && Math.abs((+d2.format.duration || 0) - info.dur) < Math.max(2, info.dur * 0.02)) {
              try { // đồng bộ, không await
                const want = isMp4 ? r.filename : path.basename(r.filename, ext) + '.mp4', base = want === r.filename ? want : uniqueName(VID, want);
                if (!isMp4 || trans) fs.renameSync(fp, path.join(ORIG, id + '_' + r.filename));
                const nf = path.join(VID, base); fs.renameSync(out, nf); const st = fs.statSync(nf);
                db.prepare('UPDATE media SET filename=?,mime=?,size=?,mtime=?,bad=NULL,bad_src=NULL WHERE id=?').run(base, 'video/mp4', st.size, st.mtimeMs, id);
                busy.delete(fp); fp = nf; busy.add(fp); ok = true; clsCache.delete(nf);
              } catch (e) { why = 'không thay được file: ' + (e.code || e.message); const bk = path.join(ORIG, id + '_' + r.filename); if (!fs.existsSync(fp) && fs.existsSync(bk)) fs.renameSync(bk, fp); }
            } else why = 'file sau chuyển đổi không hợp lệ hoặc lệch thời lượng';
          } else why = lastErr || 'ffmpeg thất bại';
        } finally { converting.delete(id); }
        if (ok) { info = infoOf(d2).info; }
        else {
          fs.rmSync(out, { force: true });
          info.err = 'Chuyển đổi thất bại: ' + why;
          errlog('ffmpeg', r.title, id, info.err);
          convFailed = true;
        }
      }
    }
    if (!await makeThumb(fp, r.kind, info.dur, id)) thumbFail.add(id); setInfo(id, info); if (convFailed) db.prepare("UPDATE media SET bad_src='convert_failed' WHERE id=?").run(id); broadcast();
  } finally { busy.delete(fp); if (!db.prepare('SELECT 1 FROM media WHERE id=?').get(id)) { fs.rmSync(thumbPath(id), { force: true }); spriteRm(id); rmOrig(id); } }
}
// ---- tự tải ffmpeg (Windows) nếu máy chưa có → ảnh xem trước + chuyển đổi codec hoạt động ngay, không cần cài tay ----
const FF_URLS = process.env.MP_FFMPEG_URL ? [process.env.MP_FFMPEG_URL] : ['https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip', 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip'];
async function expectedSha(url) {
  try { const sg = { signal: AbortSignal.timeout(12000) };
    if (/gyan\.dev/.test(url)) return (await (await fetch(url + '.sha256', sg)).text()).trim().split(/\s+/)[0].toLowerCase();
    if (/BtbN/.test(url)) { const t = await (await fetch(url.replace(/[^/]+$/, 'checksums.sha256'), sg)).text(), f = url.split('/').pop(), ln = t.split(/\r?\n/).find(x => x.trim().endsWith(f)); return ln ? ln.trim().split(/\s+/)[0].toLowerCase() : ''; } } catch {}
  return '';
}
async function ensureFfmpeg() {
  if (FF.ok || DL.pct >= 0 || process.env.MP_NO_FFMPEG_DL || (!WIN && !process.env.MP_FFMPEG_URL)) return;
  const BIN = path.join(ROOT, 'bin'), work = path.join(TMP, 'ffdl'), zip = path.join(work, 'ff.zip'), ex = path.join(work, 'x'); DL.pct = 0;
  for (const url of FF_URLS) {
    try {
      fs.rmSync(work, { recursive: true, force: true }); fs.mkdirSync(ex, { recursive: true });
      const r = await fetch(url, { redirect: 'follow' }); if (!r.ok) throw new Error('HTTP ' + r.status);
      const total = +r.headers.get('content-length') || 0; let got = 0, last = 0; const ws = fs.createWriteStream(zip);
      for await (const c of r.body) { got += c.length; if (!ws.write(c)) await new Promise(o => ws.once('drain', o)); if (total && Date.now() - last > 1500) { last = Date.now(); DL.pct = Math.min(99, Math.floor(got / total * 100)); broadcast(); } }
      await new Promise(o => ws.end(o)); DL.pct = 99; broadcast();
      if (!process.env.MP_FFMPEG_URL) { // bắt buộc khớp SHA-256 do nhà phát hành công bố → chống file bị tráo/hỏng
        const want = await expectedSha(url), hs = crypto.createHash('sha256'); await new Promise((o, n) => fs.createReadStream(zip).on('data', d => hs.update(d)).on('end', o).on('error', n));
        if (!want || hs.digest('hex') !== want) throw new Error(want ? 'sai mã SHA-256 của file ffmpeg tải về' : 'không lấy được mã SHA-256 để kiểm tra file ffmpeg');
      }
      const ok = await new Promise(o => execFile(WIN ? 'tar' : 'unzip', WIN ? ['-xf', zip, '-C', ex] : ['-q', '-o', zip, '-d', ex], { windowsHide: true, maxBuffer: 1 << 24 }, e => o(!e)))
        || (WIN && await new Promise(o => execFile('powershell.exe', ['-NoProfile', '-Command', `Expand-Archive -Force -LiteralPath '${zip}' -DestinationPath '${ex}'`], { windowsHide: true }, e => o(!e))));
      if (!ok) throw new Error('giải nén thất bại');
      const found = {}; (function w(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) w(f); else if (/^(ffmpeg|ffprobe)(\.exe)?$/i.test(e.name)) found[e.name.toLowerCase().replace('.exe', '')] = f; } })(ex);
      if (!found.ffmpeg || !found.ffprobe) throw new Error('không thấy ffmpeg/ffprobe trong file tải về');
      fs.mkdirSync(BIN, { recursive: true }); for (const n of ['ffmpeg', 'ffprobe']) { const to = path.join(BIN, n + (WIN ? '.exe' : '')); fs.copyFileSync(found[n], to); try { fs.chmodSync(to, 0o755); } catch {} }
      FFMPEG = bin('ffmpeg'); FFPROBE = bin('ffprobe'); FF.ok = await run(FFMPEG, ['-version']) !== null;
      if (FF.ok) { DL.pct = -1; fs.rmSync(work, { recursive: true, force: true }); broadcast(); queueMissing(); return; }
      throw new Error('ffmpeg tải về không chạy được');
    } catch (e) { say('tải ffmpeg lỗi:', e.message); }
  }
  DL.pct = -1; fs.rmSync(work, { recursive: true, force: true }); DL.failed = true; broadcast();
}
run(FFMPEG, ['-version']).then(o => { FF.ok = o !== null; if (!FF.ok) say('ffmpeg:', 'không tìm thấy → sẽ tự tải về thư mục bin (hoặc tự đặt ffmpeg.exe + ffprobe.exe cạnh MediaPlayer.exe)'); queueMissing(); if (!FF.ok) ensureFfmpeg(); });

// ---- chỉ mục media: quét video/ + img/ (kể cả thư mục con), tự sắp xếp đúng thư mục ----
const clients = new Set(), sseIp = new Map(); let bT = 0; const broadcast = () => { if (bT) return; bT = setTimeout(() => { bT = 0; clients.forEach(r => r.write('data: changed\n\n')); }, 700); };
let seenPrev = new Map(), lastSig = null;
function walk(dir, files, dirs, depth = 0) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    if (e.name.startsWith('.') || e.name.startsWith('~$') || /^(desktop\.ini|thumbs\.db)$/i.test(e.name)) continue;
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) { if (depth < 10) { dirs.push(fp); walk(fp, files, dirs, depth + 1); } } else if (e.isFile()) files.push(fp);
  }
}
function scan(force) {
  const files = [], dirs = []; walk(VID, files, dirs); walk(IMG, files, dirs);
  try { for (const e of fs.readdirSync(ROOT, { withFileTypes: true })) if (e.isFile() && !e.name.startsWith('.') && !/\.(ts|mts|rm)$/i.test(e.name)) files.push(path.join(ROOT, e.name)); } catch {} // video/ảnh để lẹo ngay cạnh exe/bat cũng được tự nhận & chuyển vào đúng thư mục
  const now = new Map(), items = [], hasRow = db.prepare('SELECT 1 FROM media WHERE kind=? AND filename=?');
  for (const fp0 of files) {
    let fp = fp0; if (busy.has(fp)) continue;
    let st; try { st = fs.statSync(fp); } catch { continue; } if (!st.size) continue;
    const key = st.size + ':' + st.mtimeMs; now.set(fp, key);
    const c = classify(fp, st); if (!c) continue;
    const stable = force || seenPrev.get(fp) === key, top = path.dirname(fp) === DIR[c.kind];
    if (!stable && !(top && hasRow.get(c.kind, path.basename(fp)))) continue; // file mới/đang copy dở: chờ đến lần quét sau
    if (!top) { // sai thư mục (video trong img, ảnh trong video, hoặc trong thư mục con) → chuyển về đúng chỗ
      const nn = uniqueName(DIR[c.kind], path.basename(fp)), to = path.join(DIR[c.kind], nn);
      try { fs.renameSync(fp, to); clsCache.delete(fp); fp = to; st = fs.statSync(fp); now.set(fp, st.size + ':' + st.mtimeMs); } catch (e) { say('không chuyển được', path.basename(fp), e.code || e.message); continue; }
    }
    items.push({ kind: c.kind, mime: c.mime, name: path.basename(fp), size: st.size, mtime: st.mtimeMs });
  }
  seenPrev = now;
  for (const d of dirs.sort((a, b) => b.length - a.length)) try { fs.rmdirSync(d); } catch {} // xoá thư mục con đã rỗng (rmdir không xoá nếu còn file)
  const sig = items.map(i => `${i.kind}|${i.name}|${i.size}|${i.mtime}`).sort().join('\n');
  if (!force && sig === lastSig) return; lastSig = sig;
  const ins = db.prepare(`INSERT INTO media(id,kind,filename,title,mime,size,mtime,added_at)VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(kind,filename) DO UPDATE SET size=excluded.size,mtime=excluded.mtime,mime=excluded.mime,info=CASE WHEN media.size<>excluded.size THEN NULL ELSE media.info END,q=CASE WHEN media.size<>excluded.size THEN 0 ELSE media.q END,dur=CASE WHEN media.size<>excluded.size THEN 0 ELSE media.dur END,bad=CASE WHEN media.size<>excluded.size THEN NULL ELSE media.bad END,bad_src=CASE WHEN media.size<>excluded.size THEN NULL ELSE media.bad_src END`);
  tx(() => {
    for (const k of ['video', 'image']) {
      const names = new Set();
      for (const i of items) if (i.kind === k) { names.add(i.name); ins.run(rnd(9), k, i.name, path.basename(i.name, path.extname(i.name)) || i.name, i.mime, i.size, i.mtime, Date.now()); }
      for (const r of db.prepare('SELECT id,filename FROM media WHERE kind=?').all(k)) if (!names.has(r.filename) && !busy.has(path.join(DIR[k], r.filename))) { db.prepare('DELETE FROM media WHERE id=?').run(r.id); fs.rmSync(thumbPath(r.id), { force: true }); spriteRm(r.id); }
    }
  });
  broadcast(); quickIndex(); queueMissing();
}
const scanSafe = f => { if (GD.on) { scanDrive(f).then(() => { GD.err = ''; }, e => { if (e.message !== GD.err) say('Drive scan LỖI:', e.message); GD.err = e.message; }); return; }
  // Chưa có khoá Drive → KHÔNG đọc thư mục máy; chỉ gỡ mọi mục cũ lấy từ máy khỏi web và báo lỗi
  try { for (const r of db.prepare('SELECT id FROM media WHERE gid IS NULL').all()) { db.prepare('DELETE FROM media WHERE id=?').run(r.id); fs.rmSync(thumbPath(r.id), { force: true }); spriteRm(r.id); } broadcast(); } catch (e) { say('scan:', e.message); } };
if (GD.on) say('Google Drive: BẬT — video/ảnh đọc từ Drive (' + (GD.creds.type === 'sa' ? 'service account ' + GD.creds.client_email : 'OAuth') + ')');
scanSafe(true); setInterval(() => { if (GD.on && gdStreams) return; scanSafe(false); }, GD.on ? GD_EVERY : 60000).unref(); // đang phát video → bỏ qua lượt quét định kỳ, nhường băng thông cho video
// // thư mục thay đổi → fs.watch báo ngay; quét định kỳ thưa (10s) chỉ để dự phòng
let scT2 = 0; const scanSoon = () => { clearTimeout(scT2); scT2 = setTimeout(() => scanSafe(false), 1500); };
setInterval(() => clients.forEach(r => r.write(': ping\n\n')), 25e3).unref();

// ---- gửi mail (SMTP tối giản, không cần nodemailer) ----
function sendMail(s, to, subject, text) {
  return new Promise((ok, no) => {
    let sock, buf = '', waiters = [], replies = [], done = false; const fail = e => { if (!done) { done = true; try { sock.destroy(); } catch {} no(e instanceof Error ? e : new Error(String(e))); } };
    const feed = d => { buf += d.toString('latin1'); let m; while ((m = /^(?:\d{3}-.*\r?\n)*\d{3} .*\r?\n/.exec(buf))) { const blk = m[0]; buf = buf.slice(blk.length); const w = waiters.shift(); if (w) w(blk); else replies.push(blk); } };
    const attach = so => { sock = so; so.on('data', feed); so.on('error', fail); so.on('close', () => fail(new Error('ECONNCLOSED'))); };
    const rd = () => new Promise(r => replies.length ? r(replies.shift()) : waiters.push(r));
    const cmd = async (l, exp) => { if (l !== null) sock.write(l + '\r\n'); const r = await rd(); if (!exp.includes(r.slice(0, 3))) throw Object.assign(new Error('SMTP ' + r.slice(0, 3)), { code: 'SMTP' + r.slice(0, 3) }); return r; };
    const clean = x => String(x || '').replace(/[\r\n<>"]/g, ''), b64 = x => Buffer.from(x).toString('base64');
    setTimeout(() => fail(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })), 12e3).unref();
    (async () => {
      const port = +s.port || 587, o = { host: s.host, port, servername: s.host };
      await new Promise((res, rej) => { const so = s.enc === 'ssl' ? tls.connect(o, res) : net.connect(o, res); so.once('error', rej); attach(so); });
      await cmd(null, ['220']); let r = await cmd('EHLO mediaplayer.local', ['250']);
      if (s.enc === 'starttls') { await cmd('STARTTLS', ['220']); sock.removeAllListeners(); buf = ''; await new Promise((res, rej) => { const t = tls.connect({ socket: sock, servername: s.host }, res); t.once('error', rej); attach(t); }); r = await cmd('EHLO mediaplayer.local', ['250']); }
      if (s.user) { const pass = s.passPlain != null ? s.passPlain : s.pass ? dec(s.pass) : ''; if (/AUTH[^\n]*PLAIN/i.test(r) || !/AUTH/i.test(r)) await cmd('AUTH PLAIN ' + b64('\0' + s.user + '\0' + pass), ['235']); else { await cmd('AUTH LOGIN', ['334']); await cmd(b64(s.user), ['334']); await cmd(b64(pass), ['235']); } }
      const from = clean(s.from); await cmd(`MAIL FROM:<${from}>`, ['250']); await cmd(`RCPT TO:<${clean(to)}>`, ['250', '251']); await cmd('DATA', ['354']);
      const body = b64(text).replace(/(.{76})/g, '$1\r\n');
      sock.write([`From: =?UTF-8?B?${b64(clean(s.fromName) || 'Media Player')}?= <${from}>`, `To: <${clean(to)}>`, `Subject: =?UTF-8?B?${b64(subject)}?=`, `Date: ${new Date().toUTCString()}`, `Message-ID: <${rnd(12)}@mediaplayer.local>`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '', body, '.', ''].join('\r\n'));
      await cmd(null, ['250']); try { sock.write('QUIT\r\n'); } catch {} done = true; sock.destroy(); ok();
    })().catch(fail);
  });
}

// ---- SMTP: chỉ Gmail (smtp.gmail.com, đăng nhập bằng Mật khẩu ứng dụng) ----
const isGmail = e => typeof e === 'string' && e.length <= 200 && /^[A-Za-z0-9._%+-]+@(gmail|googlemail)\.com$/i.test(e);
const smtpCfg = () => { const s = getSet('smtp') || {}, g = String(s.gmail || (isGmail(s.user) ? s.user : '')).trim(); return g ? { host: 'smtp.gmail.com', port: 465, enc: 'ssl', user: g, from: g, fromName: s.fromName || '', pass: s.pass || '' } : null; };
async function mailGmail(c, to, subject, text) { // thử SSL 465; nếu không kết nối được (mạng chặn cổng) → STARTTLS 587
  try { return await sendMail(c, to, subject, text); }
  catch (e) { if (/^SMTP\d{3}$/.test(e.code || '')) throw e; try { return await sendMail({ ...c, port: 587, enc: 'starttls' }, to, subject, text); } catch (e2) { throw /^SMTP\d{3}$/.test(e2.code || '') ? e2 : e; } }
}
function smtpErr(e) {
  const c = String(e.code || ''), m = String(e.message || '');
  if (c === 'SMTP535' || c === 'SMTP534' || c === 'SMTP530') return 'Gmail từ chối đăng nhập (' + c.slice(4) + '). Hãy bật Xác minh 2 bước cho tài khoản, tạo "Mật khẩu ứng dụng" 16 ký tự tại myaccount.google.com/apppasswords và dán vào đây (không dùng mật khẩu Gmail thường).';
  if (c === 'SMTP550' || c === 'SMTP553' || c === 'SMTP554') return 'Gmail từ chối gửi thư (' + c.slice(4) + '): ' + m;
  if (c === 'ETIMEDOUT' || m === 'timeout') return 'Hết thời gian chờ khi kết nối smtp.gmail.com — kiểm tra mạng/tường lửa (cổng 465 hoặc 587 bị chặn?).';
  if (c === 'ENOTFOUND' || c === 'EAI_AGAIN') return 'Không phân giải được smtp.gmail.com — máy chưa có Internet hoặc DNS lỗi.';
  if (c === 'ECONNREFUSED' || c === 'ECONNRESET' || c === 'ECONNCLOSED') return 'Không kết nối được smtp.gmail.com (' + (c || m) + ') — mạng/tường lửa có thể đang chặn cổng 465/587.';
  return 'Gửi thất bại: ' + (c || m || 'lỗi không xác định');
}

// ---- http helpers ----
const MIME_STATIC = { 'index.html': 'text/html; charset=utf-8', 'app.js': 'text/javascript; charset=utf-8', 'style.css': 'text/css; charset=utf-8', 'guard.js': 'text/javascript; charset=utf-8' }, staticCache = new Map();
const SORTS = { dur: 'dur DESC, size DESC, id', size: 'size DESC, dur DESC, id', new: 'added_at DESC, size DESC, id', name: 'title COLLATE NOCASE, id' };
const isLoop = a => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(a);
const clientIp = req => req.socket.remoteAddress;
const viaProxy = req => !!req.headers['x-forwarded-for'];
const isHttps = req => isLoop(req.socket.remoteAddress) && req.headers['x-forwarded-proto'] === 'https';
// ---- BLOCK_LOCALHOST (Setting\.env): on = chặn truy cập trực tiếp qua localhost/IP/cổng (chỉ cho vào qua Cloudflare Tunnel); off = cho truy cập (mặc định) ----
// Request qua tunnel luôn có header Cf-Ray / Cf-Connecting-Ip do Cloudflare thêm; request trực tiếp vào cổng thì không có. Đổi trong .env có hiệu lực sau ~1 giây, không cần khởi động lại.
let _bl = { t: 0, v: false };
function blockLocalOn() {
  const n = Date.now(); if (n - _bl.t < 1000) return _bl.v; _bl.t = n;
  try { const m = /^[ \t]*BLOCK_LOCALHOST[ \t]*=[ \t]*["']?([A-Za-z0-9]+)/mi.exec(fs.readFileSync(ENV_FILE, 'utf8')); _bl.v = !!m && /^(on|1|true|yes)$/i.test(m[1]); } catch { _bl.v = false; }
  return _bl.v;
}
const blockedLocal = req => blockLocalOn() && !(req.headers['cf-ray'] || req.headers['cf-connecting-ip']);
const denyLocal = res => { const b = Buffer.from('403 - Truy cập trực tiếp (localhost/IP) đang bị chặn. Hãy vào bằng tên miền.'); res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': b.length, 'Cache-Control': 'no-store' }); res.end(b); return Promise.resolve(); };

const send = (res, code, obj) => { const b = Buffer.from(JSON.stringify(obj)), ae = res.req && res.req.headers['accept-encoding'] || '';
  if (b.length > 1400 && /\bgzip\b/.test(ae)) return zlib.gzip(b, { level: 1 }, (e, z) => { if (res.destroyed) return; if (e) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': b.length, 'Cache-Control': 'no-store' }); return res.end(b); } res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding', 'Content-Length': z.length, 'Cache-Control': 'no-store' }); res.end(z); }); // JSON lớn (danh sách video) nén gzip → tải nhanh hơn rất nhiều qua tunnel
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': b.length, 'Cache-Control': 'no-store' }); res.end(b); };
const redirect = (res, to) => { res.writeHead(302, { Location: to, 'Cache-Control': 'no-store' }); res.end(); };
const addCookie = (res, c) => { const p = res.getHeader('Set-Cookie'); res.setHeader('Set-Cookie', p ? [].concat(p, c) : [c]); };
const parseCookies = h => { const o = Object.create(null); for (const p of String(h || '').split(';').slice(0, 30)) { const i = p.indexOf('='); if (i > 0) { let v = p.slice(i + 1).trim(); try { v = decodeURIComponent(v); } catch {} o[p.slice(0, i).trim()] = v; } } return o; };
const readBody = (req, max = 1e5) => new Promise((ok, no) => { let n = 0; const c = [], tm = setTimeout(() => { no(new Error('timeout')); req.destroy(); }, 15e3); req.on('data', d => { n += d.length; if (n > max) { clearTimeout(tm); no(new Error('too big')); req.destroy(); } else c.push(d); }); req.on('end', () => { clearTimeout(tm); ok(Buffer.concat(c)); }); req.on('error', e => { clearTimeout(tm); no(e); }); });
const readJson = async req => { try { return JSON.parse((await readBody(req)).toString() || '{}') || {}; } catch { return {}; } };
const buckets = new Map();
const limited = (req, name, max, ms = 15 * 60e3) => { const k = name + '|' + clientIp(req), now = Date.now(); let b = buckets.get(k); if (!b || b.until < now) b = { n: 0, until: now + ms }; b.n++; buckets.set(k, b); return b.n > max; };
setInterval(() => { const n = Date.now(); for (const [k, b] of buckets) if (b.until < n) buckets.delete(k); }, 6e4).unref();
const validPw = p => typeof p === 'string' && p.length >= 10 && p.length <= 200;
const validEmail = e => typeof e === 'string' && e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const validUser = u => typeof u === 'string' && /^[A-Za-z0-9_.-]{3,32}$/.test(u);
const sessionHours = () => Math.min(Math.max(+(getSet('sessionHours') || 12), 1), 720);
const fails = new Map(); setInterval(() => { const n = Date.now(); for (const [k, f] of fails) if (f.until < n) fails.delete(k); }, 6e4).unref();
function startSession(req, res, uid) {
  const tok = rnd(32), hrs = sessionHours();
  db.prepare('INSERT INTO sessions(user_id,token_hash,csrf,created_at,expires_at)VALUES(?,?,?,?,?)').run(uid, sha(tok), rnd(24), Date.now(), Date.now() + hrs * 3600e3);
  addCookie(res, `mp_sid=${tok}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${hrs * 3600}${isHttps(req) ? '; Secure' : ''}`); // Lax: cần để quay về từ Google
}
setInterval(() => { db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now()); db.prepare('DELETE FROM password_reset_tokens WHERE expires_at<?').run(Date.now()); }, 3600e3).unref();

// ---- gửi file có Range (video tua mượt qua mạng) ----
const CHUNK = 16 * 1024 * 1024;
function serveFile(req, res, fp, mime, o = {}) {
  let st; try { st = fs.statSync(fp); if (!st.isFile()) throw 0; } catch { res.writeHead(404, { 'Cache-Control': 'no-store' }); return res.end(); }
  const etag = `"${st.size}-${Math.floor(st.mtimeMs)}"`, rg = req.headers.range, ir = req.headers['if-range'];
  const h = { 'Content-Type': mime, 'Accept-Ranges': 'bytes', ETag: etag, 'Last-Modified': st.mtime.toUTCString(), 'Cache-Control': o.cache || 'public, max-age=600', 'Content-Disposition': o.dl ? "attachment; filename*=UTF-8''" + encodeURIComponent(o.dl) : 'inline' };
  if (!rg && req.headers['if-none-match'] === etag) { res.writeHead(304, h); return res.end(); }
  let start = 0, end = st.size - 1, code = 200; const m = /^bytes=(\d*)-(\d*)$/.exec(rg || '');
  if (m && (m[1] || m[2]) && (!ir || ir === etag)) {
    if (m[1] === '') start = Math.max(st.size - +m[2], 0);
    else { start = +m[1]; if (m[2] !== '') end = Math.min(+m[2], end); else if (o.chunk) end = Math.min(start + CHUNK - 1, end); }
    if (start > end || start >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
    code = 206; h['Content-Range'] = `bytes ${start}-${end}/${st.size}`;
  }
  h['Content-Length'] = end - start + 1; res.writeHead(code, h);
  if (req.method === 'HEAD') return res.end();
  const s = fs.createReadStream(fp, { start, end, highWaterMark: 1 << 20 }); s.on('error', () => res.destroy()); res.on('close', () => s.destroy()); s.pipe(res);
}
function slowSeek(r) { if (r.gid) return false; if (r.mime !== 'video/mp4' && r.mime !== 'video/quicktime') return false; try { const fp = path.join(VID, r.filename); return !fastOk(fp, fs.statSync(fp)); } catch { return false; } }
const fsCache = new Map();
function fastOk(fp, st) { // mp4: moov trước mdat => mở nhanh & tua nhanh qua mạng
  const k = fp + st.mtimeMs + st.size; if (fsCache.has(k)) return fsCache.get(k);
  let ok = true;
  try { const fd = fs.openSync(fp, 'r'), b = Buffer.alloc(16); let pos = 0;
    for (let i = 0; i < 64 && pos < st.size; i++) { fs.readSync(fd, b, 0, 16, pos); let sz = b.readUInt32BE(0); const t = b.toString('latin1', 4, 8);
      if (t === 'moov') break; if (t === 'mdat') { ok = false; break; } if (sz === 1) sz = Number(b.readBigUInt64BE(8)); if (sz < 8) break; pos += sz; }
    fs.closeSync(fd); } catch {}
  fsCache.set(k, ok); return ok;
}

// ---- Google Sign-In (OAuth 2.0, chỉ cho phép Gmail nằm trong danh sách) ----
const G_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth', G_TOKEN = process.env.MP_GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const LOGIN_ERR = ['', 'Chưa cấu hình đăng nhập Google', 'Quá nhiều lần thử', 'Phiên đăng nhập Google không hợp lệ, hãy thử lại', 'Google từ chối đăng nhập', 'Không lấy được thông tin từ Google (kiểm tra Client ID/Secret & Redirect URI)', 'Token Google không hợp lệ', 'Tài khoản Google không hợp lệ', 'Tài khoản Google này không có quyền Admin'];
const gCfg = () => { const g = getSet('google') || {}; return { clientId: g.clientId || '', secret: g.secret || '', allowed: g.allowed || '' }; };
const gOn = () => { const g = gCfg(); return !!(g.clientId && g.secret); };
const redirectUri = req => ((getSet('publicUrl') || URL_).replace(/\/+$/, '')) + '/api/google/callback';
const gAllowed = email => db.prepare('SELECT 1 FROM admin_users WHERE lower(email)=?').get(email) || gCfg().allowed.toLowerCase().split(/[\s,;]+/).filter(Boolean).includes(email);
async function googleCallback(req, res, q) {
  const fail = m => { addCookie(res, 'mp_gs=; Path=/; Max-Age=0'); redirect(res, '/?loginerr=' + (LOGIN_ERR.indexOf(m) > 0 ? LOGIN_ERR.indexOf(m) : 1)); }, g = gCfg();
  if (!gOn()) return fail('Chưa cấu hình đăng nhập Google');
  if (limited(req, 'google', 20)) return fail('Quá nhiều lần thử');
  const st = req.cookies.mp_gs; if (!safeEq(q.get('state') || '', st || '')) return fail('Phiên đăng nhập Google không hợp lệ, hãy thử lại');
  if (!q.get('code')) return fail('Google từ chối đăng nhập');
  let d; try { const r = await fetch(G_TOKEN, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(12000),
    body: new URLSearchParams({ code: q.get('code'), client_id: g.clientId, client_secret: dec(g.secret), redirect_uri: redirectUri(req), grant_type: 'authorization_code' }) }); d = await r.json(); if (!r.ok) d = null; } catch { d = null; }
  if (!d || !d.id_token) return fail('Không lấy được thông tin từ Google (kiểm tra Client ID/Secret & Redirect URI)');
  let p; try { p = JSON.parse(Buffer.from(d.id_token.split('.')[1], 'base64url').toString()); } catch { return fail('Token Google không hợp lệ'); } // token nhận trực tiếp từ Google qua TLS
  if (p.aud !== g.clientId || !['https://accounts.google.com', 'accounts.google.com'].includes(p.iss) || !(p.exp * 1000 > Date.now()) || p.email_verified !== true || !validEmail(p.email)) return fail('Tài khoản Google không hợp lệ');
  const email = p.email.toLowerCase(); if (!gAllowed(email)) { audit(null, 'google_denied', email); return fail(LOGIN_ERR[8]); }
  let u = db.prepare('SELECT id FROM admin_users WHERE lower(email)=?').get(email);
  if (!u) u = { id: Number(db.prepare("INSERT INTO admin_users(email,password_hash,created_at)VALUES(?,'!',?)").run(email, Date.now()).lastInsertRowid) };
  addCookie(res, 'mp_gs=; Path=/; Max-Age=0'); startSession(req, res, u.id); audit(email, 'login_google'); redirect(res, '/');
}

const LOGO_DIR = path.join(DATA, 'logo'), LOGO_MIME = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };
const logoExt = b => b.length < 12 ? '' : (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) ? 'png' : (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) ? 'jpg' : b.toString('latin1', 0, 4) === 'GIF8' ? 'gif' : (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') ? 'webp' : /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)?<svg[\s>]/i.test(b.toString('utf8', 0, 2048)) ? 'svg' : '';
const clearLogos = keep => { try { for (const f of fs.readdirSync(LOGO_DIR)) if (f !== keep) fs.rmSync(path.join(LOGO_DIR, f), { force: true }); } catch {} };
function mediaObj(r, admin) {
  let inf = null; try { inf = r.info ? JSON.parse(r.info) : null; } catch {}
  const o = { id: r.id, kind: r.kind, title: r.title, th: thumbTime(r.id), dur: r.dur || (inf && inf.dur) || 0, w: inf && inf.w || 0, h: inf && inf.h || 0, conv: converting.has(r.id) || convQueue.some(x => x.id === r.id), bad: !!r.bad, ready: !!inf, err: !!(inf && inf.err),
    web: r.kind === 'image' || /^video\/(mp4|webm|quicktime|ogg)$/.test(r.mime) };
  if (admin) Object.assign(o, { why: r.bad || '', size: r.size, mime: r.mime, added_at: r.added_at, format: path.extname(r.filename).slice(1).toUpperCase() || r.mime.split('/')[1].toUpperCase(), slow: r.kind === 'video' && slowSeek(r), info: inf });
  return o;
}

// ---- router ----
async function handle(req, res) {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; object-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()'); res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (isHttps(req)) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  let u; try { u = new URL(req.url, 'http://x'); decodeURIComponent(u.pathname); } catch { return send(res, 400, { error: 'bad request' }); }
  const p = u.pathname, q = u.searchParams, M = req.method; req.cookies = parseCookies(req.headers.cookie); req.admin = null;
  const t = req.cookies.mp_sid; if (typeof t === 'string' && t.length < 100) req.admin = db.prepare('SELECT s.id sid,s.csrf,u.id uid,u.email,u.username FROM sessions s JOIN admin_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(sha(t), Date.now()) || null;
  const needAdmin = () => { if (!req.admin) { send(res, 403, { error: 'forbidden' }); return false; } if (!['GET', 'HEAD'].includes(M) && !safeEq(req.headers['x-csrf-token'], req.admin.csrf)) { send(res, 403, { error: 'csrf' }); return false; } return true; };
  const rl = (n, max) => { if (limited(req, n, max)) { send(res, 429, { error: 'Quá nhiều yêu cầu, thử lại sau' }); return true; } return false; };
  let m;
  if (!['GET', 'HEAD'].includes(M)) { // chống CSRF / gọi chéo trang: Origin phải trùng Host
    const o = req.headers.origin; let okO = true; if (o) { try { okO = new URL(o).host === req.headers.host; } catch { okO = false; } } else { const sf = req.headers['sec-fetch-site']; okO = !sf || sf === 'same-origin' || sf === 'none'; }
    if (!okO) return send(res, 403, { error: 'forbidden' });
  }
  if (p.startsWith('/api/') && p !== '/api/events' && limited(req, 'api', 1500, 60e3)) return send(res, 429, { error: 'Quá nhiều yêu cầu, thử lại sau' });

  if (M === 'GET' && p === '/logo') { // logo hiện tại (công khai)
    const l = getSet('logo'), fp = l && path.join(LOGO_DIR, path.basename(l.file));
    if (!fp || !fs.existsSync(fp)) { res.writeHead(404, { 'Cache-Control': 'no-store' }); return res.end(); }
    res.writeHead(200, { 'Content-Type': LOGO_MIME[path.extname(fp).slice(1)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" }); return res.end(fs.readFileSync(fp));
  }
  // trang & tài nguyên tĩnh
  if ((M === 'GET' || M === 'HEAD') && (p === '/' || (m = /^\/static\/(app\.js|style\.css|guard\.js)$/.exec(p)))) {
    const name = m ? m[1] : 'index.html'; let a = staticCache.get(name); if (!a) staticCache.set(name, a = { buf: asset(name), type: MIME_STATIC[name] }), a.etag = '"' + sha(a.buf.toString('latin1')).slice(0, 20) + '"', a.br = zlib.brotliCompressSync(a.buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } }), a.gz = zlib.gzipSync(a.buf, { level: 9 });
    if (req.headers['if-none-match'] === a.etag) { res.writeHead(304); return res.end(); }
    const ae = req.headers['accept-encoding'] || '', enc = /\bbr\b/.test(ae) ? 'br' : /\bgzip\b/.test(ae) ? 'gzip' : '', body = enc === 'br' ? a.br : enc ? a.gz : a.buf; // nén sẵn 1 lần (brotli/gzip) → app.js 67KB còn ~15KB
    res.writeHead(200, { 'Content-Type': a.type, 'Content-Length': body.length, ETag: a.etag, 'Cache-Control': 'no-cache', Vary: 'Accept-Encoding', ...(enc ? { 'Content-Encoding': enc } : {}) }); return res.end(M === 'HEAD' ? undefined : body);
  }
  if (M === 'GET' && (p === '/admin' || p.startsWith('/admin/'))) return redirect(res, '/?login=1');

  // auth
  if (M === 'GET' && p === '/api/status') return send(res, 200, { setup: !hasAdmin(), google: gOn(), logo: (getSet('logo') || {}).v || 0 });
  if (M === 'GET' && p === '/api/me') return send(res, 200, req.admin ? { admin: true, email: req.admin.email, name: req.admin.username || req.admin.email, csrf: req.admin.csrf, ff: FF.ok } : { admin: false });
  if (M === 'POST' && p === '/api/setup') {
    if (rl('setup', 10)) return; const b = await readJson(req);
    if (hasAdmin()) return send(res, 403, { error: 'Đã có tài khoản Admin' }); // chưa có Admin → cho setup từ mọi nơi (localhost lẫn tên miền Cloudflare Tunnel)
    const username = String(b.username || 'admin').trim(), email = String(b.email || '').trim().toLowerCase();
    if (!validUser(username) || !validEmail(email) || !validPw(b.password)) return send(res, 400, { error: 'Tên đăng nhập 3-32 ký tự (chữ/số/._-), email hợp lệ, mật khẩu ≥ 10 ký tự' });
    const hash = await hashPw(b.password); let id;
    tx(() => { db.prepare("DELETE FROM admin_users WHERE password_hash NOT LIKE 'scrypt$%' AND password_hash<>'!'").run(); db.prepare("DELETE FROM admin_users WHERE lower(email)=? OR lower(username)=?").run(email, username.toLowerCase());
      id = Number(db.prepare('INSERT INTO admin_users(email,username,password_hash,created_at)VALUES(?,?,?,?)').run(email, username, hash, Date.now()).lastInsertRowid); });
    audit(username, 'setup'); startSession(req, res, id); return send(res, 200, { ok: true });
  }
  if (M === 'POST' && p === '/api/login') {
    if (rl('login', 12)) return; const b = await readJson(req), key = String(b.login || b.email || '').trim().toLowerCase().slice(0, 200), fk = clientIp(req) + '|' + key, gk = '*|' + key;
    const f = fails.get(fk), gf = fails.get(gk); if ((f && f.n >= 5 && f.until > Date.now()) || (gf && gf.n >= 60 && gf.until > Date.now())) return send(res, 429, { error: 'Đăng nhập sai quá nhiều lần, thử lại sau 15 phút' });
    const usr = key ? db.prepare('SELECT * FROM admin_users WHERE lower(username)=? OR lower(email)=?').get(key, key) : null;
    const ok = await verifyPw(String(b.password || '').slice(0, 200), usr ? usr.password_hash : DUMMY);
    if (!usr || !ok) { for (const k of [fk, gk]) { const o = fails.get(k), n = (o && o.until > Date.now() ? o.n : 0) + 1; if (fails.size < 5000 || fails.has(k)) fails.set(k, { n, until: Date.now() + 15 * 60e3 }); } audit(null, 'login_fail', key.slice(0, 64) + ' @' + clientIp(req)); return send(res, 401, { error: 'Sai tên đăng nhập/email hoặc mật khẩu' }); }
    fails.delete(fk); startSession(req, res, usr.id); audit(usr.email, 'login'); return send(res, 200, { ok: true });
  }
  if (M === 'GET' && p === '/api/google/start') {
    if (!gOn()) return redirect(res, '/?loginerr=1');
    const st = rnd(24); addCookie(res, `mp_gs=${st}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${isHttps(req) ? '; Secure' : ''}`);
    return redirect(res, G_AUTH + '?' + new URLSearchParams({ client_id: gCfg().clientId, redirect_uri: redirectUri(req), response_type: 'code', scope: 'openid email', state: st, prompt: 'select_account' }));
  }
  if (M === 'GET' && p === '/api/google/callback') return googleCallback(req, res, q);
  if (M === 'POST' && p === '/api/logout') { if (!needAdmin()) return; db.prepare('DELETE FROM sessions WHERE id=?').run(req.admin.sid); addCookie(res, 'mp_sid=; Path=/; Max-Age=0'); return send(res, 200, { ok: true }); }
  if (M === 'POST' && p === '/api/forgot') {
    if (rl('forgot', 5)) return; const b = await readJson(req), email = String(b.email || '').toLowerCase(), generic = { ok: true, message: 'Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi.' };
    const us = validEmail(email) ? db.prepare('SELECT * FROM admin_users WHERE lower(email)=?').get(email) : null;
    if (us) {
      const tok = rnd(32); db.prepare('DELETE FROM password_reset_tokens WHERE user_id=?').run(us.id);
      db.prepare('INSERT INTO password_reset_tokens(user_id,token_hash,expires_at)VALUES(?,?,?)').run(us.id, sha(tok), Date.now() + 30 * 60e3);
      const s = smtpCfg(), base = (getSet('publicUrl') || URL_).replace(/\/+$/, '');
      if (s && s.pass) mailGmail(s, us.email, 'Đặt lại mật khẩu Admin', `Mở liên kết sau trong 30 phút để đặt mật khẩu mới:\n${base}/?reset=${tok}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`).catch(e => say('smtp:', e.code || e.message));
      audit(us.email, 'reset_requested');
    }
    return send(res, 200, generic);
  }
  if (M === 'POST' && p === '/api/reset') {
    if (rl('reset', 10)) return; const b = await readJson(req);
    if (typeof b.token !== 'string' || !validPw(b.password)) return send(res, 400, { error: 'Dữ liệu không hợp lệ' });
    const r = db.prepare('SELECT * FROM password_reset_tokens WHERE token_hash=? AND used=0 AND expires_at>?').get(sha(b.token), Date.now());
    if (!r) return send(res, 400, { error: 'Liên kết không hợp lệ hoặc đã hết hạn' });
    const hash = await hashPw(b.password);
    tx(() => { db.prepare('UPDATE admin_users SET password_hash=? WHERE id=?').run(hash, r.user_id); db.prepare('UPDATE password_reset_tokens SET used=1 WHERE id=?').run(r.id); db.prepare('DELETE FROM sessions WHERE user_id=?').run(r.user_id); });
    audit(null, 'password_reset', String(r.user_id)); return send(res, 200, { ok: true });
  }

  // media công khai: nặng nhất lên đầu
  if (M === 'GET' && p === '/api/media') {
    const kind = q.get('kind') === 'image' ? 'image' : 'video', limit = Math.min(Math.max(parseInt(q.get('limit')) || 24, 1), 500);
    const offset = q.has('offset') ? Math.max(parseInt(q.get('offset')) || 0, 0) : (Math.max(parseInt(q.get('page')) || 1, 1) - 1) * limit;
    const order = (req.admin ? '(CASE WHEN bad IS NULL THEN 1 ELSE 0 END), ' : '') + SORTS[Object.hasOwn(SORTS, q.get('sort')) ? q.get('sort') : 'dur'];
    const kw = String(q.get('q') || '').trim().slice(0, 100), like = '%' + kw.replace(/[!%_]/g, x => '!' + x) + '%';
    const total = kw ? db.prepare("SELECT COUNT(*) c FROM media WHERE kind=? AND title LIKE ? ESCAPE '!'").get(kind, like).c : db.prepare('SELECT COUNT(*) c FROM media WHERE kind=?').get(kind).c;
    const rows = kw ? db.prepare(`SELECT * FROM media WHERE kind=? AND title LIKE ? ESCAPE '!' ORDER BY ${order} LIMIT ? OFFSET ?`).all(kind, like, limit, offset) : db.prepare(`SELECT * FROM media WHERE kind=? ORDER BY ${order} LIMIT ? OFFSET ?`).all(kind, limit, offset);
    if (GD.on) for (let i = rows.length - 1; i >= 0; i--) { const x = rows[i]; if (x.gid && !thumbTime(x.id) && !thumbFail.has(x.id)) ensureThumb(x); } // đảo ngược: hàng đầu trang được làm trước
    const counts = Object.fromEntries(db.prepare('SELECT kind,COUNT(*) c,COALESCE(SUM(size),0) s FROM media GROUP BY kind').all().map(x => [x.kind, req.admin ? { n: x.c, size: x.s } : { n: x.c }]));
    return send(res, 200, { total, drive: GD.on, driveErr: GD.cfgErr || GD.err || '', counts, ff: { ok: FF.ok, dl: DL.pct, failed: !!DL.failed }, items: rows.map(r => mediaObj(r, !!req.admin)) });
  }
  if (M === 'POST' && p === '/api/report') { // trình duyệt báo video không phát được (kèm nguyên nhân thật) / báo đã phát được
    if (limited(req, 'report', 60)) return send(res, 200, { ok: true }); const b = await readJson(req);
    const r = typeof b.id === 'string' ? db.prepare('SELECT * FROM media WHERE id=?').get(b.id.slice(0, 32)) : null; if (!r || r.kind !== 'video') return send(res, 200, { ok: true });
    if (!req.admin) { const c = +b.code; if (!b.ok && (c === 3 || c === 4)) errlog('visitor', r.title, r.id, 'Khách báo không phát được (mã ' + c + ')', { ua: String(b.ua || '').slice(0, 160), cp: b.cp && typeof b.cp === 'object' ? JSON.stringify(b.cp).slice(0, 300) : '' }); return send(res, 200, { ok: true }); } // chỉ Admin mới đổi được trạng thái video (chống khách giả báo lỗi hàng loạt)
    if (b.ok) { if (r.bad) { db.prepare('UPDATE media SET bad=NULL,bad_src=NULL WHERE id=?').run(r.id); broadcast(); } return send(res, 200, { ok: true }); }
    const code = +b.code; if (code !== 3 && code !== 4) return send(res, 200, { ok: true });
    const why = (code === 4 ? 'Trình duyệt không hỗ trợ codec/định dạng (MEDIA_ERR_SRC_NOT_SUPPORTED)' : 'Lỗi giải mã khi phát (MEDIA_ERR_DECODE) — file hỏng hoặc codec lỗi') + (b.msg ? ': ' + String(b.msg).slice(0, 200) : '');
    if (!r.bad) { db.prepare("UPDATE media SET bad=?,bad_src='client' WHERE id=?").run(why, r.id); broadcast(); }
    errlog('browser', r.title, r.id, why, { ua: String(b.ua || '').slice(0, 160), canPlay: b.cp, size: r.size, mime: r.mime, file: r.filename });
    if (FF.ok) diagnose(r).catch(() => {}); return send(res, 200, { ok: true });
  }
  if (M === 'GET' && (m = /^\/api\/media\/([\w-]{1,32})$/.exec(p))) { const r = db.prepare('SELECT * FROM media WHERE id=?').get(m[1]); return r ? send(res, 200, { item: mediaObj(r, !!req.admin) }) : send(res, 404, { error: 'not found' }); }
  if (M === 'GET' && p === '/api/events') { const ip = clientIp(req), n = sseIp.get(ip) || 0; if (clients.size >= 300 || n >= 6) return send(res, 429, { error: 'Quá nhiều kết nối' }); sseIp.set(ip, n + 1);
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }); res.write(': hi\n\n'); clients.add(res); req.on('close', () => { clients.delete(res); const k = (sseIp.get(ip) || 1) - 1; k > 0 ? sseIp.set(ip, k) : sseIp.delete(ip); }); return; }
  if (M === 'GET' && (m = /^\/api\/sprite\/([\w-]{1,32})$/.exec(p))) { // trạng thái ảnh ghép xem trước; chưa có thì bắt đầu tạo
    const sm = spriteMeta(m[1]); if (sm) return send(res, 200, { ready: true, ...sm, v: Math.floor(fs.statSync(spritePath(m[1])).mtimeMs) });
    const rr = db.prepare('SELECT * FROM media WHERE id=?').get(m[1]); if (!rr || rr.kind !== 'video') return send(res, 404, { error: 'not found' });
    const ft = spriteFail.get(m[1]); if (ft && Date.now() - ft < 120e3) return send(res, 200, { ready: false, failed: true });
    if (!FF.ok) return send(res, 200, { ready: false, failed: true }); ensureSprite(rr); return send(res, 200, { ready: false });
  }
  if ((M === 'GET' || M === 'HEAD') && (m = /^\/sprite\/([\w-]{1,32})$/.exec(p))) { if (!spriteMeta(m[1])) { res.writeHead(404, { 'Cache-Control': 'no-store' }); return res.end(); } res.setHeader('Cross-Origin-Resource-Policy', 'same-origin'); return serveFile(req, res, spritePath(m[1]), 'image/jpeg', { cache: 'public, max-age=86400' }); }
  if ((M === 'GET' || M === 'HEAD') && (m = /^\/thumb\/([\w-]{1,32})$/.exec(p))) { if (!thumbTime(m[1]) && !thumbFail.has(m[1])) { const rr = db.prepare('SELECT id,kind,gid,dur,size FROM media WHERE id=?').get(m[1]); if (rr && rr.gid) await Promise.race([ensureThumb(rr), sleep(10000)]); } if (!thumbTime(m[1])) { res.writeHead(404, { 'Cache-Control': 'no-store' }); return res.end(); } res.setHeader('Cross-Origin-Resource-Policy', 'same-origin'); return serveFile(req, res, thumbPath(m[1]), 'image/jpeg', { cache: 'public, max-age=86400' }); }
  if ((M === 'GET' || M === 'HEAD') && (m = /^\/media\/([\w-]{1,32})$/.exec(p))) {
    const r = db.prepare('SELECT * FROM media WHERE id=?').get(m[1]); if (!r || path.basename(r.filename) !== r.filename) { res.writeHead(404, { 'Cache-Control': 'no-store' }); return res.end(); }
    const dest = req.headers['sec-fetch-dest']; const sfs = req.headers['sec-fetch-site']; if (!req.admin && (['document', 'iframe', 'embed', 'object', 'frame'].includes(dest) || (sfs && sfs !== 'same-origin'))) { res.writeHead(403, { 'Cache-Control': 'no-store' }); return res.end(); } // mở/tải trực tiếp bằng thanh địa chỉ bị chặn; chỉ phát trong trình phát của web
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin'); if (r.kind === 'video') lastStream = Date.now();
    let dl = ''; if (req.admin && q.get('dl') === '1') { const ex = path.extname(r.filename) || ({ 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' })[r.mime] || ''; dl = (String(r.title || 'video').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 150) || 'video') + (/\.[A-Za-z0-9]{1,5}$/.test(r.title || '') ? '' : ex); audit(req.admin.email, 'download', `${r.kind}:${r.id}`); } // admin tải về: gửi kèm tên gốc, tải trọn file
    if (r.gid) return serveDrive(req, res, r, dl ? { dl } : { chunk: r.kind === 'video' });
    return serveFile(req, res, path.join(DIR[r.kind], r.filename), r.mime, dl ? { dl } : { chunk: r.kind === 'video' });
  }

  // admin API (cần session; thao tác ghi cần CSRF token)
  if (p.startsWith('/api/admin/')) {
    if (!needAdmin()) return;
    if (M === 'PUT' && p === '/api/admin/logo') { // đổi logo: ghi logo mới rồi TỰ XOÁ logo cũ
      const chunks = []; let n = 0; for await (const c of req) { n += c.length; if (n > 2 * 1024 * 1024) return send(res, 413, { error: 'Logo tối đa 2MB' }); chunks.push(c); }
      const buf = Buffer.concat(chunks), ext = logoExt(buf); if (!ext) return send(res, 400, { error: 'Chỉ nhận PNG, JPG, WEBP, GIF hoặc SVG' });
      fs.mkdirSync(LOGO_DIR, { recursive: true }); const file = 'logo-' + rnd(6).replace(/\W/g, 'x') + '.' + ext; fs.writeFileSync(path.join(LOGO_DIR, file), buf);
      setSet('logo', { file, v: Date.now() }); clearLogos(file); audit(req.admin.email, 'logo', file); return send(res, 200, { ok: true, v: getSet('logo').v });
    }
    if (M === 'DELETE' && p === '/api/admin/logo') { clearLogos(''); db.prepare("DELETE FROM settings WHERE k='logo'").run(); audit(req.admin.email, 'logo-reset', ''); return send(res, 200, { ok: true }); }
    if (M === 'PUT' && p === '/api/admin/upload') { // body = file thô (không multipart) → ghi thẳng ra đĩa, nhận cả file rất lớn
      const len = +req.headers['content-length'] || 0; if (len > MAX_UPLOAD) return send(res, 413, { error: 'File quá lớn' });
      const orig = cleanName(q.get('name') || 'file'), tmp = path.join(TMP, rnd(16).replace(/\W/g, 'x')); let n = 0;
      const cap = new (require('stream').Transform)({ transform(c, e, cb) { n += c.length; cb(n > MAX_UPLOAD ? new Error('too large') : null, c); } });
      try { await new Promise((ok, no) => pipeline(req, cap, fs.createWriteStream(tmp), e => e ? no(e) : ok())); } catch { fs.rmSync(tmp, { force: true }); return send(res, 400, { error: 'Upload lỗi' }); }
      const st = fs.statSync(tmp), c = st.size ? classify(tmp, st, path.extname(orig)) : null; clsCache.delete(tmp);
      if (!c) { fs.rmSync(tmp, { force: true }); return send(res, 400, { error: 'Không phải video/ảnh hợp lệ' }); }
      if (!GD.on) { fs.rmSync(tmp, { force: true }); return send(res, 400, { error: 'Chưa kết nối Google Drive nên không tải lên được: ' + GD.cfgErr }); }
      if (GD.on) { // lên Drive với tên NGẪU NHIÊN; tên gốc lưu làm tiêu đề (mô tả file)
        const folder = c.kind === 'video' ? GD.vid : GD.img; let name = '';
        try {
          if (!folder) { try { await gdResolve(); } catch {} } const fid = c.kind === 'video' ? GD.vid : GD.img; if (!fid) throw new Error('chưa xác định được thư mục ' + (c.kind === 'video' ? 'Video' : 'img') + ' trên Drive');
          const oe = path.extname(orig).toLowerCase(); name = crypto.randomBytes(16).toString('hex') + (/^\.[a-z0-9]{1,6}$/.test(oe) ? oe : GD_EXT[c.mime] || '');
          await gdUpload(tmp, st.size, name, c.mime, path.basename(orig, path.extname(orig)) || orig, fid);
        } catch (e) { fs.rmSync(tmp, { force: true }); say('Drive upload:', e.message); return send(res, 500, { error: 'Tải lên Drive thất bại: ' + e.message }); }
        fs.rmSync(tmp, { force: true }); audit(req.admin.email, 'upload', `${c.kind}:drive:${name}`); scanSafe(true); return send(res, 200, { ok: true, kind: c.kind, name });
      }
      const name = uniqueName(DIR[c.kind], orig); fs.renameSync(tmp, path.join(DIR[c.kind], name));
      audit(req.admin.email, 'upload', `${c.kind}:${name}`); scanSafe(true); return send(res, 200, { ok: true, kind: c.kind, name });
    }
    if (M === 'DELETE' && (m = /^\/api\/admin\/media\/([\w-]{1,32})$/.exec(p))) {
      const r = db.prepare('SELECT * FROM media WHERE id=?').get(m[1]); if (!r || path.basename(r.filename) !== r.filename) return send(res, 404, { error: 'not found' });
      const fp = path.join(DIR[r.kind], r.filename);
      if (r.gid) { // Drive: chuyển vào Thùng rác của Drive (khôi phục được trong 30 ngày)
        for (const a of [queue, convQueue]) for (let i = a.length - 1; i >= 0; i--) if (a[i].id === r.id) a.splice(i, 1);
        try { await gdTrash(r.gid); } catch (e) { if (e.status !== 404) return send(res, 500, { error: 'Không xoá được trên Drive: ' + e.message + (e.status === 403 ? ' (tài khoản kết nối chỉ có quyền xem — cần quyền Biên tập viên)' : '') }); }
        db.prepare('DELETE FROM media WHERE id=?').run(r.id); fs.rmSync(thumbPath(r.id), { force: true }); spriteRm(r.id); thumbFail.delete(r.id);
        audit(req.admin.email, 'delete', `${r.kind}:drive:${r.gid}`); scanSafe(true); return send(res, 200, { ok: true });
      }
      for (const a of [queue, convQueue]) for (let i = a.length - 1; i >= 0; i--) if (a[i].id === r.id) a.splice(i, 1); // bỏ khỏi hàng chờ xử lý
      for (const [c, pid] of procs) if (pid === r.id) try { c.kill(); } catch {} // dừng ffmpeg đang đụng vào file này để Windows cho xoá
      let ok = false;
      for (let i = 0; i < 10 && !ok; i++) { try { fs.unlinkSync(fp); ok = true; } catch (e) { if (e.code === 'ENOENT') ok = true; else if (['EBUSY', 'EPERM', 'EACCES'].includes(e.code)) await sleep(300); else return send(res, 500, { error: 'Không xoá được file: ' + e.code }); } }
      if (!ok) return send(res, 500, { error: 'Không xoá được file (đang bị chương trình khác giữ). Thử lại sau vài giây.' });
      db.prepare('DELETE FROM media WHERE id=?').run(r.id); fs.rmSync(thumbPath(r.id), { force: true }); spriteRm(r.id); rmOrig(r.id); clsCache.delete(fp); thumbFail.delete(r.id);
      audit(req.admin.email, 'delete', `${r.kind}:${r.filename}`); scanSafe(true); return send(res, 200, { ok: true });
    }
    if (M === 'POST' && (m = /^\/api\/admin\/repair\/([\w-]{1,32})$/.exec(p))) { if (!GD.on) return send(res, 400, { error: 'Chỉ dùng cho chế độ Google Drive — chế độ máy hãy dùng \"Chuyển đổi\"' }); if (!FF.ok) return send(res, 400, { error: 'Chưa có ffmpeg' }); const r = db.prepare('SELECT id,kind,gid FROM media WHERE id=?').get(m[1]); if (!r || r.kind !== 'video' || !r.gid) return send(res, 404, { error: 'not found' });
      const ok = enqueueRepair(r.id); audit(req.admin.email, 'repair', 'video:drive:' + r.gid); return send(res, 200, { ok: true, started: ok }); }
    if (M === 'POST' && (m = /^\/api\/admin\/convert\/([\w-]{1,32})$/.exec(p))) { if (GD.on) return send(res, 400, { error: 'Chế độ Google Drive không chuyển đổi tại máy — hãy chuyển video sang MP4 (H.264 + AAC) rồi tải lại lên Drive' }); if (!FF.ok) return send(res, 400, { error: 'Chưa có ffmpeg' }); const r = db.prepare('SELECT id,kind FROM media WHERE id=?').get(m[1]); if (!r || r.kind !== 'video') return send(res, 404, { error: 'not found' });
      if (!convQueue.some(x => x.id === r.id) && !converting.has(r.id)) convQueue.push({ id: r.id, conv: true }); thumbFail.delete(r.id); broadcast(); pump(); return send(res, 200, { ok: true }); }
    if (M === 'POST' && p === '/api/admin/convert-bad') { if (GD.on) return send(res, 400, { error: 'Chế độ Google Drive không chuyển đổi tại máy — hãy chuyển video sang MP4 (H.264 + AAC) rồi tải lại lên Drive' }); if (!FF.ok) return send(res, 400, { error: 'Chưa có ffmpeg' }); let n = 0; for (const r of db.prepare("SELECT id FROM media WHERE kind='video' AND bad IS NOT NULL").all()) if (!convQueue.some(x => x.id === r.id) && !converting.has(r.id)) { convQueue.push({ id: r.id, conv: true }); n++; } broadcast(); pump(); return send(res, 200, { ok: true, n }); }
    if (M === 'POST' && p === '/api/admin/rescan') { scanSafe(true); return send(res, 200, { ok: true }); }
    if (M === 'POST' && p === '/api/admin/reprocess') { db.prepare('UPDATE media SET q=0,info=NULL,bad=NULL,bad_src=NULL').run(); thumbFail.clear(); if (!FF.ok) ensureFfmpeg(); quickIndex(); queueMissing(); if (GD.on) scanSafe(true); return send(res, 200, { ok: true }); }
    if (M === 'POST' && p === '/api/admin/sessions/revoke-others') { db.prepare('DELETE FROM sessions WHERE user_id=? AND id<>?').run(req.admin.uid, req.admin.sid); return send(res, 200, { ok: true }); }
    if (M === 'GET' && p === '/api/admin/settings') {
      const s = smtpCfg(), g = gCfg(), t = getSet('smtpTest');
      return send(res, 200, { smtp: { gmail: s ? s.user : '', fromName: s ? s.fromName : '', hasPassword: !!(s && s.pass), test: t && s && t.gmail === s.user ? { ok: !!t.ok, at: t.at, msg: t.msg || '' } : null }, publicUrl: getSet('publicUrl') || '', sessionHours: sessionHours(),
        google: { clientId: g.clientId, hasSecret: !!g.secret, allowed: g.allowed, redirect: redirectUri(req) } });
    }
    if (M === 'PUT' && p === '/api/admin/settings') {
      const b = await readJson(req), smtp = b.smtp || {}, old = smtpCfg() || {}, og = gCfg(), g = b.google || {}, str = (v, n) => String(v ?? '').slice(0, n);
      const gmail = str(smtp.gmail, 200).trim().toLowerCase(), pw = str(smtp.password, 100).replace(/\s+/g, '');
      if (gmail && !isGmail(gmail)) return send(res, 400, { error: 'Chỉ nhận địa chỉ Gmail (…@gmail.com)' });
      if (pw && !/^[a-z]{16}$/i.test(pw)) return send(res, 400, { error: 'Mật khẩu ứng dụng Gmail gồm đúng 16 chữ cái (dán nguyên, có hay không có dấu cách đều được)' });
      const changed = gmail !== (old.user || '') || !!pw; if (gmail && !pw && !old.pass) return send(res, 400, { error: 'Hãy nhập Mật khẩu ứng dụng Gmail' });
      setSet('smtp', gmail ? { gmail, fromName: str(smtp.fromName, 100).replace(/[\r\n<>"]/g, ''), pass: pw ? enc(pw) : old.pass || '' } : {}); if (changed) db.prepare("DELETE FROM settings WHERE k='smtpTest'").run();
      setSet('google', { clientId: str(g.clientId, 300).trim(), secret: g.secret ? enc(str(g.secret, 300)) : og.secret, allowed: str(g.allowed, 2000) });
      setSet('publicUrl', /^https?:\/\/[^\s]+$/.test(b.publicUrl) ? b.publicUrl.slice(0, 300) : ''); setSet('sessionHours', Math.min(Math.max(+b.sessionHours || 12, 1), 720)); audit(req.admin.email, 'settings'); return send(res, 200, { ok: true });
    }
    if (M === 'POST' && p === '/api/admin/settings/test') { // thử bằng đúng giá trị đang nhập trong form (chưa cần bấm Lưu); trống mật khẩu = dùng mật khẩu đã lưu
      if (rl('smtptest', 10)) return; const b = await readJson(req), saved = smtpCfg(), gmail = String(b.gmail || (saved && saved.user) || '').trim().toLowerCase(), pw = String(b.password || '').replace(/\s+/g, '');
      if (!isGmail(gmail)) return send(res, 400, { error: 'Nhập địa chỉ Gmail hợp lệ (…@gmail.com)' });
      if (pw && !/^[a-z]{16}$/i.test(pw)) return send(res, 400, { error: 'Mật khẩu ứng dụng Gmail gồm đúng 16 chữ cái' });
      const usePw = pw || (saved && saved.user === gmail ? saved.pass : ''); if (!usePw) return send(res, 400, { error: 'Chưa có Mật khẩu ứng dụng Gmail' });
      const c = { host: 'smtp.gmail.com', port: 465, enc: 'ssl', user: gmail, from: gmail, fromName: String(b.fromName || '').slice(0, 100).replace(/[\r\n<>"]/g, ''), ...(pw ? { passPlain: pw } : { pass: usePw }) };
      try { await mailGmail(c, gmail, 'Test SMTP — Media Player', 'SMTP Gmail hoạt động. Thư này do nút "Test SMTP" gửi tới chính bạn.'); setSet('smtpTest', { gmail, ok: true, at: Date.now() }); audit(req.admin.email, 'smtp_test', 'ok'); return send(res, 200, { ok: true, message: 'Gửi thành công tới ' + gmail + ' — SMTP đã hoạt động. Hãy kiểm tra hộp thư (cả Spam).' }); }
      catch (e) { const msg = smtpErr(e); setSet('smtpTest', { gmail, ok: false, at: Date.now(), msg }); audit(req.admin.email, 'smtp_test', 'fail ' + (e.code || '')); return send(res, 400, { error: msg }); }
    }
  }
  send(res, 404, { error: 'not found' });
}

// ---- server lifecycle ----
let srv = null;
const READY_FILE = path.join(DATA, '.ready');
try { fs.rmSync(READY_FILE, { force: true }); } catch {} // xoá marker cũ lúc khởi động — tránh launcher tưởng nhầm server cũ vẫn còn sống
const startHttp = () => new Promise(ok => {
  if (srv) return ok(true);
  const s = http.createServer((req, res) => (blockedLocal(req) ? denyLocal(res) : handle(req, res)).catch(e => { say('err', req.method, req.url, e.message); if (!res.headersSent) send(res, 500, { error: 'Lỗi máy chủ' }); else res.destroy(); }));
  s.keepAliveTimeout = 65e3; s.headersTimeout = 66e3; s.requestTimeout = 0; // giữ kết nối cho tua liên tục; không cắt upload file lớn
  s.once('error', e => { say('listen:', e.code); ok(e.code); });
  s.listen(PORT, HOST, () => { srv = s; try { fs.writeFileSync(READY_FILE, String(PORT)); } catch {} ok(true); });
});
const stopHttp = () => { if (srv) { srv.close(); srv.closeAllConnections && srv.closeAllConnections(); clients.clear(); srv = null; } };

// ---- Windows: khay hệ thống ----
const openP = t => {
  if (!WIN) return;
  try { spawn('cmd.exe', ['/d', '/c', 'start', '', String(t)], { windowsHide: true, detached: true, stdio: 'ignore' }).unref(); }
  catch (e) { say('Khong mo duoc trinh duyet:', e.message); }
};
let tp = null, autoState = false;
let cfState = 'Unknown', notice = '', noticeId = 0;
const notify = m => { notice = String(m); noticeId++; say(m); try { push(); } catch {} };
let envPortBusy = false, envPortWatcher = null;
const STATE_FILE = path.join(DATA, 'tray', 'state.json');
const push = () => {
  if (!tp) return;
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify({ status: srv ? 'Running' : 'Stopped', auto: autoState, cf: cfState, notice, noticeId }));
  } catch {}
};

const readEnvPort = () => {
  try {
    const txt = fs.readFileSync(ENV_FILE, 'utf8');
    const m = txt.match(/^(?:\s*export\s+)?PORT\s*=\s*([^#;\r\n]+)/mi);
    const n = Number.parseInt(String(m ? m[1] : '').trim().replace(/^["']|["']$/g, ''), 10);
    return Number.isInteger(n) && n >= 1 && n <= 65535 ? n : null;
  } catch { return null; }
};
const applyConfiguredPort = async source => {
  if (envPortBusy) return;
  const next = readEnvPort();
  if (next === null || next === PORT) return;
  envPortBusy = true; const old = PORT;
  try {
    PORT = next; process.env.PORT = String(next); URL_ = `http://${HOST}:${PORT}`;
    say(`Phat hien PORT trong Setting\\.env thay doi: ${old} -> ${PORT}${source ? ' (' + source + ')' : ''}.`);
    stopHttp();
    const httpResult = await startHttp();
    if (httpResult !== true) say('Khong mo duoc web o cong moi ' + PORT + ':', httpResult);
    push();
  } catch (e) {
    PORT = old; process.env.PORT = String(old); URL_ = `http://${HOST}:${PORT}`;
    say('Loi ap dung PORT moi:', e && e.stack || e);
  } finally { envPortBusy = false; }
};
const startEnvPortWatcher = () => {
  try { envPortWatcher = fs.watch(ENV_FILE, { persistent: false }, () => applyConfiguredPort('fs.watch').catch(e => say('PORT watcher:', e && e.stack || e))); } catch {}
  const poll = () => { if (shuttingDown) return; applyConfiguredPort('poll').catch(e => say('PORT watcher:', e && e.stack || e)); setTimeout(poll, 1500).unref(); };
  poll();
};

let shuttingDown = false;
async function quit() {
  if (shuttingDown) return; shuttingDown = true;
  try { if (envPortWatcher) envPortWatcher.close(); } catch {}
  try { fs.rmSync(READY_FILE, { force: true }); } catch {}
  try { fs.writeFileSync(STATE_FILE, JSON.stringify({ status: 'Stopping', auto: autoState })); } catch {}
  const killTree = pid => new Promise(resolve => {
    if (!WIN || !pid || pid === process.pid) return resolve();
    execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => resolve());
  });
  try {
    stopHttp();
    for (const [c] of procs) { try { await killTree(c.pid); } catch {} }
    procs.clear();
    // Thoat MediaPlayer = tat luon Cloudflare Tunnel (cloudflared chay tach roi nen phai diet tay).
    if (WIN) await new Promise(r => execFile('taskkill', ['/IM', 'cloudflared.exe', '/T', '/F'], { windowsHide: true }, () => r()));
    const trayProc = tp; tp = null; if (trayProc) await killTree(trayProc.pid);
    try { fs.rmSync(path.join(DATA, 'tray', 'commands'), { recursive: true, force: true }); } catch {}
  } finally { process.exit(0); }
}

async function onTray(id) {
  try {
    switch (id) {
      case 'open': return openP(URL_);
      case 'admin': return openP(URL_ + '/?login=1');
      case 'start': await startHttp(); break;
      case 'stop': stopHttp(); break;
      case 'restart': stopHttp(); await startHttp(); break;
      case 'auto': if (autoState) reg(['delete', RUNKEY, '/v', 'MediaPlayer', '/f'], refreshAuto); else reg(['add', RUNKEY, '/v', 'MediaPlayer', '/t', 'REG_SZ', '/d', runCmd(), '/f'], refreshAuto); break;
      case 'video': return openP(VID);
      case 'img': return openP(IMG);
      case 'logs': return openP(LOGS);
      case 'cf_toggle': return toggleCloudflareTunnel();
      case 'cf_setup': return setupCloudflareTunnel();
      case 'exit': return quit();
      default: say('Lenh khay khong hop le:', id);
    }
  } catch (e) { say('tray action loi:', id, e && e.stack || e); }
  push();
}

const RUNKEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
// Boc qua powershell -WindowStyle Hidden de khi Windows tu khoi dong MediaPlayer
// luc dang nhap, KHONG hien cua so CMD/console nao ca - giong het luc chay tay
// qua MediaPlayer.bat (chay ngam, dieu khien hoan toan qua icon khay).
const runCmd = () => {
  const psArgs = IS_SEA
    ? `'${process.execPath}' -ArgumentList @('--autostart')`
    : `'${process.execPath}' -ArgumentList @('${__filename}','--autostart')`;
  const inner = `Start-Process -FilePath ${psArgs} -WindowStyle Hidden`;
  return `powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "${inner}"`;
};
const reg = (args, cb) => execFile('reg', args, { windowsHide: true }, (e, out) => cb && cb(!e, out));
const refreshAuto = () => reg(['query', RUNKEY, '/v', 'MediaPlayer'], ok => { if (ok !== autoState) { autoState = ok; push(); } });

// ---- Cloudflare Tunnel functions ----
const CF_SERVICE = 'MediaPlayerCloudflareTunnel';
const CF_SETUP_BAT = path.join(SETTING_DIR, 'CloudflareTunnelAuto-OPEN.cmd');

// Cloudflare Tunnel chay nhu tien trinh an cua USER (khong Windows Service, khong can Admin/UAC).
const CF_DIR = path.join(SETTING_DIR, 'cloudflare_Tunnel');
const CF_BIN = path.resolve(SETTING_DIR, '..', 'bin', 'cloudflared.exe');
const CF_CONFIG = path.join(CF_DIR, 'config.yml');
const CF_FLAG = path.join(CF_DIR, 'disabled.flag');
const cfInstalled = () => fs.existsSync(CF_CONFIG) && fs.existsSync(CF_BIN);
const cfRunning = cb => execFile('tasklist', ['/FI', 'IMAGENAME eq cloudflared.exe', '/FO', 'CSV', '/NH'], { windowsHide: true }, (e, out) => cb(!e && /cloudflared\.exe/i.test(out)));
const refreshCf = () => {
  if (!WIN) return;
  if (!cfInstalled()) { if (cfState !== 'Not installed') { cfState = 'Not installed'; push(); } return; }
  cfRunning(r => { const st = r ? 'Running' : 'Stopped'; if (st !== cfState) { cfState = st; push(); } });
};
const cfStart = () => {
  const p = spawn(CF_BIN, ['--no-autoupdate', '--config', CF_CONFIG, 'tunnel', 'run'], { detached: true, stdio: 'ignore', windowsHide: true, cwd: CF_DIR });
  p.on('error', e => notify('Khong bat duoc Cloudflare Tunnel: ' + e.message));
  p.unref();
};
function toggleCloudflareTunnel() {
  if (!WIN) { say('Cloudflare Tunnel chi ho tro Windows'); return; }
  if (!cfInstalled()) {
    notify('Cloudflare Tunnel chua duoc cai. Dang mo trinh cai dat...');
    setupCloudflareTunnel();
    return;
  }
  cfRunning(running => {
    if (running) {
      try { fs.writeFileSync(CF_FLAG, 'off'); } catch {}
      execFile('taskkill', ['/IM', 'cloudflared.exe', '/T', '/F'], { windowsHide: true }, () => setTimeout(() => cfRunning(still => {
        notify(still ? 'Khong tat duoc Cloudflare Tunnel (service cu chay Admin - chay CloudflareTunnel-Uninstall.cmd 1 lan)' : 'Da TAT Cloudflare Tunnel');
        refreshCf();
      }), 800));
    } else {
      try { fs.unlinkSync(CF_FLAG); } catch {}
      cfStart();
      setTimeout(() => { notify('Da BAT Cloudflare Tunnel'); refreshCf(); }, 1500);
    }
  });
}
// Tu bat tunnel khi MediaPlayer khoi dong (tru khi ban da chu dong tat).
const autoStartCf = () => { if (WIN && cfInstalled() && !fs.existsSync(CF_FLAG)) cfRunning(r => { if (!r) { cfStart(); setTimeout(refreshCf, 1500); } }); };

function setupCloudflareTunnel() {
  if (!WIN) { say('Cloudflare Tunnel chi ho tro Windows'); return; }
  if (!fs.existsSync(CF_SETUP_BAT)) {
    say('Khong tim thay file cau hinh Cloudflare Tunnel:', CF_SETUP_BAT);
    return;
  }
  try {
    // Chạy file setup với quyền Admin
    const p = spawn('cmd.exe', ['/c', CF_SETUP_BAT], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false // Hiện cửa sổ CMD để xem tiến trình
    });
    // Neu spawn that bai (VD khong tim thay cmd.exe, bi chan quyen...) se
    // khong con im lang nua - ghi ro vao log de biet nguyen nhan.
    p.on('error', e => say('Loi mo cua so Cloudflare Tunnel setup:', e.message));
    p.on('exit', (code, signal) => {
      // OPEN.cmd chi la launcher, thoat rat nhanh la BINH THUONG (no da giao
      // viec cho cua so PowerShell/Admin rieng). Chi canh bao neu ma loi != 0.
      if (code !== 0 && code !== null) say('Cloudflare Tunnel launcher thoat voi ma loi:', code, signal || '');
    });
    p.unref();
    say('Da khoi dong Cloudflare Tunnel setup - chay bang quyen user thuong, khong can Admin.');
  } catch (e) {
    say('Loi khoi dong Cloudflare Tunnel setup:', e.message);
  }
}

// ---- icon khay hệ thống ----
function icon() {
  const S = 32, w = S, h = S;
  const rowSize = w * 4, pixelDataSize = rowSize * h;
  const andRowSize = Math.ceil(w / 32) * 4, andSize = andRowSize * h;
  const hdrSize = 40, imageSize = hdrSize + pixelDataSize + andSize;
  const buf = Buffer.alloc(6 + 16 + imageSize);
  let o = 0;
  buf.writeUInt16LE(0, o); o += 2; buf.writeUInt16LE(1, o); o += 2; buf.writeUInt16LE(1, o); o += 2;
  buf.writeUInt8(w, o); o += 1; buf.writeUInt8(h, o); o += 1; buf.writeUInt8(0, o); o += 1; buf.writeUInt8(0, o); o += 1;
  buf.writeUInt16LE(1, o); o += 2; buf.writeUInt16LE(32, o); o += 2; buf.writeUInt32LE(imageSize, o); o += 4; buf.writeUInt32LE(22, o); o += 4;
  buf.writeUInt32LE(hdrSize, o); o += 4; buf.writeInt32LE(w, o); o += 4; buf.writeInt32LE(h * 2, o); o += 4;
  buf.writeUInt16LE(1, o); o += 2; buf.writeUInt16LE(32, o); o += 2; buf.writeUInt32LE(0, o); o += 4; buf.writeUInt32LE(pixelDataSize, o); o += 4;
  buf.writeInt32LE(0, o); o += 4; buf.writeInt32LE(0, o); o += 4; buf.writeUInt32LE(0, o); o += 4; buf.writeUInt32LE(0, o); o += 4;
  const cx = (w - 1) / 2, cy = (h - 1) / 2, R = w / 2 - 1;
  const bgB = 219, bgG = 141, bgR = 37;
  for (let y = h - 1; y >= 0; y--) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy, dist = Math.sqrt(dx * dx + dy * dy);
      let B = 0, G = 0, R2 = 0, A = 0;
      if (dist <= R) {
        A = 255;
        const leftX = -R * 0.32, tipX = R * 0.55, t = (dx - leftX) / (tipX - leftX);
        const inTri = dx >= leftX && dx <= tipX && Math.abs(dy) <= R * 0.5 * (1 - t);
        if (inTri) { B = 255; G = 255; R2 = 255; } else { B = bgB; G = bgG; R2 = bgR; }
      }
      buf.writeUInt8(B, o); o += 1; buf.writeUInt8(G, o); o += 1; buf.writeUInt8(R2, o); o += 1; buf.writeUInt8(A, o); o += 1;
    }
  }
  buf.fill(0, o, o + andSize);
  return buf;
}
function startTray() {
  if (!WIN || ARGS.has('--no-tray')) return;
  const d = path.join(DATA, 'tray'); fs.mkdirSync(d, { recursive: true });
  const ps1 = path.join(d, 'tray.ps1'), ico = path.join(d, 'tray.ico'), cmdDir = path.join(d, 'commands');
  fs.mkdirSync(cmdDir, { recursive: true });
  try { for (const f of fs.readdirSync(cmdDir)) if (f.startsWith('click-') && f.endsWith('.cmd')) fs.rmSync(path.join(cmdDir, f), { force: true }); } catch {}
  fs.writeFileSync(ps1, '\ufeff' + asset('tray.ps1').toString('utf8')); fs.writeFileSync(ico, icon());
  push();
  tp = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', ps1, '-ParentPid', String(process.pid), '-StateFile', STATE_FILE, '-IconFile', ico, '-CommandDir', cmdDir], { windowsHide: true, stdio: ['ignore', 'ignore', 'ignore'] });
  tp.on('error', e => { say('tray loi:', e.message); tp = null; });
  tp.on('exit', () => { tp = null; });
  const poll = () => {
    let files = [];
    try { files = fs.readdirSync(cmdDir).filter(f => /^click-[0-9a-f-]+\.cmd$/i.test(f)); }
    catch (e) { if (e.code === 'ENOENT') { try { fs.mkdirSync(cmdDir, { recursive: true }); } catch {} } else say('tray poll loi:', e.code || e.message); }
    for (const f of files) {
      const fp = path.join(cmdDir, f); let id = '';
      try { id = fs.readFileSync(fp, 'utf8').trim(); fs.rmSync(fp, { force: true }); } catch { continue; }
      if (/^[A-Za-z0-9_-]+$/.test(id)) onTray(id).catch(e => say('tray:', e.stack || e.message || e));
    }
    if (!shuttingDown) setTimeout(poll, 200);
  };
  poll();
}

// QUAN TRỌNG: phải tự khởi động HTTP server ở đây — nếu không web sẽ không bao giờ chạy
// (trước đây startHttp chỉ được gọi khi bấm "Start Server"/"Restart" trong khay hệ thống).
// Mỗi bước bọc try/catch RIÊNG: một bước lỗi (vd icon khay hệ thống) không được phép
// chặn các bước còn lại — đặc biệt là mở trình duyệt, để "web không tự mở" không tái diễn.
startHttp().then(ok => {
  if (ok !== true) say('KHONG KHOI DONG DUOC WEB SERVER (cong ' + PORT + '):', ok, ok === 'EADDRINUSE' ? '- co the da co 1 ban MediaPlayer khac dang chay.' : '');
  push();
}).catch(e => say('startHttp loi:', e && e.stack || e));
try { startTray(); } catch (e) { say('startTray loi (icon khay he thong co the khong hien):', e && e.stack || e); }
try { refreshAuto(); } catch (e) { say('refreshAuto loi:', e && e.stack || e); }
try { autoStartCf(); refreshCf(); setInterval(refreshCf, 15000).unref(); } catch (e) { say('refreshCf loi:', e && e.stack || e); }
try { startEnvPortWatcher(); } catch (e) { say('startEnvPortWatcher loi:', e && e.stack || e); }
if (WIN && !ARGS.has('--no-open')) setTimeout(() => { try { openP(URL_); } catch (e) { say('auto-open loi:', e && e.stack || e); } }, 1200).unref();
process.on('SIGINT', quit);
process.on('SIGTERM', quit);
