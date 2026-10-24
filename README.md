# 🎬 Media Studio (MediaPlayer) — Video Tool Drive

> Web phát **video & ảnh riêng tư** lấy trực tiếp từ **Google Drive**, chạy bằng **Node.js thuần (không cần `npm install`)**, kèm **Cloudflare Tunnel** để public ra internet bằng tên miền riêng — không cần mở port, không cần IP tĩnh.

**Chủ sở hữu / Tác giả:** [@vanmanhgaming](https://github.com/vanmanhgamingpro-developer)
**Phiên bản gói:** `Video_Tool_Drive_v30` · **Package:** `web-media-player` `2.1.8`
**Ngôn ngữ giao diện:** Tiếng Việt 🇻🇳

---

## 📑 Mục lục

1. [Giới thiệu](#-giới-thiệu)
2. [Tính năng nổi bật](#-tính-năng-nổi-bật)
3. [Kiến trúc tổng quan](#-kiến-trúc-tổng-quan)
4. [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
5. [Yêu cầu hệ thống](#-yêu-cầu-hệ-thống)
6. [Cài đặt & chạy nhanh](#-cài-đặt--chạy-nhanh)
7. [Cấu hình Google Drive](#-cấu-hình-google-drive)
8. [Cloudflare Tunnel](#-cloudflare-tunnel-truy-cập-từ-internet)
9. [Cấu hình `Setting/.env`](#-cấu-hình-settingenv)
10. [Quản trị (Admin)](#-quản-trị-admin)
11. [Bảo mật](#-bảo-mật)
12. [API](#-api)
13. [Đóng gói thành `.exe`](#-đóng-gói-thành-exe-windows)
14. [Chạy nền trên VPS](#-chạy-nền-trên-vps)
15. [Xử lý sự cố](#-xử-lý-sự-cố)
16. [Lưu ý quan trọng trước khi chia sẻ mã nguồn](#-lưu-ý-quan-trọng-trước-khi-chia-sẻ-mã-nguồn)
17. [Tác giả & bản quyền](#-tác-giả--bản-quyền)

---

## 📖 Giới thiệu

**Media Studio** là một máy chủ web nhỏ gọn giúp bạn biến một thư mục trên **Google Drive cá nhân** thành một "thư viện media" riêng tư:

```
Drive của bạn (riêng tư)            Máy chủ MediaPlayer                 Website
  WEB-Video/Video/  q8x7k2m9, …  →  quét danh sách, đọc thông tin  →  hiện lưới video/ảnh,
  WEB-Video/img/    r4nd0m1, …       phát qua máy chủ (có tua)          tìm kiếm, bấm để phát
```

- File trên Drive có thể đặt **tên ngẫu nhiên**, không cần đuôi `.mp4` / `.jpg` — hệ thống nhận diện theo loại file của Drive.
- **Link Drive và token không bao giờ gửi xuống trình duyệt**: mọi video/ảnh đều được phát/tải *qua máy chủ*.
- Tiêu đề hiển thị lấy từ **dòng đầu của "Mô tả"** của file trên Drive (nếu trống thì dùng tên file).

---

## ✨ Tính năng nổi bật

### 🎞️ Thư viện media
- Lưới video + ảnh, **tìm kiếm theo tên**, **sắp xếp**, ảnh xem trước (thumbnail) tự tạo.
- Trình phát video tùy biến (tua, toàn màn hình, picture-in-picture, tốc độ phát, phím mũi tên / `Esc`) — hỗ trợ cả chuột và cảm ứng.
- **Đồng bộ trực tiếp** với máy chủ qua SSE (`/api/events`) — thêm/xóa file là web cập nhật ngay, có chỉ báo "Trực tiếp".
- Tự quét lại Drive định kỳ (mặc định 30 giây) + nút **Quét lại** trong Admin.
- Thư mục con bên trong `Video/` và `img/` cũng được quét.

### ☁️ Google Drive riêng tư
- Hai cách cấp quyền: **OAuth (tài khoản của bạn)** hoặc **Service Account**.
- Tải lên từ web (Admin) → file Drive được đặt **tên ngẫu nhiên**, tên gốc lưu trong "Mô tả".
- Xóa từ web = chuyển vào **Thùng rác Drive** (khôi phục được).
- Giới hạn số thumbnail tải song song để không làm lag máy.

### 🌐 Public ra internet bằng Cloudflare Tunnel
- Tự tải `cloudflared`, đăng nhập Cloudflare, tạo **Named Tunnel**, tạo DNS và ghi `config.yml`.
- Có **2 đường chạy dùng chung cấu hình**: bản Windows `.bat` và bản Node.js `.js` (Windows / Linux / macOS / VPS).
- Lần sau đã có tunnel thì **tự bật web + tunnel và in link**, không hỏi gì.

### 🖥️ Tiện ích cho Windows
- `MediaPlayer.bat` — "một cú click": build exe, khởi động server, bật **System Tray icon**.
- Menu khay hệ thống: bật/tắt MediaPlayer, mở web, quản lý Cloudflare Tunnel (cài, bật, tắt, trạng thái, gỡ).

### 🛡️ Bảo mật tích hợp
- Mật khẩu băm bằng **scrypt**, session cookie + **CSRF token**, **rate limit** theo IP, nhật ký **audit**.
- CSP nghiêm ngặt, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`.
- `guard.js` phía trình duyệt: chặn chuột phải / kéo / sao chép / phím tắt DevTools và dừng trang khi phát hiện DevTools đang mở.
- Tùy chọn `BLOCK_LOCALHOST` để chặn truy cập trực tiếp qua localhost.

### 🔑 Tài khoản & khôi phục
- Lần đầu truy cập: **thiết lập tài khoản Admin** (`/api/setup`).
- Đăng nhập bằng mật khẩu **hoặc Google** (`/api/google/start`).
- **Quên mật khẩu** qua email (cấu hình **SMTP** trong Admin, có nút gửi thử).

---

## 🏗️ Kiến trúc tổng quan

```
┌──────────────┐   HTTPS    ┌──────────────────┐   HTTP    ┌──────────────────────────┐
│  Trình duyệt │ ─────────► │ Cloudflare Edge  │ ────────► │ cloudflared (tunnel)     │
└──────────────┘            └──────────────────┘           └────────────┬─────────────┘
                                                                        │ 127.0.0.1:6556
                                                           ┌────────────▼─────────────┐
                                                           │ Setting/js/server.js     │
                                                           │  • HTTP API + static     │
                                                           │  • SQLite (node:sqlite)  │
                                                           │  • SSE realtime          │
                                                           │  • Proxy stream Drive    │
                                                           └────────────┬─────────────┘
                                                                        │ Google Drive API
                                                                  ┌─────▼─────┐
                                                                  │ Drive của │
                                                                  │   bạn     │
                                                                  └───────────┘
```

**Công nghệ:**

| Thành phần | Công nghệ |
|---|---|
| Runtime | Node.js **≥ 22.13** (dùng `node:sqlite`, `node:sea`) |
| Backend | 1 file `server.js` (HTTP thuần, không framework, **không dependency**) |
| CSDL | SQLite (admin, session, media, settings, audit log) |
| Frontend | HTML + CSS + JavaScript thuần (không build step) |
| Realtime | Server-Sent Events |
| Lưu trữ media | Google Drive API |
| Public | Cloudflare Tunnel (`cloudflared`) |
| Tùy chọn | `ffmpeg` / `ffprobe` (tự tải) để đọc codec và tạo thumbnail |
| Đóng gói | Node SEA → `MediaPlayer.exe` |

---

## 📂 Cấu trúc thư mục

```
Video_Tool_Drive_v30/
├── start.js                    # Điểm vào chạy bằng Node.js (server + tunnel + tự khởi động lại)
├── StartJS.cmd                 # Double-click để chạy start.js trên Windows
├── MediaPlayer.bat             # Launcher Windows: build exe + server + tray
├── README.txt                  # Hướng dẫn gốc (tiếng Việt)
├── HUONG-DAN-GOOGLE-DRIVE.txt  # Hướng dẫn kết nối Drive từng bước
├── docs                        # Changelog tích hợp Cloudflare Tunnel
│
├── public/                     # Giao diện web tĩnh
│   ├── index.html
│   ├── app.js                  # Toàn bộ logic giao diện + trình phát
│   ├── style.css
│   └── guard.js                # Lớp bảo vệ phía trình duyệt
│
├── Setting/
│   ├── .env                    # Cấu hình (PORT, Drive, …)
│   ├── js/
│   │   ├── server.js           # Máy chủ chính (API, DB, Drive, ffmpeg, SSE)
│   │   ├── tunnel.js           # Cloudflare Tunnel bằng Node.js
│   │   ├── drive-auth.js       # Đăng nhập Google Drive (OAuth) lần đầu
│   │   ├── platform.js         # Tiện ích theo hệ điều hành
│   │   ├── build.js            # Đóng gói MediaPlayer.exe (Node SEA)
│   │   └── package.json
│   ├── ps1/
│   │   ├── tray.ps1            # System Tray icon
│   │   └── Set-ConsoleFont.ps1
│   ├── drive/                  # ⚠ Đặt oauth.json / service-account.json tại đây
│   ├── cloudflare_Tunnel/      # cert.pem, credentials/, logs/, config.yml
│   ├── Drive-Login.cmd         # Đăng nhập Google Drive
│   ├── CloudflareTunnelAuto.bat / -OPEN.cmd
│   └── CloudflareTunnel-{Start,Stop,Status,Uninstall}.cmd
│
├── bin/
│   └── sea-config.json         # Cấu hình build exe
└── data/                       # (tự tạo khi chạy) DB, logs, thumbs, tmp, originals
```

---

## 🧰 Yêu cầu hệ thống

- **Node.js 22.13 trở lên** → <https://nodejs.org>
- Một tài khoản **Google** + **Google Cloud project** (bật *Google Drive API*)
- *(Tùy chọn)* Tài khoản **Cloudflare** miễn phí + 1 tên miền, để public ra internet
- Hệ điều hành: Windows / Linux / macOS (bản `.bat` + tray chỉ dành cho Windows)

---

## 🚀 Cài đặt & chạy nhanh

### Cách 1 — Windows, một cú click
```text
Double-click  MediaPlayer.bat
```
Tự động: build `MediaPlayer.exe` → chạy web server → bật icon ở khay hệ thống.
Web mặc định: **http://127.0.0.1:6556** (double-click icon khay để mở).

### Cách 2 — Node.js (Windows / Linux / macOS / VPS)
```bash
node start.js            # Linux/macOS:  sh start.sh   |   Windows: double-click StartJS.cmd
```
Lần đầu, `start.js` sẽ:
1. Bật web server (`Setting/js/server.js`), **tự chạy lại nếu sập**.
2. Tải `cloudflared`, mở link đăng nhập Cloudflare, **hỏi miền chính + miền phụ** (VD nhập `media` → `media.tenmien.com`), tạo tunnel + DNS.
3. In ra **link HTTPS** để truy cập.

### Tùy chọn dòng lệnh

| Lệnh | Tác dụng |
|---|---|
| `node start.js --reconfig` | Cài lại tunnel / đổi tên miền |
| `node start.js --no-tunnel` | Chỉ chạy web, không tunnel |
| `node start.js --host=media` | Không hỏi, dùng `media.<miền chính đã lưu>` (chạy nền/systemd) |
| `node start.js --host=media.abc.com --name=ten-tunnel` | Chỉ rõ hostname và tên tunnel |
| `node Setting/js/tunnel.js status\|stop\|start\|reset` | Quản lý riêng tunnel |
| `node start.js --help` | Xem trợ giúp |

---

## ☁️ Cấu hình Google Drive

> Chi tiết đầy đủ: [`HUONG-DAN-GOOGLE-DRIVE.txt`](HUONG-DAN-GOOGLE-DRIVE.txt)

### Bước 1 — Tạo thư mục trên Drive
```
Drive của tôi/
└── WEB-Video/
    ├── Video/   ← video
    └── img/     ← ảnh
```
Web tự tìm thư mục tên `WEB-Video` (không phân biệt hoa/thường). Muốn đổi tên: `GDRIVE_ROOT_NAME` trong `.env`. Nếu có nhiều thư mục trùng tên, dán ID vào `GDRIVE_ROOT_FOLDER_ID`.

### Bước 2 — Cấp quyền cho MediaPlayer
Vào <https://console.cloud.google.com> → tạo Project → *APIs & Services → Library* → bật **Google Drive API**.

**A. OAuth bằng tài khoản của bạn *(khuyên dùng — xem, tải lên, xóa đều được)***
1. *OAuth consent screen* → **External**, điền tên app + email, bấm **Publish app** (để đăng nhập không hết hạn sau 7 ngày).
2. *Credentials → Create credentials → OAuth client ID* → loại **Desktop app** → tải JSON, bỏ vào `Setting/drive/`.
3. Chạy `Setting/Drive-Login.cmd` → đăng nhập, bấm *Cho phép* → sinh `Setting/drive/oauth.json`.

**B. Service Account** *(chỉ xem/phát; tải lên từ web sẽ báo lỗi)*
1. *Credentials → Service account → Keys → Add key → JSON*.
2. Lưu thành `Setting/drive/service-account.json`.
3. Chia sẻ thư mục gốc trên Drive cho email của service account (quyền *Người xem*).

### Bước 3 — Chạy
Khởi động lại. Log (`data/logs/server.log`) hiện dòng **"Google Drive: BẬT"**.

> 💡 **VPS không có trình duyệt?** Chạy `Drive-Login` ở máy Windows rồi **copy `oauth.json`** lên VPS.

### Lưu ý về video
- Dùng **MP4 (H.264 + AAC)** để trình duyệt phát được. Ở chế độ Drive, web **không tự chuyển codec** — file MKV/AVI… sẽ bị đánh dấu "không phát được"; hãy convert sang MP4 rồi tải lại.
- Có `ffmpeg` thì web đọc codec thật để cảnh báo sớm; không có vẫn chạy bình thường.
- Mỗi lượt xem tốn băng thông tải xuống của Drive; file có quá nhiều người xem có thể bị Google giới hạn.

---

## 🌍 Cloudflare Tunnel (truy cập từ internet)

Cho phép truy cập MediaPlayer qua domain của bạn, ví dụ `https://media.domain.com`, **không cần mở port router**.

**Bản Windows (menu khay hệ thống):**
`Cài đặt/Cấu hình` → đăng nhập Cloudflare → chọn domain → script tự tạo tunnel.

Các script hỗ trợ: `CloudflareTunnel-Start.cmd`, `-Stop.cmd`, `-Status.cmd`, `-Uninstall.cmd`.

**Bản Node.js:** `node start.js` (xem phần trên).

Hai bản **dùng chung** thư mục `Setting/cloudflare_Tunnel/` và `config.yml`, nên tạo bằng cách nào cũng dùng lẫn được.

Tự động hóa gồm: phát hiện kiến trúc CPU (AMD64/ARM64/x86) → tải `cloudflared` → đăng nhập → dò cổng MediaPlayer (đọc `PORT` từ `.env`, fallback `6556`) → tạo/ tái sử dụng Named Tunnel → lấy credential → ghi `config.yml` → tạo DNS.

---

## ⚙️ Cấu hình `Setting/.env`

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `6556` | Cổng web (đổi khi đang chạy sẽ tự áp dụng) |
| `GDRIVE_ROOT_NAME` | `WEB-Video` | Tên thư mục gốc cần tìm trên Drive |
| `GDRIVE_ROOT_FOLDER_ID` | — | Chỉ rõ thư mục gốc bằng ID/link (chứa `Video` và `img`) |
| `GDRIVE_VIDEO_FOLDER_ID` | — | Chỉ rõ thư mục video |
| `GDRIVE_IMAGE_FOLDER_ID` | — | Chỉ rõ thư mục ảnh |
| `GDRIVE_SCAN_SECONDS` | `30` | Chu kỳ quét Drive (10–3600 giây) |
| `GDRIVE_THUMB_CONCURRENCY` | `6` | Số thumbnail tải song song (1–8; máy lag thì giảm 3–4) |
| `BLOCK_LOCALHOST` | — | Bật/tắt chặn truy cập trực tiếp qua localhost |

Biến nâng cao (đọc từ môi trường): `MP_ROOT`, `MP_FFMPEG_URL`, `MP_NO_FFMPEG_DL`, `MP_VERBOSE`.

Cài đặt khác lưu trong DB và chỉnh trong Admin: **logo**, **publicUrl**, **thời hạn session**, **SMTP**, **Google login**.

---

## 🧑‍💼 Quản trị (Admin)

Sau khi đăng nhập Admin có thể:

- ⬆️ **Tải lên** video/ảnh bằng kéo-thả (upload dạng stream, nhận file rất lớn)
- 🗑️ **Xóa** file (vào Thùng rác Drive)
- 🔄 **Quét lại** Drive / **Xử lý lại** toàn bộ media
- 🖼️ **Đổi logo** (logo cũ tự bị xóa)
- ✉️ Cấu hình **SMTP** + gửi thử email
- 🔐 **Thu hồi các phiên đăng nhập khác**
- 🧾 Ghi **audit log** các thao tác quan trọng

---

## 🔒 Bảo mật

| Lớp | Cách làm |
|---|---|
| Mật khẩu | `scrypt` + salt ngẫu nhiên |
| Phiên | Cookie `mp_sid`, token được băm trong DB, hết hạn theo cấu hình |
| CSRF | Token riêng cho mọi request ghi (không phải GET/HEAD) |
| Rate limit | Theo IP cho API chung, đăng nhập, Google, báo lỗi; giới hạn kết nối SSE |
| Header | CSP `default-src 'self'`, `X-Frame-Options: DENY`, `nosniff`, `no-referrer` |
| Drive | Token/link Drive **không** lộ ra trình duyệt; stream qua máy chủ |
| Trình duyệt | `guard.js` chống DevTools / sao chép (chỉ là rào cản mềm, **không thay thế** bảo mật phía server) |

> ⚠️ `guard.js` chỉ làm khó người dùng phổ thông. Kẻ có kỹ năng vẫn có thể vượt qua — an toàn thật sự nằm ở xác thực/ủy quyền phía server.

---

## 🔌 API

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/api/status` | Trạng thái: đã setup admin chưa, Google bật không, logo |
| GET | `/api/me` | Thông tin phiên hiện tại |
| POST | `/api/setup` | Tạo tài khoản Admin lần đầu |
| POST | `/api/login` · `/api/logout` | Đăng nhập / đăng xuất |
| GET | `/api/google/start` · `/api/google/callback` | Đăng nhập bằng Google |
| POST | `/api/forgot` · `/api/reset` | Quên / đặt lại mật khẩu |
| GET | `/api/media` | Danh sách video/ảnh |
| POST | `/api/report` | Trình duyệt báo video lỗi / phát được |
| GET | `/api/events` | Luồng SSE đồng bộ trực tiếp |
| PUT/DELETE | `/api/admin/logo` | Đổi / đặt lại logo |
| PUT | `/api/admin/upload` | Upload file (body thô) |
| POST | `/api/admin/rescan` · `/reprocess` · `/convert-bad` | Quét lại / xử lý lại / chuyển đổi |
| GET/PUT | `/api/admin/settings` | Cài đặt hệ thống |
| POST | `/api/admin/settings/test` | Thử SMTP/cấu hình |
| POST | `/api/admin/sessions/revoke-others` | Thu hồi phiên khác |

Các route `/api/admin/*` yêu cầu **đăng nhập Admin** (và CSRF với thao tác ghi).

---

## 📦 Đóng gói thành `.exe` (Windows)

```bash
node Setting/js/build.js
```
Dùng **Node SEA** để nhúng `server.js` + `public/*` + `tray.ps1` vào một file `bin/MediaPlayer.exe` chạy độc lập (không cần cài Node trên máy đích). `MediaPlayer.bat` tự gọi bước này.

> Lưu ý: `bin/sea-config.json` đang chứa **đường dẫn tuyệt đối** theo máy của tác giả (`C:\Users\vanmanhgaming\...`). Khi build ở máy khác, `build.js` sẽ sinh lại cấu hình cho đúng đường dẫn.

---

## 🖧 Chạy nền trên VPS

Cài đặt tunnel 1 lần bằng terminal (`node start.js`), sau đó:

**PM2**
```bash
pm2 start start.js --name mediaplayer -- --host=media
pm2 save && pm2 startup
```

**systemd** (`/etc/systemd/system/mediaplayer.service`)
```ini
[Unit]
Description=Media Studio
After=network-online.target

[Service]
WorkingDirectory=/opt/mediaplayer
ExecStart=/usr/bin/node start.js --host=media
Restart=always
User=mediaplayer

[Install]
WantedBy=multi-user.target
```

**Windows:** tạo shortcut `MediaPlayer.bat` trong `shell:startup` để tự chạy cùng Windows.

---

## 🩺 Xử lý sự cố

| Triệu chứng | Cách xử lý |
|---|---|
| Web trống, báo thiếu cấu hình Drive | Kiểm tra `Setting/drive/oauth.json` hoặc `service-account.json`; xem `data/logs/server.log` |
| Không tìm thấy thư mục | Thư mục `WEB-Video` phải thuộc Drive của tài khoản đăng nhập (hoặc đã chia sẻ); thử đặt `GDRIVE_ROOT_FOLDER_ID` |
| Video không phát | Chuyển sang MP4 (H.264 + AAC) rồi tải lại |
| Tải lên báo lỗi dung lượng | Đang dùng Service Account → chuyển sang OAuth |
| Đăng nhập Google hết hạn sau 7 ngày | Chưa **Publish app** trong OAuth consent screen |
| `[LỖI] Cần Node.js >= 22.13` | Cập nhật Node.js |
| Thumbnail chậm / máy lag | Giảm `GDRIVE_THUMB_CONCURRENCY` xuống 3–4 |
| Tunnel không lên | `node Setting/js/tunnel.js status`, hoặc `node start.js --reconfig` |
| Exe cũ chạy code cũ | Build lại: `node Setting/js/build.js` |

---

## 🔐 Lưu ý quan trọng trước khi chia sẻ mã nguồn

Gói nén hiện có chứa một số file **nhạy cảm**. Trước khi đẩy lên GitHub / gửi cho người khác, hãy:

- ❌ **KHÔNG** commit: `Setting/.env` (chứa ID thư mục Drive), `Setting/drive/*.json` (`oauth.json`, `service-account.json`, `client_secret_*.json`), `Setting/cloudflare_Tunnel/cert.pem`, `Setting/cloudflare_Tunnel/credentials/`, thư mục `data/`.
- ✅ Thêm vào `.gitignore`:

```gitignore
Setting/.env
Setting/drive/*.json
Setting/cloudflare_Tunnel/
data/
bin/*.exe
bin/*.blob
node_modules/
```

- 🔄 Nếu đã lỡ chia sẻ `cert.pem` hoặc credentials tunnel: **thu hồi/tạo lại** trong Cloudflare Dashboard (hoặc `cloudflared tunnel delete`).
- 📝 Nên tạo `Setting/.env.example` với giá trị trống để người khác tham khảo.

---

## 👤 Tác giả & bản quyền

| | |
|---|---|
| **Dự án** | Media Studio / MediaPlayer — Video Tool Drive |
| **Phiên bản** | v30 (package `2.1.8`) |
| **Giấy phép** | *Chưa khai báo* — thêm file `LICENSE` (MIT, Apache-2.0, hoặc "All rights reserved") theo ý muốn của chủ sở hữu |

### 📇 Thông tin chủ sở hữu

* **Tên:** vanmanhgaming
* **Quốc gia:** Việt Nam 🇻🇳
* **Múi giờ:** UTC+07:00
* **Email:** [vanmanhgamingpro@gmail.com](mailto:vanmanhgamingpro@gmail.com)
* **Website:** [vmmc.io.vn](https://vmmc.io.vn/)
* **Facebook:** [fb.com/vmgpro.vmmc.io.vn](https://fb.com/vmgpro.vmmc.io.vn)
* **GitHub:** [vanmanhgamingpro-developer](https://github.com/vanmanhgamingpro-developer)
* **YouTube:** [@vanmanhgaming](https://www.youtube.com/@vanmanhgaming)
* **Discord:** [discord.com/users/1118923892732477691](https://discord.com/users/1118923892732477691)

© 2026 **@vanmanhgaming**. Mọi quyền được bảo lưu trừ khi có giấy phép khác đi kèm.

Mọi đóng góp, báo lỗi hoặc đề xuất tính năng vui lòng liên hệ trực tiếp **@vanmanhgaming** qua các kênh trên.
