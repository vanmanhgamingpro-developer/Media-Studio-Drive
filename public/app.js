// màn hình chờ (#boot): script inline bị CSP chặn nên khai báo ở đây
window.__bootDone = (() => { let d = 0; return () => { if (d) return; d = 1; const b = document.getElementById('boot'); if (!b) return; b.classList.add('out'); setTimeout(() => b.remove(), 500); }; })(); setTimeout(window.__bootDone, 15000);
'use strict';
const $ = s => document.querySelector(s);
const h = (t, a = {}, ...c) => { const e = document.createElement(t); for (const [k, v] of Object.entries(a)) { if (v == null || v === false) continue; if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'class') e.className = v; else if (k === 'style') Object.assign(e.style, v); else e.setAttribute(k, v === true ? '' : v); } e.append(...c); return e; };
const IC = { dl: 'M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z', play: 'M8 5v14l11-7z', pause: 'M6 5h4v14H6zM14 5h4v14h-4z', prev: 'M6 6h2v12H6zM9.5 12L18 18V6z', next: 'M16 6h2v12h-2zM6 18l8.5-6L6 6z', undo: 'M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z', vol: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4z', mute: 'M3 9v6h4l5 5V4L7 9H3zm13.6 3l2.4-2.4-1.4-1.4-2.4 2.4-2.4-2.4-1.4 1.4 2.4 2.4-2.4 2.4 1.4 1.4 2.4-2.4 2.4 2.4 1.4-1.4z', full: 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z', exit: 'M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z', close: 'M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z', search: 'M10 4a6 6 0 1 0 3.6 10.8l4.8 4.8 1.4-1.4-4.8-4.8A6 6 0 0 0 10 4zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z', plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z', minus: 'M5 11h14v2H5z', trash: 'M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z', fit: 'M4 4h6v2H6v4H4V4zm10 0h6v6h-2V6h-4V4zM4 14h2v4h4v2H4v-6zm14 0h2v6h-6v-2h4v-4z' };
const ico = n => { const s = document.createElement('span'); s.className = 'ic'; s.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${IC[n]}"/></svg>`; return s; };
const fmt = n => n >= 1e9 ? (n / 1e9).toFixed(2) + ' GB' : (n / 1e6).toFixed(1) + ' MB';
const hms = t => { t = Math.max(0, Math.round(t || 0)); const p = n => String(n).padStart(2, '0'); return (t >= 3600 ? (t / 3600 | 0) + ':' : '') + p(t % 3600 / 60 | 0) + ':' + p(t % 60); };
const qual = (w, hh) => { const m = Math.min(w, hh); return !m ? '' : m >= 2160 ? '4K' : m >= 1440 ? '2K' : m >= 1080 ? 'FHD' : m >= 720 ? 'HD' : 'SD'; };
const svgI = d => { const N = 'http://www.w3.org/2000/svg', s = document.createElementNS(N, 'svg'), p = document.createElementNS(N, 'path'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); p.setAttribute('d', d); s.append(p); return s; };
const ICN = { x: 'M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z', back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z', key: 'M12.65 10A5.99 5.99 0 0 0 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6a5.99 5.99 0 0 0 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z', gear: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z' };
const link = (t, fn, ico, cls = '') => h('button', { type: 'button', class: 'lnk ' + cls, onclick: fn }, ...(ico || /^←/.test(t) ? [svgI(ico || ICN.back)] : []), t.replace(/^←\s*/, ''));
const toast = (t, ms = 2800) => { const e = h('div', { class: 't2' }, t); $('#toast').append(e); if (ms) setTimeout(() => e.remove(), ms); return e; };
const S = { kind: 'video', sort: 'dur', q: '', items: [], total: 0, counts: {}, busy: false, ff: { ok: true, dl: -1 }, gOn: false, me: { admin: false }, csrf: '' };
let saved = {}; try { saved = JSON.parse(localStorage.getItem('mp:state')) || {}; } catch {}   // trạng thái lần xem trước: tab, sắp xếp, tìm kiếm, cuộn, video đang mở…
if (saved.kind === 'image' || saved.kind === 'video') S.kind = saved.kind;
if (saved.sv === 3 && ['dur', 'size', 'new', 'name'].includes(saved.sort)) S.sort = saved.sort; // sv=3: nhớ lựa chọn sắp xếp của người dùng; dữ liệu cũ sẽ trở về mặc định 'dài nhất trước'
S.q = String(saved.q || '').slice(0, 100);
async function api(u, o = {}) {
  if (window.__guardReady) await window.__guardReady(); // DevTools đang mở → không gọi máy chủ
  const hd = { 'X-CSRF-Token': S.me.csrf || '' }; if (o.json) { o.body = JSON.stringify(o.json); hd['Content-Type'] = 'application/json'; o.method = o.method || 'POST'; }
  const r = await fetch(u, { ...o, headers: hd, credentials: 'same-origin' }), d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Lỗi ' + r.status); return d;
}
const LERR = ['', 'Chưa cấu hình đăng nhập Google', 'Quá nhiều lần thử', 'Phiên đăng nhập Google không hợp lệ, hãy thử lại', 'Google từ chối đăng nhập', 'Không lấy được thông tin từ Google (kiểm tra Client ID/Secret & Redirect URI)', 'Token Google không hợp lệ', 'Tài khoản Google không hợp lệ', 'Tài khoản Google này không có quyền Admin'];
const refreshMe = async () => { S.me = await (await fetch('/api/me', { credentials: 'same-origin' })).json(); };
const refreshStatus = async () => { const s = await (await fetch('/api/status')).json(); S.gOn = s.google; applyLogo(s.logo); return s; };
function applyLogo(v) { // logo web (header + favicon)
  S.logo = v || 0; const L = $('.logo'); if (!L) return; L.replaceChildren(); L.classList.toggle('img', !!v);
  let ic = document.querySelector('link[rel=icon]'); if (!ic) { ic = document.createElement('link'); ic.rel = 'icon'; document.head.append(ic); }
  if (v) { L.append(h('img', { src: '/logo?v=' + v, alt: 'logo', draggable: 'false' })); ic.href = '/logo?v=' + v; } else ic.removeAttribute('href');
}

// ================= header / toolbar =================
function switchKind(k) { if (S.kind === k) return; S.kind = k; S.items = []; S.total = 0; S.busy = false; ++gen; ++lgen; grid.replaceChildren(); $('#msg').textContent = ''; scrollTo(0, 0); tabs(); saveState(); refresh(true); }
function tabs() { // dựng đúng 1 lần; các lần sau chỉ cập nhật số đếm + vị trí vệt trượt → không còn nháy/trượt lại từ đầu khi lăn nhanh
  const tb = $('#tabs');
  if (!tb._ok) { tb._ok = 1; const ind = h('i', { class: 'ind' }); ind.style.transition = 'none';
    tb.replaceChildren(ind, ...[['video', 'Video'], ['image', 'Ảnh']].map(([k, l]) => h('button', { 'data-k': k, onclick: () => switchKind(k) }, l, h('small', {}, '0'))));
    requestAnimationFrame(() => requestAnimationFrame(() => { ind.style.transition = ''; })); if (document.fonts && document.fonts.ready) document.fonts.ready.then(tabs); }
  for (const b of tb.querySelectorAll('button')) { const k = b.dataset.k, n = String(S.counts[k] ? S.counts[k].n : 0); b.classList.toggle('on', S.kind === k); if (b.lastChild.textContent !== n) b.lastChild.textContent = n; }
  const on = tb.querySelector('button.on'), ind = tb.querySelector('.ind');
  if (on && ind) { const w = on.offsetWidth + 'px', x = `translateX(${on.offsetLeft}px)`; if (ind.style.width !== w) ind.style.width = w; if (ind.style.transform !== x) ind.style.transform = x; }
}
function head() {
  $('#up').hidden = !S.me.admin; tabs(); $('#sico').replaceChildren(ico('search'));
  const sel = h('select', { title: 'Sắp xếp', onchange: () => { S.sort = sel.value; S.items = []; saveState(); refresh(true); } }, ...[['size', '⚖ Dung lượng lớn nhất'], ['dur', '⏱ Dài nhất trước'], ['new', '🕒 Mới nhất'], ['name', '🔤 Tên A→Z']].map(([v, l]) => h('option', { value: v }, l))); sel.value = S.sort;
  $('#sortw').replaceChildren(sel);
  if (!S.me.admin) return $('#tools').replaceChildren(h('button', { class: 'on', onclick: loginDlg }, 'Đăng nhập'));
  const fi = h('input', { type: 'file', multiple: '', hidden: '', accept: 'video/*,image/*,.mkv,.avi,.wmv,.flv,.ts,.m2ts,.mts,.mpg,.mpeg,.3gp,.vob,.mov,.m4v,.webm,.avif,.bmp', onchange: () => { upload([...fi.files]); fi.value = ''; } });
  $('#up').onclick = () => fi.click();
  $('#tools').replaceChildren(fi, h('button', { class: 'on', onclick: () => fi.click() }, '＋ Upload'), h('button', { class: 'gear', onclick: settings, title: 'Cài đặt', 'aria-label': 'Cài đặt' }, svgI(ICN.gear)), h('button', { onclick: logout, title: S.me.email }, 'Đăng xuất (' + (S.me.name || '').split('@')[0] + ')'));
}
let qt; $('#q').addEventListener('input', e => { clearTimeout(qt); qt = setTimeout(() => { S.q = e.target.value.trim(); S.items = []; refresh(true); }, 260); });

// ================= list + realtime reconcile =================
const grid = $('#grid'); let gen = 0;
async function fetchList(offset, limit) { const p = new URLSearchParams({ kind: S.kind, sort: S.sort, offset, limit }); if (S.q) p.set('q', S.q); return api('/api/media?' + p, { priority: 'high' }); }
function absorb(d) { S.total = d.total; S.counts = d.counts || S.counts; S.ff = d.ff || S.ff; S.driveErr = d.driveErr || ''; }
let forceOrder = false;
let lgen = 0; // đổi mỗi khi danh sách bị làm mới hoàn toàn (đổi tab/sắp xếp/tìm kiếm) — chỉ khi đó mới bỏ kết quả "tải thêm" đang chờ
async function fetchRange(upTo, from = 0) { // lấy các mục [from, upTo) theo từng trang ≤500 (giới hạn của máy chủ)
  let out = [], last = null;
  while (from + out.length < upTo) { const d = await fetchList(from + out.length, Math.min(500, upTo - from - out.length)); last = d; out.push(...d.items); if (!d.items.length || from + out.length >= d.total) break; }
  return { d: last, items: out };
}
async function refresh(reset = false, want = 24) { // giữ nguyên số mục đã tải, chỉ cập nhật phần thay đổi (không nhảy trang, không reload)
  const my = ++gen, n = reset ? want : Math.max(24, S.items.length); if (reset) ++lgen;
  if (reset && !grid.children.length) grid.replaceChildren(...Array.from({ length: 8 }, () => h('div', { class: 'sk' })));
  try {
    let { d, items } = await fetchRange(n); if (my !== gen) return;
    // Trong lúc chờ phản hồi, cuộn vô hạn có thể đã tải thêm mục mới. Nếu ghi đè bằng danh sách ngắn hơn, phần đuôi bị cắt → trang co lại → bị giật lên đầu và không kéo xuống cuối được. Lấy nốt phần đuôi trước khi áp dụng.
    while (!reset && S.items.length > items.length && items.length < d.total) { const r = await fetchRange(S.items.length, items.length); if (my !== gen) return; if (!r.items.length) break; items = items.concat(r.items); d = r.d; }
    if (!reset) { // máy chủ đo xong thời lượng/dung lượng → thứ tự đổi → mục cuối có thể bị đẩy ra ngoài n mục đầu. Nếu coi là "đã xoá" thì lưới co lại (trang giật lên) rồi phải tải lại. Đọc tiếp cho tới khi thấy lại các mục đó; mục nào thật sự không còn thì mới bỏ.
      const have = new Set(items.map(i => i.id)); let miss = S.items.filter(i => !have.has(i.id)).length;
      while (miss > 0 && items.length < d.total && items.length < 3000) { const r = await fetchRange(items.length + 200, items.length); if (my !== gen) return; if (!r.items.length) break; r.items.forEach(i => have.add(i.id)); items = items.concat(r.items); d = r.d; miss = S.items.filter(i => !have.has(i.id)).length; }
    }
    absorb(d); S.items = items; forceOrder = reset; render();
  }
  catch (e) { if (my === gen && !S.items.length) { grid.replaceChildren(); $('#msg').textContent = 'Không tải được danh sách.'; } }
}
let lastEmpty = 0;
async function more() {
  if (S.busy || S.items.length >= S.total) return; S.busy = true; const my = lgen; $('#sent').classList.add('loading');
  try {
    const d = await fetchList(S.items.length, 48); if (my !== lgen) return; absorb(d);
    const seen = new Set(S.items.map(i => i.id)), add = d.items.filter(i => !seen.has(i.id));
    if (!add.length) { if (Date.now() - lastEmpty > 3000) { lastEmpty = Date.now(); refresh(); } return; } // thứ tự phía server đã đổi → đồng bộ lại thay vì kẹt
    S.items.push(...add); render();
  } catch {} finally { S.busy = false; $('#sent').classList.remove('loading'); }
}
function render() {
  const els = new Map([...grid.querySelectorAll('.card')].map(c => [c.dataset.id, c])), want = [], keep = new Set(); let ni = 0;
  grid.querySelectorAll('.sk').forEach(e => e.remove());
  for (const it of S.items) { let c = els.get(it.id); if (c && c.classList.contains('gone')) c = null; if (!c) { c = mkCard(it); const k = Math.min(ni++, 14); c.style.setProperty('--i', k); c.classList.add('enter'); setTimeout(() => c.classList.remove('enter'), 900 + k * 45); } else updCard(c, it); keep.add(it.id); want.push(c); }
  for (const [id, c] of els) if (!keep.has(id) && !c.classList.contains('gone')) { c.classList.add('gone'); setTimeout(() => c.remove(), 320); }
  const cur = [...grid.children].filter(c => !c.classList.contains('gone')).map(c => c.dataset.id), force = forceOrder; forceOrder = false;
  if (!force && scrollY > 300 && cur.length) { // đã cuộn xuống: máy chủ đổi thứ tự (đo xong thời lượng/dung lượng…) thì KHÔNG xáo lại lưới — xáo là nguyên nhân giật/kẹt khi kéo xuống cuối
    const pos = new Map(want.map(c => [c.dataset.id, c])), kept = cur.filter(id => pos.has(id)).map(id => pos.get(id)), ks = new Set(kept.map(c => c.dataset.id));
    want.splice(0, want.length, ...kept, ...want.filter(c => !ks.has(c.dataset.id)));
  }
  if (cur.length !== want.length || cur.some((id, i) => id !== want[i].dataset.id)) {
    const moved = cur.some((id, i) => i < want.length && id !== want[i].dataset.id), first = new Map();
    if (moved && want.length <= 80 && !matchMedia('(prefers-reduced-motion:reduce)').matches) for (const c of want) if (c.isConnected && !c.classList.contains('enter')) first.set(c, c.getBoundingClientRect());
    const y0 = scrollY, tail = cur.length <= want.length && cur.every((id, i) => id === want[i].dataset.id);
    if (tail) grid.append(...want.slice(cur.length)); else grid.append(...want); // nối đuôi (cuộn vô hạn): chỉ thêm thẻ mới, không gỡ/chèn lại cả lưới
    if (!tail && Math.abs(scrollY - y0) > 2) scrollTo({ top: y0, behavior: 'instant' });
    for (const [c, a] of first) { const b = c.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top; if (dx || dy) c.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)' }); } // FLIP: thẻ trượt mượt tới vị trí mới khi đổi sắp xếp/lọc
  }
  $('#msg').textContent = S.items.length ? '' : (S.q ? 'Không có kết quả phù hợp.' : (S.driveErr ? 'Google Drive: ' + S.driveErr : 'Chưa có nội dung. Bỏ video/ảnh vào thư mục WEB-Video/Video và WEB-Video/img trên Google Drive — web tự cập nhật.'));
  tabs(); ffbar(); syncPlayer();
  if (S.items.length < S.total && sentVisible) more();
}
const dlItem = it => { const a = document.createElement('a'); a.href = '/media/' + encodeURIComponent(it.id) + '?dl=1'; a.download = ''; a.hidden = true; document.body.append(a); a.click(); setTimeout(() => a.remove(), 1000); toast('Đang tải xuống: ' + it.title); }; // chỉ admin mới có nút này (server cũng chặn người khác)
function mkCard(it) {
  const th = h('div', { class: 'th' }), tilt = h('div', { class: 'tilt' }, th, h('div', { class: 'glare' })), c = h('div', { class: 'card', 'data-id': it.id }, tilt, h('div', { class: 't', title: it.title }, it.title), h('div', { class: 'meta' }));
  c.addEventListener('click', () => openItem(it.id));
  if (S.me.admin) c.append(h('button', { class: 'x dlb', title: 'Tải xuống', 'aria-label': 'Tải xuống', onclick: e => { e.stopPropagation(); dlItem(c._it); } }, ico('dl')), h('button', { class: 'x', title: 'Xóa', onclick: e => { e.stopPropagation(); del(c._it); } }, '✕'));
  c._th = th; updCard(c, it); return c;
}
function updCard(c, it) {
  const th = c._th, pv = c._it; c._it = it; c.querySelector('.t').textContent = it.title;
  if (!pv || pv.th !== it.th || pv.kind !== it.kind || !th.firstChild) { th.replaceChildren(); th.classList.remove('empty'); thumb(it, th); }
  const badge = (cls, txt, title) => { let b = th.querySelector('.' + cls.split(' ')[0]); if (!txt) return b && b.remove(); if (!b) { b = h('span', { class: cls }); th.append(b); } b.textContent = txt; b.className = cls; if (title) b.title = title; };
  if (it.kind === 'video') { if (!th.querySelector('.play')) th.append(h('div', { class: 'play' }, h('b'))); badge('dur', it.dur ? hms(it.dur) : (th.querySelector('.dur') || {}).textContent || ''); badge('qb', qual(it.w, it.h));
    const bd = S.me.admin && it.bad && !it.conv; badge(it.conv ? 'st' : bd || it.err ? 'st err' : 'st', it.conv ? 'Đang chuyển đổi' : bd ? '⚠ Không phát được' : it.err ? '⚠ Lỗi file' : '', it.why || ''); }
  const inf = S.me.admin && it.info, m = c.querySelector('.meta');
  m.textContent = S.me.admin ? [fmt(it.size), inf && inf.w ? `${inf.w}×${inf.h}` : '', it.format, it.slow ? '⚠ tua chậm' : '', it.kind === 'video' && !it.web && !it.conv ? '⚠ cần ffmpeg' : ''].filter(Boolean).join(' · ') + (it.ready ? '' : S.ff.ok ? ' · đang xử lý…' : '') + (it.why ? ' · ' + it.why : inf && inf.err ? ' · ' + inf.err : '') : '';
  m.hidden = !m.textContent;
}
const vq = []; let vact = 0;
const vio = new IntersectionObserver(es => es.forEach(e => { const v = e.target; if (e.isIntersecting) { if (!v._q) { v._q = 1; vq.push(v); vpump(); } } else if (v._q === 1) { const i = vq.indexOf(v); if (i >= 0) vq.splice(i, 1); v._q = 0; } }), { rootMargin: '700px' });
function vpump() {
  while (vact < 3 && vq.length) { const v = vq.shift(); if (!v.isConnected) continue; v._q = 2; vact++; let done = false;
    const fin = () => { if (done) return; done = true; clearTimeout(tm); vact--; setTimeout(vpump, 80); }, tm = setTimeout(fin, 12000);
    v.addEventListener('loadeddata', () => { snap(v); fin(); }, { once: true }); v.addEventListener('error', fin, { once: true }); v.src = v.dataset.src; }
}
function snap(v) { // chụp khung hình → ảnh nhỏ, rồi bỏ thẻ <video> (giải phóng bộ giải mã)
  try { const w = v.videoWidth, hh = v.videoHeight; if (!w || !hh) return; vio.unobserve(v); const k = Math.min(1, 480 / Math.max(w, hh)), c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(hh * k); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    c.toBlob(b => { if (!b || !v.isConnected) return; const im = h('img', { class: 'm', alt: '', draggable: 'false', src: URL.createObjectURL(b) }); im.onload = () => URL.revokeObjectURL(im.src); v.replaceWith(im); v.removeAttribute('src'); try { v.load(); } catch {} }, 'image/jpeg', .7); } catch {}
}
const tq = []; let tact = 0; // ảnh xem trước tạo theo yêu cầu: tối đa 3 cùng lúc (2 khi đang mở trình phát) để chừa kết nối cho video
const tio = new IntersectionObserver(es => es.forEach(e => { const im = e.target; if (e.isIntersecting) { if (!im._tq) { im._tq = 1; tq.push(im); tpump(); } } else if (im._tq === 1) { const i = tq.indexOf(im); if (i >= 0) tq.splice(i, 1); im._tq = 0; } }), { rootMargin: '1600px' }); // xin ảnh xem trước từ sớm (trước khi cuộn tới ~1.5 màn hình) → tới nơi là có sẵn, không đứng chờ
function tpump() {
  while (tact < (isOpen() ? 2 : S.busy ? 3 : 5) && tq.length) { const im = tq.pop(); if (!im.isConnected) { im._tq = 0; continue; } im._tq = 2; tact++; let d = false;
    const fin = () => { if (d) return; d = true; clearTimeout(tm); tact--; setTimeout(tpump, 30); }, tm = setTimeout(fin, 20000);
    im.addEventListener('load', fin, { once: true }); im.addEventListener('error', fin, { once: true }); im.src = im._u; }
}
function thumb(it, th) { // thumbnail ffmpeg → (không có/lỗi) → khung hình đầu của chính video / ảnh gốc
  const full = '/media/' + it.id, od = S.gOn, src = it.th ? `/thumb/${it.id}?v=${it.th}` : od ? `/thumb/${it.id}` : ''; // Drive: chưa có ảnh thì xin server tạo ngay (chỉ ảnh đang hiện) thay vì tải cả video/ảnh gốc
  const frame = () => { th.querySelectorAll('img,video').forEach(e => e.remove()); const v = h('video', { muted: '', playsinline: '', preload: 'metadata', tabindex: '-1', class: 'fr' }); v.muted = true; v.dataset.src = full + '#t=0.6'; th.prepend(v); vio.observe(v);
    v.onloadedmetadata = () => { if (isFinite(v.duration) && !(it.dur > 0)) { let b = th.querySelector('.dur'); if (!b) th.append(b = h('span', { class: 'dur' })); b.textContent = hms(v.duration); } };
    v.onerror = () => { v.remove(); th.classList.add('empty'); }; };
  if (it.kind === 'video' && !src) return frame();
  const qd = od && !it.th, im = h('img', { class: 'm', alt: it.title, ...(qd ? {} : { src: src || full, loading: 'lazy' }), decoding: 'async', draggable: 'false' }); if (qd) { im._u = src; tio.observe(im); }
  let tries = 0; im.onerror = () => { if (od && !it.th && tries < 4 && im.isConnected) { tries++; return void setTimeout(() => { if (im.isConnected) { im._u = `/thumb/${it.id}?r=${tries}`; im._tq = 1; tq.push(im); tpump(); } }, 1500 * tries); } if (it.kind === 'video') frame(); else if (im.src.indexOf('/thumb/') > 0) im.src = full; else { im.remove(); th.classList.add('empty'); } };
  th.prepend(im);
}
// 3D tilt (một listener cho cả lưới)
let tiltRaf = 0;
grid.addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; const c = e.target.closest('.card'); if (!c || c.classList.contains('gone')) return; cancelAnimationFrame(tiltRaf); tiltRaf = requestAnimationFrame(() => {
  const r = c.querySelector('.th').getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; c.classList.add('hot');
  const t = c.querySelector('.tilt'); t.style.setProperty('--ry', ((x - .5) * 14).toFixed(2) + 'deg'); t.style.setProperty('--rx', ((.5 - y) * 10).toFixed(2) + 'deg'); c.style.setProperty('--mx', x * 100 + '%'); c.style.setProperty('--my', y * 100 + '%'); }); });
grid.addEventListener('pointerout', e => { const c = e.target.closest('.card'); if (c && !c.contains(e.relatedTarget)) { c.classList.remove('hot'); const t = c.querySelector('.tilt'); t.style.setProperty('--rx', '0deg'); t.style.setProperty('--ry', '0deg'); } });
async function del(it) {
  if (!confirm(`Xóa ${it.kind === 'video' ? 'video' : 'ảnh'} này?\n${it.title}\n\nFile trên máy chủ cũng sẽ bị xóa vĩnh viễn.`)) return;
  try { await api('/api/admin/media/' + it.id, { method: 'DELETE' }); try { localStorage.removeItem('pos:' + it.id); } catch {} toast('Đã xóa (cả file trên máy chủ)'); refresh(); } catch (e) { toast(e.message, 5000); }
}
function ffbar() {
  const b = $('#ffbar'), f = S.ff; if (!S.me.admin || (f.ok && f.dl < 0)) { b.hidden = true; return; } b.hidden = false; b.className = f.failed && !f.ok ? 'bad' : '';
  b.replaceChildren(f.dl >= 0 ? h('div', {}, `Đang tự tải ffmpeg (${f.dl}%) để tạo ảnh xem trước và chuyển video về H.264…`, h('progress', { max: 100, value: f.dl })) : h('div', {}, f.failed ? 'Không tự tải được ffmpeg. Hãy đặt ffmpeg.exe và ffprobe.exe vào thư mục bin cạnh MediaPlayer.exe.' : 'Chưa có ffmpeg — chưa thể tạo ảnh xem trước / chuyển đổi codec.'));
}

// ================= upload =================
const VEXT = /\.(mp4|m4v|mov|webm|ogv)$/i;
const probe = f => new Promise(ok => { const v = document.createElement('video'), u = URL.createObjectURL(f); let done = false;
  const end = r => { if (done) return; done = true; URL.revokeObjectURL(u); v.removeAttribute('src'); v.load(); ok(r); };
  v.preload = 'metadata'; v.onloadedmetadata = () => end(v.duration > 0 && v.videoWidth ? null : 'Video không có hình hoặc không có thời lượng.');
  v.onerror = () => end('Trình duyệt chưa đọc được codec này — server sẽ tự chuyển sang H.264 nếu có ffmpeg.'); setTimeout(() => end(null), 8000); v.src = u; });
async function upload(files) {
  for (const f of files) {
    if (!f.size) { toast(`${f.name}: file rỗng`); continue; }
    if (VEXT.test(f.name)) { const bad = await probe(f); if (bad && !confirm(`${f.name}\n${bad}\n\nVẫn tải lên?`)) continue; }
    const bar = h('progress', { max: 100, value: 0 }), lbl = h('div', { class: 'ln' }, f.name), t = toast('', 0); t.append(lbl, bar);
    await new Promise(ok => { const x = new XMLHttpRequest();
      x.upload.onprogress = e => { bar.value = e.loaded / e.total * 100; lbl.textContent = `${f.name} — ${Math.round(bar.value)}%`; };
      x.open('PUT', '/api/admin/upload?name=' + encodeURIComponent(f.name)); x.setRequestHeader('X-CSRF-Token', S.me.csrf); x.setRequestHeader('Content-Type', 'application/octet-stream');
      x.onloadend = () => { t.remove(); let m = 'Đã upload ' + f.name; if (x.status !== 200) try { m = f.name + ': ' + JSON.parse(x.responseText).error; } catch { m = f.name + ': upload lỗi (mất kết nối hoặc phiên hết hạn)'; } toast(m, 5000); ok(); }; x.send(f); });
  }
  refresh();
}

// ================= trình phát tự thiết kế =================
const P = { autoConv: new Set(), rep: new Set(), id: null, ui: null, tapT: 0, lastTap: 0, chain: { side: 0, until: 0 }, idleT: 0, saveT: 0, rate: 1, z: { s: 1, x: 0, y: 0 } };
try { P.rate = +localStorage.getItem('rate') || 1; } catch {}
const curIt = () => S.items.find(x => x.id === P.id) || (P.solo && P.solo.id === P.id ? P.solo : null), curIdx = () => S.items.findIndex(x => x.id === P.id);
const isOpen = () => $('#player').classList.contains('open');
function openItem(id) { const it = S.items.find(x => x.id === id); if (!it) return; if (!isOpen()) buildPlayer(); playIt(it); }
function buildPlayer() {
  const root = $('#player'), u = P.ui = {};
  const pb = (icn, title, fn, cls = '', lb = '') => { const b = h('button', { class: 'pb ' + cls, title, onclick: e => { e.stopPropagation(); fn(e); } }, ico(icn)); if (lb) b.append(h('span', { class: 'lb' }, lb)); return b; };
  u.bg = h('div', { class: 'pbg' }); u.v = h('video', { playsinline: '', preload: 'auto', disablepictureinpicture: '', disableremoteplayback: '', controlslist: 'nodownload noremoteplayback', draggable: 'false' }); u.img = h('img', { class: 'pi', alt: '', draggable: 'false' });
  u.hit = h('div', { class: 'hit' }); u.fl = h('div', { class: 'fx l' }, h('div', {}, '⏪ 10', h('small', {}, 'giây'))); u.fr = h('div', { class: 'fx r' }, h('div', {}, '10 ⏩', h('small', {}, 'giây'))); u.flash = h('div', { class: 'flash' });
  u.vosd = h('div', { class: 'vosd' }); u.spin = h('div', { class: 'spin on' }); u.err = h('div', { class: 'perr', hidden: '' });
  u.title = h('b'); u.top = h('div', { class: 'ptop' }, u.title, ...(S.me.admin ? [pb('dl', 'Tải video xuống', () => { const it = curIt(); if (it) dlItem(it); }), pb('trash', 'Xóa (xóa cả file trên máy chủ)', () => { const it = curIt(); if (it) del(it); }, 'del')] : []), pb('close', 'Đóng (Esc)', closePlayer));
  u.buf = h('div', { class: 'buf' }); u.pl = h('div', { class: 'pl' }); u.kn = h('div', { class: 'kn' }); u.pvc = h('canvas', { width: 160, height: 90 }); u.pvt = h('span', {}, '0:00'); u.pvv = h('video', { class: 'pvv', playsinline: '', preload: 'auto', tabindex: '-1' }); u.pvv.muted = true; u.tip = h('div', { class: 'tip' }, u.pvc, u.pvt); u.prog = h('div', { class: 'prog' }, h('div', { class: 'tr' }, u.buf, u.pl, u.kn), u.tip);
  u.bPlay = pb('play', 'Phát / Tạm dừng (Space)', togglePlay, 'big'); u.time = h('span', { class: 'time' }, '0:00 / 0:00');
  u.mute = pb('vol', 'Tắt tiếng (M)', () => { u.v.muted = !u.v.muted; }); u.vol = h('input', { type: 'range', min: 0, max: 1, step: .02, title: 'Âm lượng', oninput: () => { u.v.volume = +u.vol.value; u.v.muted = false; } });
  u.spd = h('button', { class: 'pb spd', title: 'Tốc độ', onclick: e => { e.stopPropagation(); u.menu.hidden = !u.menu.hidden; } }, '1×');
  u.menu = h('div', { class: 'menu', hidden: '' }, ...[.5, .75, 1, 1.25, 1.5, 2].map(x => h('button', { onclick: e => { e.stopPropagation(); setRate(x); u.menu.hidden = true; } }, x + '×')));
  u.bFs = pb('full', 'Toàn màn hình (F)', toggleFs);
  u.vrow = h('div', { class: 'row vonly' }, pb('prev', 'Trước (P)', () => step(-1)), u.bPlay, pb('next', 'Sau (N)', () => step(1)), pb('undo', 'Lùi 10s', () => seekBy(-10, 'l'), 'sk', '10'), pb('undo', 'Tới 10s', () => seekBy(10, 'r'), 'fw sk', '10'), h('span', { class: 'vol' }, u.mute, u.vol, (u.vnum = h('span', { class: 'vnum' }, '100'))), u.time, h('span', { class: 'sp' }), h('span', { class: 'rel' }, u.spd, u.menu), u.bFs);
  u.zt = h('span', { class: 'time' }, '100%');
  u.zrow = h('div', { class: 'row pzoom' }, pb('prev', 'Ảnh trước', () => step(-1)), pb('minus', 'Thu nhỏ', () => zoomBy(1 / 1.4)), u.zt, pb('plus', 'Phóng to', () => zoomBy(1.4)), pb('fit', 'Vừa khung', () => zoomReset()), pb('next', 'Ảnh sau', () => step(1)), h('span', { class: 'sp' }), pb('full', 'Toàn màn hình (F)', toggleFs));
  u.ctl = h('div', { class: 'pctl' }, u.prog, u.vrow, u.zrow);
  u.stage = h('div', { class: 'pstage', 'data-kind': 'video' }, u.v, u.pvv, u.img, u.hit, u.fl, u.fr, u.flash, u.vosd, u.spin, u.err, u.top, u.ctl);
  u.list = h('aside', { class: 'plist' });
  root.replaceChildren(u.bg, h('div', { class: 'pmain' }, u.stage, u.list)); root.classList.add('open'); document.body.classList.add('noscroll');
  const v = u.v; v.disablePictureInPicture = true; v.volume = +(localStorage.getItem('vol') ?? 1); v.muted = localStorage.getItem('muted') === '1'; u.vol.value = v.volume;
  { const pct = Math.round((v.muted ? 0 : v.volume) * 100); u.vnum.textContent = pct; u.vol.style.setProperty('--p', pct + '%'); P.built = Date.now(); }
  // nhớ trạng thái "thanh điều khiển đang ẩn" TRƯỚC khi pointerdown làm nó hiện lại → chạm lần 1 chỉ hiện thanh, chạm lần 2 mới phát/dừng
  u.stage.addEventListener('pointerdown', () => { P.wasIdle = u.stage.classList.contains('idle'); }, true);
  for (const ev of ['canplay', 'seeked', 'timeupdate']) u.pvv.addEventListener(ev, drawPv);
  u.hoverT = setInterval(() => { if (u.prog.classList.contains('pv') && u.pvv.readyState >= 2) { drawPv(); if (P.pvWant != null && !P.pvBusy && Math.abs(P.pvWant - u.pvv.currentTime) > .2) pvSeek(P.pvWant); } }, 120); // rê tới đâu hiện ảnh tới đó: tự bắt kịp con trỏ kể cả khi sự kiện seeked bị chậm/mất
  u.pvv.addEventListener('loadeddata', () => { drawPv(); P.pvBusy = false; if (P.pvWant != null) pvSeek(P.pvWant); });
  u.pvv.addEventListener('loadedmetadata', () => { P.pvBusy = false; if (P.pvWant != null) pvSeek(P.pvWant); });
  u.pvv.addEventListener('seeked', () => { drawPv(); P.pvBusy = false; if (P.pvWant != null && Math.abs(P.pvWant - u.pvv.currentTime) > .2) pvSeek(P.pvWant); });
  root.oncontextmenu = e => { e.preventDefault(); }; root.ondragstart = e => e.preventDefault(); // không menu chuột phải "Lưu video/ảnh"
  // nhấp 1 lần giữa = phát/dừng · nhấp đúp trái/phải = tua ∓10s (nhấp tiếp trong 0,7s tua tiếp) · nhấp đúp giữa = toàn màn hình
  u.hit.addEventListener('click', e => {
    const r = u.hit.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, side = x < .35 ? -1 : x > .65 ? 1 : 0, now = Date.now(), hid = P.wasIdle; P.wasIdle = false; wake(); u.menu.hidden = true;
    if (hid && now - P.lastTap >= 300) { P.lastTap = now; clearTimeout(P.tapT); return; } // thanh đang ẩn → chỉ hiện thanh, chưa tạm dừng
    if (side && now < P.chain.until && P.chain.side === side) { clearTimeout(P.tapT); P.lastTap = 0; P.chain.until = now + 700; return seekBy(side * 10, side < 0 ? 'l' : 'r'); }
    if (now - P.lastTap < 300) { clearTimeout(P.tapT); P.lastTap = 0; if (side) { P.chain = { side, until: now + 700 }; return seekBy(side * 10, side < 0 ? 'l' : 'r'); } return toggleFs(); }
    P.lastTap = now; clearTimeout(P.tapT); P.tapT = setTimeout(togglePlay, 260);
  });
  // thanh tiến trình: bấm/kéo để tua
  const ratio = e => { const r = u.prog.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); };
  u.prog.addEventListener('pointerdown', e => { e.stopPropagation(); if (!(v.duration > 0)) return; u.prog.setPointerCapture(e.pointerId); u.prog.classList.add('drag'); P.drag = true; scrub(e); });
  u.prog.addEventListener('pointerenter', e => { if (!P.drag && e.pointerType === 'mouse') pvShow(ratio(e)); }); // chỉ cần rê chuột tới đâu là hiện ngay ảnh xem trước tại đó, không cần bấm/giữ
  u.prog.addEventListener('pointermove', e => { if (P.drag) scrub(e); else pvShow(ratio(e)); });
  const endDrag = (e, commit) => { if (!P.drag) return; P.drag = false; u.prog.classList.remove('drag'); try { u.prog.releasePointerCapture(e.pointerId); } catch {} if (!commit || !(v.duration > 0)) { paint(); return; } const t = ratio(e) * v.duration; v.currentTime = t >= v.duration - 0.25 ? Math.max(0, v.duration - 0.25) : t; paint(); }; // chừa 0.25s cuối: kéo tới mút phải không kích hoạt 'ended' (tự chuyển video)
  u.prog.addEventListener('pointerup', e => endDrag(e, true)); u.prog.addEventListener('pointercancel', e => endDrag(e, false));
  u.prog.addEventListener('pointerleave', () => { if (!P.drag) u.prog.classList.remove('pv'); });
  for (const ev of ['pointerup', 'pointercancel']) u.prog.addEventListener(ev, e => { if (e.pointerType !== 'mouse') setTimeout(() => { if (!P.drag) u.prog.classList.remove('pv'); }, 300); });
  const scrub = e => { const q = ratio(e); pvShow(q); u.pl.style.width = u.kn.style.left = q * 100 + '%'; u.pl.style.width = q * 100 + '%'; u.time.textContent = hms(q * v.duration) + ' / ' + hms(v.duration); };
  u.ctl.addEventListener('click', e => e.stopPropagation()); u.top.addEventListener('click', e => e.stopPropagation());
  // sự kiện video
  for (const ev of ['loadedmetadata', 'resize']) v.addEventListener(ev, () => { setOrient(); if (fsEl()) lockOri(); });
  v.addEventListener('play', syncBtn); v.addEventListener('pause', () => { syncBtn(); wake(); savePos(); }); v.addEventListener('volumechange', () => { u.mute.replaceChildren(ico(v.muted || v.volume === 0 ? 'mute' : 'vol')); u.vol.value = v.muted ? 0 : v.volume; { const pct = Math.round((v.muted ? 0 : v.volume) * 100); u.vnum.textContent = pct; u.vol.style.setProperty('--p', pct + '%'); volOsd(pct); } try { localStorage.setItem('vol', v.volume); localStorage.setItem('muted', v.muted ? 1 : 0); } catch {} });
  v.addEventListener('waiting', () => u.spin.classList.add('on')); for (const ev of ['playing', 'canplay', 'seeked']) v.addEventListener(ev, () => u.spin.classList.remove('on')); v.addEventListener('canplay', () => { setTimeout(warmPv, 400); const id = P.id; if (id && P.fcRun !== id && v.duration > 0) { P.fcRun = id; setTimeout(() => { if (P.id === id) fcFill(id); }, 900); } });
  v.addEventListener('timeupdate', () => { paint(); if (Date.now() - P.saveT > 1500) { P.saveT = Date.now(); savePos(); } if (P.okId !== P.id && v.currentTime > 2) { P.okId = P.id; const it = curIt(); if (it && it.bad) fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: P.id, ok: 1 }) }).catch(() => {}); } }); v.addEventListener('seeked', savePos);
  v.addEventListener('progress', paint); v.addEventListener('durationchange', paint); v.addEventListener('ended', () => step(1, true));
  v.addEventListener('error', onErr); u.stage.addEventListener('pointermove', wake); u.stage.addEventListener('pointerdown', wake);
  // ảnh: cuộn để zoom, kéo để di chuyển, nhấp đúp để phóng/thu
  u.stage.addEventListener('wheel', e => { if (u.stage.dataset.kind !== 'image') return; e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.18 : 1 / 1.18, e.clientX, e.clientY); }, { passive: false });
  let pan = null; u.img.addEventListener('pointerdown', e => { if (P.z.s <= 1) return; pan = { x: e.clientX - P.z.x, y: e.clientY - P.z.y }; u.img.setPointerCapture(e.pointerId); u.img.classList.add('z'); });
  u.img.addEventListener('pointermove', e => { if (!pan) return; P.z.x = e.clientX - pan.x; P.z.y = e.clientY - pan.y; zApply(); }); u.img.addEventListener('pointerup', () => { pan = null; });
  u.img.addEventListener('dblclick', e => { if (P.z.s > 1) zoomReset(); else zoomAt(2.5, e.clientX, e.clientY); });
  u.img.addEventListener('load', () => { zoomReset(); u.spin.classList.remove('on'); }); u.img.addEventListener('error', () => { u.spin.classList.remove('on'); showErr('Không tải được ảnh (có thể đã bị xoá khỏi máy chủ).', false); });
}
function playIt(it, opt = {}) {
  savePos(); const u = P.ui, v = u.v; P.id = it.id; P.fcRun = 0; P.fc = (P.fcAll && P.fcAll.get(it.id)) || null; P.solo = opt.solo || null; P.seekPending = false; u.err.hidden = true; u.menu.hidden = true; u.title.textContent = it.title; u.stage.dataset.kind = it.kind; delete u.stage.dataset.orient; u.stage.style.setProperty('--bg', it.kind === 'video' && it.th ? `url(/thumb/${it.id}?v=${it.th})` : 'none'); u.spin.classList.add('on'); clearTimeout(P.tapT);
  if (it.kind === 'video') { u.img.removeAttribute('src'); v.poster = it.th ? `/thumb/${it.id}?v=${it.th}` : ''; v.src = '/media/' + it.id; v.playbackRate = P.rate; setRate(P.rate, true); spLoad(it.id);
    let pos = 0; try { pos = +localStorage.getItem('pos:' + it.id); } catch {} if (pos > 1) { P.seekPending = true; v.addEventListener('loadedmetadata', () => { v.currentTime = pos; }, { once: true }); v.addEventListener('seeked', () => { P.seekPending = false; }, { once: true }); }
    if (opt.paused) { u.spin.classList.remove('on'); syncBtn(); } else v.play().catch(() => { u.spin.classList.remove('on'); syncBtn(); }); paint();
  } else { v.pause(); v.removeAttribute('src'); v.load(); u.img.src = '/media/' + it.id; }
  renderList(); wake();
}
// ---- xem trước khung hình khi rê/giữ trên thanh tua (kiểu YouTube): dùng 1 thẻ <video> ẩn để lấy khung hình ----
function drawPv() { const u = P.ui, p = u && u.pvv, c = u && u.pvc; if (!p || !p.videoWidth || spOk()) return; fcStore(); if (P.pvWant != null && u.prog.classList.contains('pv') && Math.abs(P.pvWant - p.currentTime) > Math.max(2, (u.v.duration || 0) / 60)) return; /* đang rê tới chỗ khác: không vẽ khung cũ đè lên khung gần nhất */ const hh = Math.max(1, Math.round(160 * p.videoHeight / p.videoWidth)); if (c.width !== 160) c.width = 160; if (c.height !== hh) c.height = hh; try { c.getContext('2d').drawImage(p, 0, 0, 160, hh); } catch {} }
function warmPv() { const u = P.ui; if (!u || !P.id || u.stage.dataset.kind !== 'video' || u.pvv.dataset.id === String(P.id) || spOk()) return; u.pvv.dataset.id = String(P.id); P.pvBusy = false; u.pvv.src = '/media/' + P.id; } // nạp sẵn video xem trước ngay khi video chính đã chạy được → rê chuột lần đầu không phải chờ tải
// ---- BỘ ĐỆM KHUNG HÌNH: tải sẵn ảnh xem trước rải đều theo THỜI LƯỢNG video (nền, thưa dần → mịn dần), kéo thanh tua tới đâu hiện ngay khung gần nhất, không phải chờ dừng tay ----
function fcStore() { const u = P.ui, f = P.fc; if (!u || !f || f.id !== P.id || u.pvv.seeking || !u.pvv.videoWidth) return; const d = u.v.duration || 0; if (!(d > 0)) return; const k = Math.round(u.pvv.currentTime / f.step); let cv = f.m.get(k); if (!cv) { cv = document.createElement('canvas'); f.m.set(k, cv); } const hh = Math.max(1, Math.round(160 * u.pvv.videoHeight / u.pvv.videoWidth)); if (cv.width !== 160 || cv.height !== hh) { cv.width = 160; cv.height = hh; } try { cv.getContext('2d').drawImage(u.pvv, 0, 0, 160, hh); } catch { f.m.delete(k); } }
function fcDraw(t) { const u = P.ui, f = P.fc; if (!u || !f || f.id !== P.id || !f.m.size) return false; const k0 = Math.round(t / f.step), mx = Math.ceil((u.v.duration || 0) / f.step); let cv = null; for (let o = 0; o <= mx && !cv; o++) cv = f.m.get(k0 - o) || f.m.get(k0 + o) || null; if (!cv) return false; const c = u.pvc; if (c.width !== cv.width || c.height !== cv.height) { c.width = cv.width; c.height = cv.height; } try { c.getContext('2d').drawImage(cv, 0, 0); } catch { return false; } return true; }
async function fcFill(id) { // tuần tự, thứ tự chia đôi (đầu/giữa/1/4/3/4…) để lúc nào cũng phủ đều cả video
  const d = P.ui && P.ui.v.duration || 0; if (!(d > 0)) return; const N = Math.min(120, Math.max(30, Math.round(d / 8))), old = (P.fcAll = P.fcAll || new Map()).get(id), f = P.fc = old && old.n === N ? old : { id, n: N, step: d / N, m: new Map() }, order = [], seen = new Set(); P.fcAll.delete(id); P.fcAll.set(id, f); if (P.fcAll.size > 6) P.fcAll.delete(P.fcAll.keys().next().value);
  for (let g = 1; g <= N; g *= 2) for (let i = 0; i <= N; i += Math.max(1, Math.floor(N / g))) if (!seen.has(i)) { seen.add(i); order.push(i); } for (let i = 0; i <= N; i++) if (!seen.has(i)) order.push(i);
  const sl = ms => new Promise(r => setTimeout(r, ms));
  for (const i of order) {
    if (f.m.has(i)) continue; // đã có từ lần mở trước
    for (;;) { const u = P.ui; if (!u || P.id !== id || P.fc !== f) return; if (spOk()) return; // đã có ảnh ghép từ máy chủ → khỏi tải
      if (u.pvv.dataset.id !== String(id)) { if (u.v.readyState >= 3) warmPv(); await sl(500); continue; }
      if (P.drag || u.prog.classList.contains('pv') || u.v.readyState < 3 || u.v.seeking || document.hidden || u.pvv.readyState < 1) { await sl(400); continue; } break; } // người dùng đang rê/kéo hoặc video chính đang đệm → nhường
    const u = P.ui, t = Math.min(i * f.step, Math.max(0, d - 0.3));
    await new Promise(ok => { const done = () => { clearTimeout(to); u.pvv.removeEventListener('seeked', done); ok(); }, to = setTimeout(done, 3500); u.pvv.addEventListener('seeked', done); P.pvWant = t; P.pvBusy = true; clearTimeout(P.pvT); P.pvT = setTimeout(() => { P.pvBusy = false; }, 900); try { if (u.pvv.fastSeek) u.pvv.fastSeek(t); else u.pvv.currentTime = t; } catch { done(); } });
    if (P.ui && P.id === id) { P.pvBusy = false; if (P.pvWant === t) P.pvWant = null; }
    await sl(120); // thưa nhịp → không tranh băng thông với video đang phát
  }
}
function pvSeek(t) { const u = P.ui; if (!u) return; P.pvWant = t; if (P.pvBusy) return; P.pvBusy = true; clearTimeout(P.pvT); P.pvT = setTimeout(() => { P.pvBusy = false; if (P.pvWant != null && Math.abs(P.pvWant - u.pvv.currentTime) > .2) pvSeek(P.pvWant); }, 220); try { if (u.pvv.fastSeek) u.pvv.fastSeek(t); else u.pvv.currentTime = t; } catch { P.pvBusy = false; } }
function pvShow(q) {
  const u = P.ui; if (!u) return; const v = u.v, d = v.duration || 0, W = u.prog.clientWidth, half = (u.tip.offsetWidth || 170) / 2 + 4;
  u.prog.classList.add('pv'); u.tip.style.left = Math.min(Math.max(half, W - half), Math.max(half, q * W)) + 'px'; u.pvt.textContent = hms(q * d);
  if (!(d > 0) || u.stage.dataset.kind !== 'video') return;
  if (spDraw(q * d)) return; // có ảnh ghép → hiện ngay, không cần tua video ẩn
  fcDraw(q * d); // hiện NGAY khung gần nhất đã tải sẵn (không chờ), rồi mới tua video ẩn lấy khung chính xác
  if (u.pvv.dataset.id !== String(P.id)) { if (v.readyState < 1) return; warmPv(); }
  pvSeek(q * d);
}
// ảnh ghép khung hình do máy chủ tạo sẵn (giống YouTube): 1 tấm ảnh, rê chuột là vẽ ngay khung tương ứng
const spOk = () => { const s = P.sp; return !!(s && s.id === P.id && s.img && s.img.complete && s.img.naturalWidth); };
function spDraw(t) {
  if (!spOk()) return false; const u = P.ui, s = P.sp, c = u.pvc;
  const i = Math.max(0, Math.min(s.n - 1, Math.floor(t / s.step))), cx = c.getContext('2d');
  if (c.width !== s.w || c.height !== s.h) { c.width = s.w; c.height = s.h; }
  try { cx.drawImage(s.img, (i % s.cols) * s.w, Math.floor(i / s.cols) * s.h, s.w, s.h, 0, 0, s.w, s.h); } catch { return false; } return true;
}
function spLoad(id) { // xin ảnh ghép của video đang phát; máy chủ chưa tạo xong thì hỏi lại sau vài giây (trong lúc chờ vẫn dùng cách cũ)
  clearTimeout(P.spT); if (P.sp && P.sp.id !== id) P.sp = null; let tries = 0;
  const ask = async () => {
    if (P.id !== id || !P.ui) return; if (spOk()) return;
    let j = null; try { const r = await fetch('/api/sprite/' + id, { cache: 'no-store' }); if (r.ok) j = await r.json(); } catch {}
    if (P.id !== id || !P.ui) return;
    if (j && j.ready) { const img = new Image(); img.onload = () => { if (P.id !== id || !P.ui) return; P.sp = { id, img, n: j.n, cols: j.cols, w: j.w, h: j.h, step: j.step }; const u = P.ui; try { u.pvv.removeAttribute('src'); u.pvv.removeAttribute('data-id'); u.pvv.load(); P.pvBusy = false; P.pvWant = null; } catch {} }; img.onerror = () => { P.spT = setTimeout(ask, 5000); }; img.src = `/sprite/${id}?v=${j.v || 0}`; return; }
    if (j && j.failed) return; if (++tries < 150) P.spT = setTimeout(ask, tries < 5 ? 2000 : 5000);
  };
  ask();
}
// ---- hiển thị mức âm lượng (số %) khi đổi âm lượng ----
function volOsd(pct) {
  const u = P.ui; if (!u || Date.now() - (P.built || 0) < 800) return; const bar = h('i'); bar.style.setProperty('--p', pct + '%');
  u.vosd.replaceChildren(h('b', {}, (pct ? '🔊 ' : '🔇 ') + pct + '%'), bar); u.vosd.classList.add('on'); clearTimeout(P.osdT); P.osdT = setTimeout(() => u.vosd.classList.remove('on'), 1000);
}
function syncBtn() { const u = P.ui; if (!u) return; u.bPlay.replaceChildren(ico(u.v.paused ? 'play' : 'pause')); }
function paint() { const u = P.ui, v = u.v, d = v.duration || 0; if (P.drag) return; const q = d ? v.currentTime / d * 100 : 0; u.pl.style.width = q + '%'; u.kn.style.left = q + '%';
  let b = 0; for (let i = 0; i < v.buffered.length; i++) if (v.buffered.start(i) <= v.currentTime + .5 && v.buffered.end(i) >= v.currentTime) b = v.buffered.end(i); u.buf.style.width = d ? b / d * 100 + '%' : '0'; u.time.textContent = hms(v.currentTime) + ' / ' + hms(d); }
function togglePlay() { const u = P.ui; if (!u || u.stage.dataset.kind !== 'video') return; const v = u.v; fxFlash(v.paused ? 'play' : 'pause'); v.paused ? v.play().catch(() => {}) : v.pause(); }
function fxFlash(n) { const f = P.ui.flash; f.replaceChildren(ico(n)); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
function seekBy(d, side) { const u = P.ui, v = u.v; if (!(v.duration > 0)) return; v.currentTime = Math.min(v.duration, Math.max(0, v.currentTime + d)); const fx = side === 'l' ? u.fl : u.fr; fx.firstChild.firstChild.textContent = d < 0 ? '⏪ ' + Math.abs(d) : Math.abs(d) + ' ⏩'; fx.classList.remove('go'); void fx.offsetWidth; fx.classList.add('go'); paint(); }
function setRate(x, quiet) { P.rate = x; const u = P.ui; u.v.playbackRate = x; u.spd.textContent = x + '×'; u.menu.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.textContent === x + '×')); if (!quiet) try { localStorage.setItem('rate', x); } catch {} }
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
const isTouchDev = () => matchMedia('(pointer:coarse)').matches;
function lockOri() { // điện thoại/máy tính bảng: video ngang → xoay màn hình ngang & phủ kín; video dọc → giữ dọc (iPhone Safari không cho khoá, nhưng phát toàn màn hình gốc sẽ tự xoay theo video)
  const u = P.ui; if (!u || !isTouchDev() || !fsEl()) return; const v = u.v; if (!v.videoWidth) return; const o = screen.orientation; if (o && o.lock) o.lock(v.videoWidth >= v.videoHeight ? 'landscape' : 'portrait').catch(() => {}); }
function unlockOri() { try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch {} }
function setOrient() { const u = P.ui; if (!u) return; const v = u.v, w = v.videoWidth, h = v.videoHeight; if (w && h) u.stage.dataset.orient = w >= h ? 'land' : 'port'; else delete u.stage.dataset.orient; } // máy tính: video dọc → nền mờ hai bên, video ngang → phủ vừa khung
async function toggleFs() {
  const u = P.ui; if (!u) return; const el = u.stage, v = u.v;
  if (fsEl()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
  const rf = el.requestFullscreen || el.webkitRequestFullscreen;
  if (rf) { try { await rf.call(el); } catch { if (v.webkitEnterFullscreen) v.webkitEnterFullscreen(); return; } lockOri(); }
  else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
}
for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, () => { if (fsEl()) lockOri(); else unlockOri(); });
function wake() { const u = P.ui; if (!u) return; u.stage.classList.remove('idle'); clearTimeout(P.idleT); P.idleT = setTimeout(() => { if (u.stage.dataset.kind === 'image' || !u.v.paused) u.stage.classList.add('idle'); }, 2600); }
function step(d, auto) {
  const i = curIdx(); let n = i + d; if (i < 0) return;
  if (n >= S.items.length) { if (S.items.length < S.total) { more().then(() => { if (curIdx() + 1 < S.items.length) step(1, auto); }); return; } if (auto) return; n = 0; }
  if (n < 0) n = S.items.length - 1; playIt(S.items[n]);
}
function closePlayer() { const root = $('#player'), u = P.ui; if (!u) return; clearTimeout(P.spT); P.sp = null; try { u.pvv.removeAttribute('src'); u.pvv.load(); } catch {} savePos(); try { if (document.fullscreenElement) document.exitFullscreen(); } catch {} u.v.pause(); u.v.removeAttribute('src'); u.v.load(); clearInterval(u.hoverT); root.classList.remove('open'); document.body.classList.remove('noscroll'); clearTimeout(P.idleT); clearTimeout(P.tapT); P.id = null; P.solo = null; saveState(); setTimeout(() => { if (!root.classList.contains('open')) { root.replaceChildren(); P.ui = null; } }, 300); }
async function onErr() {
  const u = P.ui, v = u.v, it = curIt(), id = P.id; if (!it || !v.getAttribute('src')) return; const c = v.error && v.error.code; u.spin.classList.remove('on');
  const gone = await fetch('/media/' + id, { method: 'HEAD' }).then(r => r.status === 404).catch(() => false); if (P.id !== id) return;
  if (gone) { showErr('Video đã bị xoá khỏi máy chủ.', false); refresh(); return setTimeout(() => { if (P.id === id) closePlayer(); }, 1800); }
  if (it.conv) { P.waitConv = id; return showErr('Video đang được chuyển sang H.264 + AAC để phát mượt trên mọi trình duyệt. Vui lòng thử lại sau ít phút (danh sách sẽ tự cập nhật).', true); }
  if (c === 2 && !P.retried) { P.retried = 1; const t = v.currentTime; v.load(); v.currentTime = t; v.play().catch(() => {}); return setTimeout(() => { P.retried = 0; }, 8000); }
  if ((c === 3 || c === 4) && S.me.admin && S.gOn && S.ff.ok && !P.autoRep) P.autoRep = new Set(); if (P.autoRep && (c === 3 || c === 4) && !P.autoRep.has(id) && S.me.admin) { P.autoRep.add(id); api('/api/admin/repair/' + id, { method: 'POST' }).then(() => toast('Video lỗi — đang tạo bản mới y chang rồi tự xoá bản cũ (chạy nền, có thể mất vài phút)', 7000)).catch(e => toast('Không sửa được: ' + e.message, 6000)); }
  if (c === 3 && v.currentTime > 1) { // lỗi giải mã tại 1 điểm (vd. 1 gói âm thanh hỏng giữa file): nạp lại và nhảy qua chỗ hỏng thay vì dừng hẳn
    const t0 = v.currentTime, em = v.error && v.error.message; if (t0 - (P.skipAt || 0) > 30) P.skipN = 0;
    if ((P.skipN || 0) < 5) { P.skipN = (P.skipN || 0) + 1; P.skipAt = t0; const t = Math.min((v.duration || 1e9) - 1, t0 + 2 * P.skipN), wasP = !v.paused; u.err.hidden = true; u.spin.classList.add('on'); v.src = '/media/' + id + '?r=' + Date.now(); v.addEventListener('loadedmetadata', () => { v.currentTime = t; }, { once: true }); v.play().catch(() => {}); toast('Gặp đoạn lỗi giải mã, đã bỏ qua ' + Math.round(t - t0) + ' giây'); report(id, c, em); return; }
  }
  const m = c === 4 ? (S.ff.ok ? 'Codec/định dạng này trình duyệt chưa phát được. Máy chủ sẽ tự chuyển sang H.264 + AAC — bạn có thể bấm "Chuyển đổi ngay".' : 'Định dạng này cần ffmpeg để chuyển sang H.264 + AAC' + (S.ff.dl >= 0 ? ` (đang tự tải ffmpeg ${S.ff.dl}%…)` : ' — chưa có ffmpeg.')) : c === 3 ? 'Video bị hỏng hoặc lỗi giải mã.' : c === 2 ? 'Lỗi mạng khi tải video.' : 'Không phát được video.';
  report(id, c, v.error && v.error.message);
  if ((c === 3 || c === 4) && S.me.admin && S.ff.ok && !P.autoConv.has(id)) { P.autoConv.add(id); try { await api('/api/admin/convert/' + id, { method: 'POST' }); P.waitConv = id; return showErr('Trình duyệt không phát được video này' + (it.why ? ' (' + it.why + ')' : '') + ' — đang tự chuyển sang H.264 + AAC (chạy nền, mức ưu tiên thấp, có thể mất vài phút). Xong sẽ tự phát lại. Nguyên nhân đã ghi vào data\logs\video-errors.log.', false); } catch {} }
  showErr(m + (S.me.admin && it.why ? ' Nguyên nhân: ' + it.why : ''), true, (c === 4 || (c === 3 && S.gOn)) && S.me.admin && S.ff.ok);
}
function showErr(msg, retry, conv) { const u = P.ui, id = P.id; u.err.hidden = false; u.err.replaceChildren(h('div', { class: 'big' }, '⚠'), h('span', {}, msg), h('div', {}, ...(retry ? [h('button', { class: 'on', onclick: () => { const t = u.v.currentTime; u.err.hidden = true; u.spin.classList.add('on'); u.v.src = '/media/' + id; u.v.addEventListener('loadedmetadata', () => { u.v.currentTime = t; }, { once: true }); u.v.play().catch(() => {}); } }, 'Thử lại')] : []), ...(conv ? [h('button', { onclick: async () => { try { await api('/api/admin/' + (S.gOn ? 'repair/' : 'convert/') + id, { method: 'POST' }); toast(S.gOn ? 'Đang tạo bản mới và sẽ tự xoá bản cũ' : 'Đã đưa vào hàng chờ chuyển đổi'); u.err.hidden = true; } catch (e) { toast(e.message); } } }, S.gOn ? 'Sửa lỗi & thay video' : 'Chuyển đổi ngay')] : []), h('button', { onclick: () => step(1) }, 'Video kế tiếp'))); }
function renderList() {
  const u = P.ui; if (!u) return; const keepTop = u.list.scrollTop, i = curIdx(), ord = i < 0 ? [] : S.items.slice(i).concat(S.items.slice(0, i)).slice(0, 40);
  u.list.replaceChildren(h('h3', {}, 'Danh sách phát · ' + (i + 1) + '/' + S.total), ...ord.map(it => { const th = h('div', { class: 'th' }); thumb(it, th); if (it.kind === 'video' && it.dur) th.append(h('span', { class: 'dur' }, hms(it.dur)));
    return h('div', { class: 'pi2' + (it.id === P.id ? ' cur' : ''), onclick: () => playIt(it) }, th, h('div', { class: 't' }, it.title)); }));
  if (P.listId === P.id) u.list.scrollTop = keepTop; P.listId = P.id; // cùng video → giữ nguyên vị trí cuộn; đổi video → về đầu (mục đang phát nằm trên cùng)
}
function syncPlayer() {
  if (!isOpen() || !P.ui || (P.solo && P.solo.id === P.id)) return; const i = curIdx(); if (i >= 0) P.idx = i;
  if (P.id && i < 0 && S.items.length >= S.total) { toast(P.autoRep && P.autoRep.has(P.id) ? 'Đã tạo bản mới sửa lỗi và xoá bản cũ — tìm video cùng tên trong danh sách (mục Mới nhất)' : 'Mục đang xem đã bị xoá khỏi máy chủ'); const n = S.items[Math.min(Math.max(P.idx || 0, 0), S.items.length - 1)]; if (n) playIt(n); else closePlayer(); return; }
  if (P.waitConv && P.waitConv === P.id) { const it = curIt(); if (it && !it.conv) { P.waitConv = null; const u = P.ui; u.err.hidden = true; u.spin.classList.add('on'); u.v.src = '/media/' + it.id + '?r=' + Date.now(); u.v.play().catch(() => {}); } }
  const sig = S.items.map(i => i.id).join(); if (sig !== P.sig) { P.sig = sig; renderList(); }
}
const zApply = () => { const z = P.z, i = P.ui.img; i.style.transform = `translate(${z.x}px,${z.y}px) scale(${z.s})`; P.ui.zt.textContent = Math.round(z.s * 100) + '%'; i.classList.toggle('z', z.s > 1); };
function zoomReset() { const u = P.ui, st = u.stage.getBoundingClientRect(), i = u.img, nw = i.naturalWidth || 1, nh = i.naturalHeight || 1, k = Math.min(st.width / nw, st.height / nh); P.z = { s: 1, x: 0, y: 0, base: k }; i.style.width = st.width + 'px'; i.style.height = st.height + 'px'; i.style.objectFit = 'contain'; zApply(); }
function zoomAt(f, cx, cy) { const z = P.z, st = P.ui.stage.getBoundingClientRect(), ns = Math.min(8, Math.max(1, z.s * f)), k = ns / z.s, px = cx - st.left, py = cy - st.top; z.x = px - (px - z.x) * k; z.y = py - (py - z.y) * k; z.s = ns; if (ns === 1) { z.x = 0; z.y = 0; } zApply(); }
function zoomBy(f) { const st = P.ui.stage.getBoundingClientRect(); zoomAt(f, st.left + st.width / 2, st.top + st.height / 2); }
document.addEventListener('keydown', e => {
  if (!isOpen() || !P.ui || ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return; const v = P.ui.v, vid = P.ui.stage.dataset.kind === 'video'; wake();
  const k = e.key.toLowerCase();
  if (k === 'escape') closePlayer(); else if (k === 'f') toggleFs(); else if (k === 'n' || (!vid && e.key === 'ArrowRight')) step(1); else if (k === 'p' || (!vid && e.key === 'ArrowLeft')) step(-1);
  else if (vid) { if (k === ' ' || k === 'k') { e.preventDefault(); togglePlay(); } else if (e.key === 'ArrowLeft') seekBy(-5, 'l'); else if (e.key === 'ArrowRight') seekBy(5, 'r'); else if (k === 'j') seekBy(-10, 'l'); else if (k === 'l') seekBy(10, 'r');
    else if (e.key === 'ArrowUp') { e.preventDefault(); v.volume = Math.min(1, v.volume + .05); v.muted = false; } else if (e.key === 'ArrowDown') { e.preventDefault(); v.volume = Math.max(0, v.volume - .05); } else if (k === 'm') v.muted = !v.muted; else if (/^[0-9]$/.test(k) && v.duration) v.currentTime = v.duration * (+k / 10); }
  else if (k === '+' || k === '=') zoomBy(1.4); else if (k === '-') zoomBy(1 / 1.4); else if (k === '0') zoomReset();
});
window.addEventListener('resize', () => { if (isOpen() && P.ui && P.ui.stage.dataset.kind === 'image') zoomReset(); tabs(); });

// ================= nhớ trạng thái: mở lại web vẫn y nguyên =================
let stateReady = false, lastSaved = '', scT = 0;
const CP = () => { const v = document.createElement('video'), q = t => v.canPlayType(t) || 'no'; return { h264: q('video/mp4; codecs="avc1.640028"'), hevc: q('video/mp4; codecs="hvc1.1.6.L93.B0"'), av1: q('video/mp4; codecs="av01.0.05M.08"'), vp9: q('video/webm; codecs="vp9"'), aac: q('audio/mp4; codecs="mp4a.40.2"'), ac3: q('audio/mp4; codecs="ac-3"') }; };
function report(id, code, msg) { if (P.rep.has(id) || (code !== 3 && code !== 4)) return; P.rep.add(id); fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, code, msg: String(msg || '').slice(0, 300), ua: navigator.userAgent.slice(0, 160), cp: CP() }), keepalive: true }).catch(() => {}); }
function savePos() { // vị trí xem của từng video
  const u = P.ui; if (!u || !P.id || P.seekPending || u.stage.dataset.kind !== 'video') return; const v = u.v, d = v.duration; if (!(d > 0) || v.readyState < 1) return;
  try { v.currentTime > 2 && v.currentTime < d - 3 ? localStorage.setItem('pos:' + P.id, v.currentTime.toFixed(1)) : localStorage.removeItem('pos:' + P.id); } catch {}
}
function saveState() { // tab, sắp xếp, tìm kiếm, vị trí cuộn, video đang mở + đang phát/tạm dừng (âm lượng, tốc độ, vị trí tua được lưu riêng)
  if (!stateReady) return; const s = JSON.stringify({ sv: 3, kind: S.kind, sort: S.sort, q: S.q, n: S.items.length, y: Math.round(scrollY), open: P.id || null, paused: P.id && P.ui ? P.ui.v.paused : false });
  if (s !== lastSaved) { lastSaved = s; try { localStorage.setItem('mp:state', s); } catch {} }
}
addEventListener('pagehide', () => { savePos(); saveState(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { savePos(); saveState(); } });
addEventListener('scroll', () => { clearTimeout(scT); scT = setTimeout(saveState, 400); }, { passive: true }); setInterval(saveState, 2000);
try { history.scrollRestoration = 'manual'; } catch {}
let scq = 0; addEventListener('scroll', () => { if (scq) return; scq = requestAnimationFrame(() => { scq = 0; $('#top').classList.toggle('sc', scrollY > 24); }); }, { passive: true }); // đổ bóng thanh đầu khi cuộn

// ================= dialogs (login / setup / reset / settings) =================
function form(title, fl, submit, ...extra) {
  const err = h('div', { class: 'err' }), f = h('form', {}, ...fl.map(([n, l, t, v]) => {
    const c = Array.isArray(t) ? h('select', { name: n }, ...t.map(([o, x]) => h('option', { value: o }, x))) : h('input', { name: n, type: t || 'text', autocomplete: n === 'password' ? 'current-password' : t === 'password' ? 'new-password' : n === 'login' ? 'username' : 'off' });
    c.value = v ?? ''; return h('label', {}, l, c); }), h('button', { class: 'on' }, 'Xác nhận'), err, ...extra);
  f.onsubmit = async e => { e.preventDefault(); err.textContent = ''; try { await submit(Object.fromEntries(new FormData(f))); } catch (x) { err.textContent = x.message; } };
  const m = $('#modal'); m.className = 'open'; m.onclick = null; m.replaceChildren(h('div', { class: 'box sm' }, h('h2', {}, title), f));
}
const closeM = () => { $('#modal').className = ''; setTimeout(() => { if (!$('#modal').className) $('#modal').replaceChildren(); }, 300); };
const authed = async () => { await refreshMe(); closeM(); head(); S.items = []; grid.replaceChildren(); refresh(true); };
new MutationObserver(() => { const b = $('#modal .box'); if (b && !b.querySelector(':scope > .mclose')) b.prepend(h('button', { type: 'button', class: 'mclose', title: 'Đóng', 'aria-label': 'Đóng', onclick: closeM }, svgI(ICN.x))); }).observe($('#modal'), { childList: true });
$('#modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal' && e.clientX < e.target.clientWidth) closeM(); }); // bấm ra ngoài để đóng
addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modal').classList.contains('open')) { closeM(); e.stopImmediatePropagation(); } }, true);
const closeL = () => link('Đóng', closeM, ICN.x, 'cls');
function loginDlg() { form('Đăng nhập Admin', [['login', 'Tên đăng nhập hoặc Email', ''], ['password', 'Mật khẩu', 'password']], async v => { await api('/api/login', { json: v }); await authed(); }, ...(S.gOn ? [h('button', { type: 'button', class: 'gbtn', onclick: () => { location.href = '/api/google/start'; } }, 'G  Đăng nhập bằng Google')] : []), link('Quên mật khẩu?', forgotDlg, ICN.key, 'key'), closeL()); }
function setupDlg() { form('Tạo tài khoản Admin (lần đầu)', [['username', 'Tên đăng nhập', '', 'admin'], ['email', 'Email (Gmail…)', 'email'], ['password', 'Mật khẩu (≥ 10 ký tự)', 'password']], async v => { await api('/api/setup', { json: v }); await authed(); }, closeL()); }
function forgotDlg() { const ok = h('div', { class: 'ok' }); form('Quên mật khẩu', [['email', 'Email Admin', 'email']], async v => { ok.textContent = (await api('/api/forgot', { json: v })).message; }, ok, link('← Quay lại', loginDlg)); }
function resetDlg(token) { form('Đặt mật khẩu mới', [['pw', 'Mật khẩu mới (≥ 10 ký tự)', 'password']], async v => { await api('/api/reset', { json: { token, password: v.pw } }); toast('Đã đổi mật khẩu, hãy đăng nhập'); loginDlg(); }); }
async function logout() { await api('/api/logout', { method: 'POST' }); S.me = { admin: false }; head(); S.items = []; grid.replaceChildren(); refresh(true); toast('Đã đăng xuất'); }
async function settings() {
  const s = await api('/api/admin/settings'), p = s.smtp, st = h('div', { class: 'ok' }), sm = h('div', { class: 'smst' }), act = (fn, msg) => async () => { try { await fn(); st.textContent = msg; } catch (e) { st.textContent = e.message; } };
  const setSm = (cls, t) => { sm.className = 'smst' + (cls ? ' ' + cls : ''); sm.textContent = t; };
  const when = t => new Date(t).toLocaleString('vi-VN');
  if (p.test && p.test.ok) setSm('ok', '✓ SMTP đã hoạt động (thử thành công lúc ' + when(p.test.at) + ')'); else if (p.test) setSm('err', '✗ Lần thử gần nhất (' + when(p.test.at) + ') thất bại: ' + p.test.msg); else setSm('', p.gmail ? 'Chưa thử SMTP — bấm "Test SMTP" để kiểm tra.' : 'Chưa liên kết Gmail.');
  const test = h('button', { type: 'button', class: 'on', onclick: async () => {
    const d = Object.fromEntries(new FormData($('#modal form'))); test.disabled = true; setSm('', 'Đang kết nối smtp.gmail.com và gửi thư thử…');
    try { const r = await api('/api/admin/settings/test', { json: { gmail: d.gmail, password: d.smtpPass, fromName: d.fromName } }); setSm('ok', '✓ ' + r.message); } catch (e) { setSm('err', '✗ ' + e.message); } finally { test.disabled = false; } } }, 'Test SMTP');
  form('Cài đặt', [['gmail', 'Gmail dùng để gửi thư (SMTP Gmail)', 'email', p.gmail], ['smtpPass', p.hasPassword ? 'Mật khẩu ứng dụng Gmail (16 ký tự) — trống = giữ nguyên' : 'Mật khẩu ứng dụng Gmail (16 ký tự)', 'password', ''], ['fromName', 'Tên người gửi (tuỳ chọn)', '', p.fromName],
    ['publicUrl', 'Public URL (vd https://media.example.com)', '', s.publicUrl], ['sessionHours', 'Session (giờ)', '', s.sessionHours],
    ['gid', 'Google Client ID (đăng nhập bằng Gmail)', '', s.google.clientId], ['gsecret', 'Google Client Secret (trống = giữ nguyên)', 'password', ''], ['gallowed', 'Gmail được phép làm Admin (cách nhau bằng dấu phẩy)', '', s.google.allowed]],
    async v => { await api('/api/admin/settings', { method: 'PUT', json: { smtp: { gmail: v.gmail, password: v.smtpPass, fromName: v.fromName }, publicUrl: v.publicUrl, sessionHours: v.sessionHours, google: { clientId: v.gid, secret: v.gsecret, allowed: v.gallowed } } }); st.textContent = 'Đã lưu.'; setSm('', 'Đã lưu — bấm "Test SMTP" để kiểm tra Gmail hoạt động chưa.'); await refreshStatus(); },
    h('div', { class: 'hint smtp-hint' }, 'SMTP chỉ dùng Gmail (smtp.gmail.com, cổng 465 SSL, tự chuyển 587 nếu bị chặn). Cần Mật khẩu ứng dụng: myaccount.google.com → Bảo mật → bật Xác minh 2 bước → Mật khẩu ứng dụng. Không dùng mật khẩu Gmail thường.'),
    sm, test,
    h('div', { class: 'hint' }, 'Redirect URI thêm vào Google Cloud → OAuth client (Web): ' + s.google.redirect),
    st,
    h('button', { type: 'button', onclick: act(() => api('/api/admin/rescan', { method: 'POST' }).then(() => refresh()), 'Đã rescan') }, 'Rescan media'),
    h('button', { type: 'button', onclick: act(() => api('/api/admin/reprocess', { method: 'POST' }), 'Đang kiểm tra lại video…') }, 'Kiểm tra lại toàn bộ video'),
    h('button', { type: 'button', onclick: async () => { try { const r = await api('/api/admin/convert-bad', { method: 'POST' }); st.textContent = `Đã xếp ${r.n} video lỗi vào hàng chờ chuyển đổi (chạy nền, ưu tiên thấp)`; } catch (e) { st.textContent = e.message; } } }, 'Chuyển đổi tất cả video lỗi'),
    h('button', { type: 'button', class: 'danger', onclick: act(() => api('/api/admin/sessions/revoke-others', { method: 'POST' }), 'Đã thu hồi phiên khác') }, 'Thu hồi phiên khác'), closeL());
  const f = $('#modal form'), anc = f && f.querySelector('input[name=fromName]'); // khối SMTP: hướng dẫn + trạng thái + nút Test nằm ngay dưới các ô Gmail
  if (anc) anc.closest('label').after(f.querySelector('.smtp-hint'), sm, test);
  logoBox();
}
function logoBox() { // mục đổi logo ở đầu hộp Cài đặt
  const f = $('#modal form'); if (!f) return; const pv = h('div', { class: 'logo lp' }), msg = h('div', { class: 'ok' }), fi = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml', hidden: '' });
  const draw = () => { pv.replaceChildren(); pv.classList.toggle('img', !!S.logo); if (S.logo) pv.append(h('img', { src: '/logo?v=' + S.logo, alt: '' })); };
  fi.onchange = async () => { const file = fi.files[0]; fi.value = ''; if (!file) return; msg.textContent = 'Đang tải logo…'; try { if (file.size > 2 * 1024 * 1024) throw new Error('Logo tối đa 2MB'); const r = await api('/api/admin/logo', { method: 'PUT', body: file }); applyLogo(r.v); draw(); msg.textContent = 'Đã đổi logo — logo cũ đã được xóa.'; } catch (e) { msg.textContent = e.message; } };
  const reset = async () => { try { await api('/api/admin/logo', { method: 'DELETE' }); applyLogo(0); draw(); msg.textContent = 'Đã về logo mặc định.'; } catch (e) { msg.textContent = e.message; } };
  f.prepend(h('div', { class: 'logobox' }, pv, h('div', { class: 'lbtns' }, h('b', {}, 'Logo website'), h('div', {}, h('button', { type: 'button', class: 'on', onclick: () => fi.click() }, 'Tải logo mới'), h('button', { type: 'button', class: 'danger', onclick: reset }, 'Xóa logo')), msg), fi)); draw();
}

// ================= realtime, infinite scroll, drag & drop =================
let rt, sentVisible = false, lastScroll = 0; addEventListener('scroll', () => { lastScroll = Date.now(); }, { passive: true });
const syncSoon = () => { clearTimeout(rt); rt = setTimeout(() => { if (Date.now() - lastScroll < 1500) return syncSoon(); refresh(); }, 1200); };
let dirty = false;
function connect() {
  const es = new EventSource('/api/events'), live = $('#live');
  es.onopen = () => { live.classList.remove('off'); refresh(); }; es.onerror = () => live.classList.add('off');
  es.onmessage = () => { if (document.hidden) { dirty = true; return; } syncSoon(); };
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && dirty) { dirty = false; refresh(); } });
new IntersectionObserver(e => { sentVisible = e[0].isIntersecting; if (sentVisible) more(); }, { rootMargin: '2600px' }).observe($('#sent'));
let dc = 0; const isF = e => [...(e.dataTransfer?.types || [])].includes('Files');
addEventListener('dragenter', e => { if (!isF(e)) return; e.preventDefault(); dc++; $('#dz').textContent = S.me.admin ? 'Thả video/ảnh vào đây để tải lên' : 'Đăng nhập Admin để tải lên'; $('#dz').classList.add('on'); });
addEventListener('dragleave', e => { if (isF(e) && --dc <= 0) { dc = 0; $('#dz').classList.remove('on'); } });
addEventListener('dragover', e => { if (isF(e)) e.preventDefault(); });
addEventListener('drop', e => { if (!isF(e)) return; e.preventDefault(); dc = 0; $('#dz').classList.remove('on'); const fs = [...e.dataTransfer.files]; if (S.me.admin) upload(fs); else { toast('Cần đăng nhập Admin để tải lên'); loginDlg(); } });
(async () => {
  if (typeof window.__guardReady !== 'function') { document.documentElement.classList.remove('gchk'); return document.body.replaceChildren(h('div', { class: 'gmsg' }, 'Không tải được lớp bảo vệ trang. Hãy tải lại trang.')); } // guard.js bị chặn/xoá → không cho chạy
  await window.__guardReady(); // DevTools đang mở → đứng ở đây cho tới khi đóng
  await refreshMe(); head(); $('#q').value = S.q; const first = refresh(true, Math.min(500, Math.max(24, saved.n || 24))); connect();
  const q = new URLSearchParams(location.search), t = q.get('reset'), s = await refreshStatus();
  const le = LERR[+q.get('loginerr')] || ''; if (le) toast(le, 7000);
  if (t) resetDlg(t); else if (!S.me.admin) { if (s.setup) setupDlg(); else if (q.has('login') || le) loginDlg(); }
  if ([...q].length) history.replaceState(null, '', '/');
  await first; window.__bootDone && window.__bootDone(); if (saved.y) scrollTo({ top: saved.y, behavior: 'instant' });
  if (saved.open && !t) { // mở lại đúng video đang xem, đúng vị trí, đúng âm lượng/tốc độ
    let it = S.items.find(x => x.id === saved.open), solo = null; if (!it) try { it = solo = (await api('/api/media/' + encodeURIComponent(saved.open))).item; } catch {}
    if (it) { buildPlayer(); playIt(it, { paused: !!saved.paused, solo }); }
  }
  stateReady = true;
})();
