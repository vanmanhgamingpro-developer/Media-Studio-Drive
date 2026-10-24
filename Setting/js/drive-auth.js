'use strict';
// Đăng nhập Google Drive 1 lần (OAuth) → ghi Setting\drive\oauth.json. Chạy qua Setting\Drive-Login.cmd (hoặc: node drive-auth.js)
const http = require('http'), https = require('https'), fs = require('fs'), path = require('path'), readline = require('readline'), { exec } = require('child_process');
const DIR = path.join(__dirname, '..', 'drive'), TOKEN_URL = process.env.MP_GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
fs.mkdirSync(DIR, { recursive: true });
const rl = readline.createInterface({ input: process.stdin }), lines = [], waiters = []; rl.on('line', l => { const w = waiters.shift(); w ? w(l.trim()) : lines.push(l.trim()); });
const ask = q => { process.stdout.write(q); return new Promise(ok => lines.length ? ok(lines.shift()) : waiters.push(ok)); };
const post = (url, form) => new Promise((ok, no) => { const u = new URL(url), b = new URLSearchParams(form).toString(); const r = (u.protocol === 'http:' ? http : https).request(u, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(b) } }, s => { let t = ''; s.on('data', d => t += d); s.on('end', () => { try { ok(JSON.parse(t)); } catch { no(new Error(t.slice(0, 200))); } }); }); r.on('error', no); r.end(b); });
(async () => {
  let id = '', secret = '';
  const f = fs.readdirSync(DIR).find(n => /^client_secret.*\.json$/i.test(n)); // file JSON tải từ Google Cloud (OAuth client loại "Desktop app")
  if (f) { try { const j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')), c = j.installed || j.web || j; id = c.client_id; secret = c.client_secret; console.log('Dùng ' + f); } catch {} }
  if (!id) id = await ask('Client ID: '); if (!secret) secret = await ask('Client secret: ');
  if (!id || !secret) { console.log('Thiếu Client ID/secret.'); process.exit(1); }
  const srv = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1'), code = u.searchParams.get('code'); if (!code && !u.searchParams.get('error')) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    try {
      if (!code) throw new Error(u.searchParams.get('error'));
      const t = await post(TOKEN_URL, { code, client_id: id, client_secret: secret, redirect_uri: 'http://127.0.0.1:' + srv.address().port, grant_type: 'authorization_code' });
      if (!t.refresh_token) throw new Error(t.error_description || t.error || 'Google không trả refresh_token (hãy thử lại, chọn đúng tài khoản và bấm Cho phép)');
      fs.writeFileSync(path.join(DIR, 'oauth.json'), JSON.stringify({ client_id: id, client_secret: secret, refresh_token: t.refresh_token }, null, 2));
      res.end('<meta charset="utf-8"><h2>Xong! Đã kết nối Google Drive. Đóng tab này và khởi động lại MediaPlayer.</h2>'); console.log('\nĐã ghi ' + path.join(DIR, 'oauth.json')); setTimeout(() => process.exit(0), 300);
    } catch (e) { res.end('<meta charset="utf-8"><h2>Lỗi: ' + String(e.message).replace(/[<&]/g, '') + '</h2>'); console.log('Lỗi:', e.message); setTimeout(() => process.exit(1), 300); }
  });
  srv.listen(0, '127.0.0.1', () => {
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: id, redirect_uri: 'http://127.0.0.1:' + srv.address().port, response_type: 'code', scope: 'https://www.googleapis.com/auth/drive', access_type: 'offline', prompt: 'consent' });
    console.log('\nMở link này nếu trình duyệt không tự bật:\n' + url + '\n');
    if (!process.env.DRIVE_AUTH_NO_BROWSER) exec(process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`);
  });
})();
