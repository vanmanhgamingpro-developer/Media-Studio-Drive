// Bảo vệ phía trình duyệt (v7): chặn chuột phải / kéo / bôi đen / sao chép / phím tắt DevTools,
// ẨN TOÀN BỘ trang ngay từ đầu cho tới khi kiểm tra xong, và DỪNG trang khi phát hiện DevTools đang mở
// (kể cả mở TRƯỚC khi vào web; đóng lại thì tự chạy tiếp).
// Lưu ý kỹ thuật: mọi phần ở đây phải chạy được dưới CSP của server (không eval / Function / style nội tuyến).
// Bản cũ dùng Function('debugger') → bị CSP chặn → hàm kiểm tra ném lỗi ngay lần đầu → vòng lặp không bao giờ chạy.
(() => {
  'use strict';
  const D = document, R = D.documentElement;
  R.classList.add('gchk'); // style.css: html.gchk body{visibility:hidden} — trang chỉ hiện sau khi kiểm tra lần đầu đạt
  const inField = t => !!(t && t.closest && t.closest('input,textarea,select,[contenteditable="true"]'));
  const stop = e => { e.preventDefault(); e.stopPropagation(); return false; };
  const on = (t, ev, fn) => t.addEventListener(ev, fn, true);
  on(D, 'contextmenu', e => inField(e.target) ? 0 : stop(e));
  on(D, 'dragstart', stop);
  on(D, 'selectstart', e => inField(e.target) ? 0 : stop(e));
  on(D, 'copy', e => inField(e.target) ? 0 : stop(e)); on(D, 'cut', e => inField(e.target) ? 0 : stop(e));
  on(D, 'keydown', e => {
    const k = (e.key || '').toLowerCase(), c = e.ctrlKey || e.metaKey;
    if (e.key === 'F12' || (c && e.shiftKey && 'ijcke'.includes(k)) || (e.metaKey && e.altKey && 'ijcu'.includes(k)) || (c && k.length === 1 && 'usp'.includes(k)) || (c && k.length === 1 && 'cxa'.includes(k) && !inField(e.target))) stop(e);
  });

  // ---- màn chặn (kiểu dáng nằm trong style.css vì CSP không cho style nội tuyến) ----
  const G = D.createElement('div'); G.id = 'devguard';
  const ic = D.createElement('div'), tt = D.createElement('b'), ms = D.createElement('span');
  ic.className = 'gi'; ic.textContent = '🔒'; tt.textContent = 'Trang đã bị dừng';
  ms.textContent = 'Phát hiện công cụ nhà phát triển (F12 / DevTools) đang mở. Hãy đóng nó lại — trang sẽ tự chạy tiếp.';
  G.append(ic, tt, ms); R.append(G);

  let blocked = false, first = false, waiters = [], hit = 0, last = 0;
  const enforce = () => { // gọi mỗi lần kiểm tra: ai xoá/sửa màn chặn hoặc gỡ class bằng DevTools thì bị dựng lại ngay
    if (!G.isConnected) R.append(G);
    R.classList.add('gblk'); R.classList.add('gchk');
    if (D.body) D.body.style.setProperty('display', 'none', 'important');
    G.style.setProperty('display', 'flex', 'important');
  };
  const set = v => {
    if (v) { enforce(); if (!blocked) D.querySelectorAll('video,audio').forEach(m => { try { m.pause(); } catch {} }); }
    if (v === blocked) return; blocked = v;
    if (!v) { R.classList.remove('gblk'); G.style.removeProperty('display'); if (D.body) D.body.style.removeProperty('display'); waiters.splice(0).forEach(r => r()); }
  };

  // ---- 3 cách phát hiện, mỗi cách bọc try/catch riêng để 1 cách lỗi không làm hỏng các cách còn lại ----
  const touch = matchMedia('(pointer:coarse)').matches;
  const el = new Image(), er = new Error('x');
  try { Object.defineProperty(el, 'id', { get() { hit = 1; return ''; } }); Object.defineProperty(er, 'stack', { get() { hit = 1; return ''; } }); } catch {}
  // (1) DevTools gắn vào cạnh cửa sổ → khung trình duyệt lệch kích thước ở đúng 1 chiều (zoom làm lệch cả 2 chiều → bỏ qua)
  const bySize = () => { if (touch) return false; const w = outerWidth - innerWidth > 170, h = outerHeight - innerHeight > 260; return w !== h; };
  // (2) DevTools đọc thuộc tính của đối tượng khi in ra Console (kể cả log đã có sẵn trước khi mở DevTools)
  const byLog = () => { const seen = hit; hit = 0; try { console.log(el); console.log(er); } catch {} return !!seen; };
  // (3) DevTools dừng ở lệnh debugger → thời gian trôi qua lâu bất thường. Đây là cách chắc nhất: bắt được cả DevTools tách rời cửa sổ và DevTools mở sẵn từ trước.
  const bySlow = () => { const t = performance.now(); debugger; return performance.now() - t > 200; };
  const safe = f => { try { return !!f(); } catch { return false; } };

  const check = () => {
    last = Date.now();
    const a = safe(bySize), b = safe(byLog), c = safe(bySlow);
    set(a || b || c);
    if (!first) { first = true; R.classList.remove('gchk'); if (blocked) R.classList.add('gchk'); }
    else if (!blocked) R.classList.remove('gchk');
  };
  check();                                   // kiểm tra ngay khi trang bắt đầu tải — trước cả khi app.js chạy
  setInterval(() => { if (!D.hidden) check(); }, 500); // tab ẩn → không kiểm tra, đỡ tốn CPU
  addEventListener('resize', check); addEventListener('focus', check); D.addEventListener('visibilitychange', check);
  D.addEventListener('DOMContentLoaded', check);
  addEventListener('load', check);

  // app.js gọi hàm này trước khi làm bất cứ việc gì (và trước mỗi lần gọi API): đang bị chặn thì đứng chờ
  Object.defineProperty(window, '__guardReady', { value: () => blocked ? new Promise(r => waiters.push(r)) : Promise.resolve(), writable: false, configurable: false });
  Object.defineProperty(window, '__guardBlocked', { value: () => blocked, writable: false, configurable: false });
})();
