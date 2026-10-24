# MediaPlayer - Hướng dẫn sử dụng

## Cách chạy

**Double-click vào file: `MediaPlayer.bat`**

File này sẽ tự động:
1. Build MediaPlayer.exe từ source mới nhất
2. Khởi động MediaPlayer web server
3. Khởi động System Tray Icon (góc dưới bên phải)

## System Tray Icon

Icon sẽ xuất hiện ở góc dưới bên phải (system tray):
- **Chuột phải** vào icon → Xem menu đầy đủ
- **Double-click** vào icon → Mở web MediaPlayer

## Menu có gì?

### MediaPlayer:
- ▶ Khởi động MediaPlayer
- ⏹ Dừng MediaPlayer  
- 🌐 Mở Web (http://127.0.0.1:6556)

### Cloudflare Tunnel (truy cập từ internet):
- ☁ Cài đặt/Cấu hình Cloudflare Tunnel
- ▶ Khởi động Cloudflare Tunnel
- ⏹ Dừng Cloudflare Tunnel
- ℹ Trạng thái Cloudflare Tunnel
- 🗑 Gỡ bỏ Cloudflare Tunnel

### Khác:
- ❌ Thoát (đóng icon, không tắt MediaPlayer)


## Google Drive riêng tư (MỚI)

Video/ảnh có thể lưu trên Google Drive riêng tư (tên file ngẫu nhiên) thay vì thư mục trên máy.
Xem hướng dẫn: `HUONG-DAN-GOOGLE-DRIVE.txt`  (cấu hình trong `Setting\.env` + `Setting\drive\`).

## Cấu trúc thư mục

- `bin/` - Chứa MediaPlayer.exe (tự động build)
- `data/` - Dữ liệu người dùng
- `public/` - File web tĩnh (HTML, CSS, JS)
- `Setting/` - Cấu hình và script Cloudflare Tunnel
- `docs/` - Tài liệu chi tiết

## Khởi động cùng Windows (tùy chọn)

1. Nhấn `Win + R`, gõ: `shell:startup`
2. Tạo shortcut của `MediaPlayer.bat` và copy vào thư mục startup
3. Khởi động lại máy - MediaPlayer sẽ tự chạy

## Lưu ý

- Lần đầu chạy có thể cần cấp quyền Administrator
- MediaPlayer chạy trên cổng 6556 (http://127.0.0.1:6556)
- Icon system tray chỉ để điều khiển, thoát icon không tắt MediaPlayer
- Dùng menu "Dừng MediaPlayer" để tắt hoàn toàn

## Cloudflare Tunnel là gì?

Cho phép truy cập MediaPlayer từ internet qua domain của bạn:
1. Chọn menu "Cài đặt/Cấu hình Cloudflare Tunnel"
2. Đăng nhập Cloudflare (miễn phí)
3. Chọn domain
4. Script tự động cài đặt và tạo tunnel
5. Bạn sẽ có link dạng: https://media.domain.com

---

**Chỉ cần chạy MediaPlayer.bat là xong!**

## Chạy bằng Node.js (VPS / hosting / Linux / macOS - và cả Windows)

Ngoài MediaPlayer.bat (Windows), có thêm cách chạy bằng JS, KHÔNG cần PowerShell/.bat:

    node start.js            (Linux/macOS:  sh start.sh   |   Windows: double-click StartJS.cmd)

Cần Node.js 22.13 trở lên. File này tự làm hết:
1. Bật web server (Setting/js/server.js), tự chạy lại nếu sập.
2. Lần đầu: tự tải cloudflared, mở link đăng nhập Cloudflare (trên VPS: copy link, mở bằng trình duyệt ở máy bạn
   rồi chọn đúng tên miền), BẮT NHẬP MIỀN CHÍNH + MIỀN PHỤ (VD nhập "media" -> media.tenmien.com),
   tạo tunnel + DNS, ghi Setting/cloudflare_Tunnel/config.yml (dùng chung với bản .bat).
3. In ra LINK HTTPS để truy cập.
   ĐÃ CÓ SẴN tunnel (config.yml) thì các lần sau KHÔNG hỏi gì: tự bật web + tunnel cùng lúc và in link.
   Muốn đổi miền: node start.js --reconfig  (hoặc --host=tên-khác).

Tuỳ chọn:
    node start.js --reconfig                 cài lại tunnel / đổi miền
    node start.js --no-tunnel                chỉ chạy web
    node start.js --host=media               không hỏi: dùng media.<miền chính đã lưu> (chạy nền/systemd)
    node start.js --host=media.abc.com --name=ten-tunnel
    node Setting/js/tunnel.js status|stop|start|reset   quản lý riêng tunnel

Chạy nền trên VPS: cài 1 lần bằng terminal (node start.js), sau đó dùng pm2 hoặc systemd, ví dụ:
    pm2 start start.js --name mediaplayer
Lưu ý: Setting/js/server.js dùng Google Drive (xem HUONG-DAN-GOOGLE-DRIVE.txt); cần có Setting/drive/oauth.json.
Đăng nhập Google Drive lần đầu trên VPS không có trình duyệt: chạy Drive-Login ở máy Windows rồi copy oauth.json lên VPS.
