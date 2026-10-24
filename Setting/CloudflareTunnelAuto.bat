@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title Cloudflare Tunnel - MediaPlayer Integration

:: ============================================================
:: CLOUDFLARE TUNNEL FOR MEDIAPLAYER
:: - Tự động tải cloudflared.exe
:: - Đăng nhập Cloudflare
:: - Tự xác định cổng MediaPlayer
:: - Tạo Named Tunnel
:: - Tạo DNS route
:: - Cài Windows Service
:: - Kiểm tra HTTPS public
:: ============================================================

if /I "%PROCESSOR_ARCHITECTURE%"=="x86" (
    if defined PROCESSOR_ARCHITEW6432 (
        set "ARCH=amd64"
    ) else (
        set "ARCH=386"
    )
) else if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" (
    set "ARCH=arm64"
) else (
    set "ARCH=amd64"
)

:: ----- Paths -----
cd /d "%~dp0.."
set "ROOT=%CD%"
set "SETTING=%ROOT%\Setting"
set "CF_DIR=%SETTING%\cloudflare_Tunnel"
set "BIN=%ROOT%\bin"
set "CF_BIN=%BIN%\cloudflared.exe"
set "CF_CREDS=%CF_DIR%\credentials"
set "CF_CONFIG=%CF_DIR%\config.yml"
set "CF_LOG=%CF_DIR%\logs"
set "CF_CERT=%CF_DIR%\cert.pem"
set "CF_ROOTDOM_FILE=%CF_DIR%\root-domain.txt"
set "ENV_FILE=%SETTING%\.env"
set "SERVICE=MediaPlayerCloudflareTunnel"
set "OLD_SERVICE=CloudflareTunnelAuto"

if not exist "%SETTING%" mkdir "%SETTING%"
if not exist "%CF_DIR%" mkdir "%CF_DIR%"
if not exist "%CF_CREDS%" mkdir "%CF_CREDS%"
if not exist "%CF_LOG%" mkdir "%CF_LOG%"
if not exist "%BIN%" mkdir "%BIN%"

:: THIET KE LAI: bat cloudflared LUON doc/ghi cert + credentials trong pham vi
:: du an (%CF_DIR%), KHONG dung %USERPROFILE%\.cloudflared nua. Bien moi truong
:: nay ap dung cho MOI lenh cloudflared goi ben duoi trong file .bat nay.
set "TUNNEL_ORIGIN_CERT=%CF_CERT%"

set "SETUP_LOG=%CF_LOG%\setup.log"
set "TUNNEL_LOG=%CF_LOG%\tunnel-run.log"
set "ERROR_LOG=%CF_LOG%\tunnel-error.log"
set "CREATE_LOG=%CF_LOG%\create-tunnel.log"

:: Doc mien chinh (root domain / zone) da luu tu lan chay truoc, neu co.
set "ROOT_DOMAIN="
if exist "%CF_ROOTDOM_FILE%" (
    set /p "ROOT_DOMAIN=" < "%CF_ROOTDOM_FILE%"
)

cls
echo === CLOUDFLARE TUNNEL - MEDIAPLAYER ===

set "FORCE=0"
if /I "%~1"=="reconfig" set "FORCE=1"
if /I "%~1"=="--reconfig" set "FORCE=1"
if "%FORCE%"=="0" (
    where node >nul 2>&1
    if not errorlevel 1 (
        node "%SETTING%\js\tunnel.js" ready >nul 2>&1
        if not errorlevel 1 (
            echo [OK] Tunnel da duoc cai san - bat luon, KHONG cai lai, KHONG xoa gi.
            echo      Muon cai lai / doi ten mien: chay  CloudflareTunnelAuto.bat reconfig
            node "%SETTING%\js\tunnel.js" start
            timeout /t 5 >nul
            exit /b 0
        )
    )
)

:: ----- Log function -----
call :log "[START] Bat dau cau hinh Cloudflare Tunnel cho MediaPlayer"

:: ----- DON DEP NGAY TU DAU: diet moi tien trinh/service cloudflared cu -----
:: Lam truoc TIEN, truoc ca buoc kiem tra Internet, de tranh 2 cloudflared.exe
:: (1 cai tu service cu dang chay nen + 1 cai script nay moi mo) tranh nhau
:: ket noi/cert gay treo may + CPU cao. Diet ca service moi "%SERVICE%" LAN
:: service cu "%OLD_SERVICE%" (vd tu ban .bat rieng ban da tung tu chay/test).
call :log "[0/10] Don dep tien trinh cloudflared cu"
taskkill /F /IM cloudflared.exe /T >nul 2>&1
sc.exe query "%SERVICE%" >nul 2>&1
if not errorlevel 1 echo [CANH BAO] Con service cu "%SERVICE%" ^(cai tu ban Admin cu^) - chay CloudflareTunnel-Uninstall.cmd 1 lan de go.

:: THIET KE LAI: xoa LUON ca cert.pem (giay chung nhan dang nhap Cloudflare cu).
:: Truoc day neu cert.pem con thi script se TU DONG bo qua buoc dang nhap va
:: KHONG mo trinh duyet de ban xac nhan lai zone/ten mien - day chinh la ly do
:: "van con lien ket mien cu" ban gap phai (cert cu co the dang gan voi mot
:: zone/ten mien khac). Gio MOI LAN chay se XOA cert cu, bat buoc dang nhap lai
:: tu dau va luon mo trinh duyet de ban tu tay xac nhan dung ten mien muon dung.
:: Cert nay gio nam TRONG du an (%CF_DIR%), khong con dung %USERPROFILE%\.cloudflared.
if exist "%CF_CERT%" (
    del /f /q "%CF_CERT%" >nul 2>&1
    call :log "[CLEANUP] Da xoa cert.pem cu trong du an - bat buoc dang nhap + chon lai ten mien tu dau"
)
:: Don luon cert cu (neu co) o vi tri mac dinh cua cloudflared, phong khi
:: mot lan chay truoc do lenh "login" da ghi nham vao day (xem giai thich o
:: buoc [3/10] ben duoi) - tranh viec vo tinh dung lai cert cu ngoai du an.
if exist "%USERPROFILE%\.cloudflared\cert.pem" (
    del /f /q "%USERPROFILE%\.cloudflared\cert.pem" >nul 2>&1
    rd "%USERPROFILE%\.cloudflared" >nul 2>&1
    call :log "[CLEANUP] Da xoa cert.pem cu ngoai du an (%%USERPROFILE%%\.cloudflared)"
)

:: ----- Don dep tunnel/ten mien CU (trong du an nay) truoc khi tao moi -----
:: (moi lan chay lai file nay se thay tunnel cu bang tunnel/ten mien moi,
::  khong de sot cau hinh/credential/ten mien cu lai trong may hay tren Cloudflare)
set "OLD_HOSTNAME="
set "OLD_TUNNEL_ID="
if exist "%CF_DIR%\tunnel-linked.json" (
    set "OLDLINK_TMP=%CF_DIR%\_old-link-read.tmp"
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "try{$j=Get-Content -Raw '%CF_DIR%\tunnel-linked.json' | ConvertFrom-Json; $j.hostname}catch{}" > "%OLDLINK_TMP%" 2>nul
    set "OLD_HOSTNAME="
    set /p "OLD_HOSTNAME=" < "%OLDLINK_TMP%"
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "try{$j=Get-Content -Raw '%CF_DIR%\tunnel-linked.json' | ConvertFrom-Json; $j.tunnelId}catch{}" > "%OLDLINK_TMP%" 2>nul
    set "OLD_TUNNEL_ID="
    set /p "OLD_TUNNEL_ID=" < "%OLDLINK_TMP%"
    del /f /q "%OLDLINK_TMP%" >nul 2>&1
)
if not "%OLD_HOSTNAME%"=="" (
    echo [INFO] Phat hien cau hinh cu trong du an: %OLD_HOSTNAME% ^(tunnel %OLD_TUNNEL_ID%^)
    echo [INFO] Dang don dep de thay bang ten mien moi...
    call :log "[BACKUP] Sao luu cau hinh cu: %OLD_HOSTNAME% / %OLD_TUNNEL_ID%"
    set "BK=%CF_DIR%\backup-%RANDOM%%RANDOM%"
    mkdir "!BK!" >nul 2>&1
    if exist "%CF_CONFIG%" copy /y "%CF_CONFIG%" "!BK!\" >nul 2>&1
    if exist "%CF_DIR%\tunnel-linked.json" copy /y "%CF_DIR%\tunnel-linked.json" "!BK!\" >nul 2>&1
    if defined OLD_TUNNEL_ID if exist "%CF_CREDS%\%OLD_TUNNEL_ID%.json" copy /y "%CF_CREDS%\%OLD_TUNNEL_ID%.json" "!BK!\" >nul 2>&1
    echo [INFO] Da SAO LUU cau hinh cu vao: !BK!   ^(khong xoa tunnel cu tren Cloudflare^)
    echo [OK] Xong buoc sao luu cau hinh cu.
    echo.
) else (
    echo [INFO] Khong co cau hinh tunnel cu trong du an nay.
    echo.
)

:: ----- Check Internet -----
echo [1/10] Kiem tra Internet...
call :log "[1/10] Kiem tra Internet..."
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try{$r=Invoke-WebRequest 'https://www.cloudflare.com' -UseBasicParsing -TimeoutSec 10; if($r.StatusCode -ge 200){exit 0}else{exit 1}}catch{exit 1}"
if errorlevel 1 (
    call :log "[LOI] Khong ket noi duoc Internet"
    echo [LOI] Khong ket noi duoc Internet.
    pause
    exit /b 1
)
echo [OK] Internet.
call :log "[OK] Internet"

:: ----- Download cloudflared if missing -----
echo [2/10] Kiem tra cloudflared...
call :log "[2/10] Kiem tra cloudflared..."
if exist "%CF_BIN%" goto CF_READY

echo [INFO] Dang tai cloudflared...
call :log "[INFO] Dang tai cloudflared cho %ARCH%..."

set "CF_URL=https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-%ARCH%.exe"
if "%ARCH%"=="386" set "CF_URL=https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-386.exe"
if "%ARCH%"=="arm64" set "CF_URL=https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-arm64.exe"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Invoke-WebRequest -Uri '%CF_URL%' -OutFile '%CF_BIN%' -UseBasicParsing -TimeoutSec 120"
if not exist "%CF_BIN%" (
    call :log "[LOI] Tai cloudflared that bai"
    echo [LOI] Tai cloudflared that bai.
    pause
    exit /b 1
)

:CF_READY
"%CF_BIN%" --version >nul 2>&1
if errorlevel 1 (
    call :log "[LOI] cloudflared.exe khong chay duoc"
    echo [LOI] cloudflared.exe khong chay duoc.
    pause
    exit /b 1
)
echo [OK] cloudflared san sang.
call :log "[OK] cloudflared san sang"

:: ----- Login -----
:: THIET KE LAI: LUON LUON mo trinh duyet de dang nhap + xac nhan chon zone/
:: ten mien, khong con cai nao bi "bo qua" ngam vi cert cu nua (cert cu da bi
:: xoa o buoc [0/10] o tren). Ban se thay trinh duyet Cloudflare hien ra o
:: buoc nay MOI LAN chay setup - day la thay doi CHINH ban yeu cau.
echo [3/10] Dang nhap Cloudflare - chon dung domain/zone tren trinh duyet.
echo        Neu trinh duyet khong tu mo, copy link ben duoi.
call :log "[3/10] Dang nhap Cloudflare (luon mo trinh duyet)..."
set "CERT=%CF_CERT%"
:: KHONG redirect toan bo output vao file log nhu truoc nua - de nguyen cho in
:: thang ra man hinh (real-time) de ban thay duoc link dang nhap va tu dan vao
:: trinh duyet neu no khong tu mo. (Khong dung pipe/tee de ghi log dong thoi -
:: tranh rui ro treo console nhu da gap voi cac lenh pipe truoc do.)
"%CF_BIN%" tunnel --origincert "%CF_CERT%" login
if errorlevel 1 (
    call :log "[LOI] Cloudflare login that bai"
    echo [LOI] Cloudflare login that bai.
    pause
    exit /b 1
)
call :log "[OK] cloudflared tunnel login hoan tat"

:: GIOI HAN CUA CLOUDFLARED: lenh "tunnel login" tu no van co the ghi cert vao
:: vi tri mac dinh (%USERPROFILE%\.cloudflared\cert.pem) BAT KE co --origincert
:: hay khong. Neu cert khong xuat hien trong du an nhung lai xuat hien o vi tri
:: mac dinh, chuyen (move) no VAO du an va xoa ban goc - dam bao KET QUA CUOI
:: CUNG cert chi ton tai trong pham vi du an, khong con luu ngoai %USERPROFILE%.
set "CF_DEFAULT_CERT=%USERPROFILE%\.cloudflared\cert.pem"
if not exist "%CERT%" if exist "%CF_DEFAULT_CERT%" (
    move /y "%CF_DEFAULT_CERT%" "%CERT%" >nul 2>&1
    call :log "[INFO] cloudflared da luu cert o vi tri mac dinh - da chuyen vao du an: %CERT%"
    rd "%USERPROFILE%\.cloudflared" >nul 2>&1
)

if not exist "%CERT%" (
    call :log "[LOI] Khong tim thay cert.pem"
    echo [LOI] Khong tim thay %CERT%
    echo [INFO] Hay dang nhap lai Cloudflare.
    pause
    exit /b 1
)
echo [OK] Da dang nhap Cloudflare.
call :log "[OK] Da dang nhap Cloudflare - cert: %CERT%"

:: ----- Detect MediaPlayer PORT -----
echo [4/10] Tu dong xac dinh cong MediaPlayer...
call :log "[4/10] Tu dong xac dinh cong MediaPlayer..."
set "PORT="

:: Đọc PORT từ Setting\.env
if exist "%ENV_FILE%" (
    for /f "usebackq tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
        set "LINE=%%A"
        set "VALUE=%%B"
        set "LINE=!LINE: =!"
        if /I "!LINE!"=="PORT" (
            set "VALUE=!VALUE: =!"
            set "VALUE=!VALUE:"=!"
            set "VALUE=!VALUE:'=!"
            set "PORT=!VALUE!"
        )
    )
)

if defined PORT (
    echo [OK] Phat hien PORT trong Setting\.env: !PORT!
    call :log "[OK] PORT tu .env: !PORT!"
    set "ORIGIN=http://127.0.0.1:!PORT!"
) else (
    echo [INFO] Khong tim thay PORT trong .env, dang do cac cong pho bien...
    call :log "[INFO] Do cong pho bien..."
    
    for %%P in (6556 80 443 3000 5000 5173 8000 8080 8081 8888 9000 10000) do (
        if not defined PORT (
            powershell -NoProfile -ExecutionPolicy Bypass -Command ^
              "$x=Get-NetTCPConnection -State Listen -LocalPort %%P -ErrorAction SilentlyContinue; if($x){exit 0}else{exit 1}"
            if not errorlevel 1 (
                if "%%P"=="443" (
                    set "ORIGIN=https://127.0.0.1:443"
                    set "PORT=443"
                ) else (
                    set "ORIGIN=http://127.0.0.1:%%P"
                    set "PORT=%%P"
                )
                echo [OK] Phat hien MediaPlayer dang chay tren cong %%P
                call :log "[OK] Do duoc cong: %%P"
            )
        )
    )
)

if not defined PORT (
    echo [CANH BAO] Khong tu dong tim thay MediaPlayer.
    echo [INFO] Mac dinh su dung cong 6556
    call :log "[CANH BAO] Khong tim thay cong, dung mac dinh 6556"
    set "ORIGIN=http://127.0.0.1:6556"
    set "PORT=6556"
)

:: ----- Hostname -----
call :log "[5/10] Nhap hostname..."
if defined ROOT_DOMAIN (
    echo [5/10] Ten mien: Enter = !ROOT_DOMAIN! ^| nhan ngan ^(abc^) = abc.!ROOT_DOMAIN! ^| hoac ten day du
) else (
    echo [5/10] Nhap ten mien day du da them vao Cloudflare ^(VD: media.example.com^)
)

:AskHostname
set "HOST_INPUT="
set /p "HOST_INPUT=Nhap ten mien/nhan ngan (Enter = mien chinh): "
set "HOST_INPUT=%HOST_INPUT: =%"
set "HOST_INPUT=%HOST_INPUT:http://=%"
set "HOST_INPUT=%HOST_INPUT:https://=%"
set "HOST_INPUT=%HOST_INPUT:/=%"
:: Bo dau cham thua o CUOI ten mien (loi go nham rat hay gap, vd go
:: "hentaiz." thay vi "hentaiz") - neu khong bo, script se hieu day
:: la MOT TEN MIEN CHINH MOI hoan toan khac, ghi de len mien chinh
:: dang dung va tao nham DNS route.
:TrimTrailingDot
if "%HOST_INPUT:~-1%"=="." (
    set "HOST_INPUT=%HOST_INPUT:~0,-1%"
    goto TrimTrailingDot
)

set "HOSTNAME="
set "DOMTYPE_NAME=MIEN PHU"
set "DOMTYPE=2"

:: QUAN TRONG: toan bo logic ben duoi CO CHU DICH viet PHANG, KHONG dung
:: if/else long nhau nhieu cap nua (dang if(...)else(...) chua if(...)else(...)
:: ben trong) - kieu long nhau + goto/call ben trong tung la nguyen nhan lam
:: CA CUA SO CMD DONG DOT NGOT ("vang") ngay sau khi nhan Enter tren mot so
:: may. Moi buoc kiem tra gio la MOT if don, khong long, dung goto de re nhanh.

if not "!HOST_INPUT!"=="" goto HN_HaveInput

:: --- Bo trong (Enter) -> dung mien chinh da luu ---
if defined ROOT_DOMAIN goto HN_UseRoot
echo [LOI] Chua co mien chinh de dung mac dinh. Vui long nhap ten mien day du.
goto AskHostname

:HN_UseRoot
set "HOSTNAME=!ROOT_DOMAIN!"
set "DOMTYPE=1"
set "DOMTYPE_NAME=MIEN CHINH"
goto HN_Done

:HN_HaveInput
:: Kiem tra co dau cham hay khong bang phep thay the chuoi thuan (KHONG dung
:: pipe "|" - tranh treo console UAC nhu da gap o cac buoc truoc).
if not "!HOST_INPUT!"=="!HOST_INPUT:.=!" goto HN_HasDot

:: --- Khong co dau cham -> la mot nhan ngan, tu dong ghep vao mien chinh ---
if defined ROOT_DOMAIN goto HN_AppendRoot
echo [LOI] "!HOST_INPUT!" khong co dau cham va chua co mien chinh de ghep vao.
echo [INFO] Lan dau vui long nhap MOT TEN MIEN DAY DU ^(VD: example.com^).
goto AskHostname

:HN_AppendRoot
set "HOSTNAME=!HOST_INPUT!.!ROOT_DOMAIN!"
set "DOMTYPE=2"
set "DOMTYPE_NAME=MIEN PHU"
goto HN_Done

:HN_HasDot
:: --- Co dau cham -> day la mot ten mien day du, dung nguyen nhu da nhap ---
set "HOSTNAME=!HOST_INPUT!"
if defined ROOT_DOMAIN goto HN_CheckRoot

:: Chua co mien chinh nao - lan dau, coi day la mien chinh
set "DOMTYPE=1"
set "DOMTYPE_NAME=MIEN CHINH"
set "ROOT_DOMAIN=!HOSTNAME!"
goto HN_Done

:HN_CheckRoot
if /I "!HOSTNAME!"=="!ROOT_DOMAIN!" goto HN_IsRoot

:: Kiem tra HOSTNAME co ket thuc bang ".ROOT_DOMAIN" hay khong, bang phep cat
:: chuoi thuan cua batch (KHONG dung pipe "|").
set "SUFFIX=.!ROOT_DOMAIN!"
call :StrLen "!SUFFIX!" SUFLEN
call set "HOST_TAIL=%%HOSTNAME:~-!SUFLEN!%%"
if /I "!HOST_TAIL!"=="!SUFFIX!" goto HN_IsSub

:: Khong thuoc mien chinh cu -> coi day la mien chinh moi
echo [CANH BAO] "!HOSTNAME!" khac mien chinh da luu ^(!ROOT_DOMAIN!^).
call :log "[CANH BAO] Doi mien chinh: !ROOT_DOMAIN! -> !HOSTNAME!"
choice /C YN /N /M "Dung ten mien moi nay? (Y = dong y, N = nhap lai): "
if errorlevel 2 goto AskHostname
set "DOMTYPE=1"
set "DOMTYPE_NAME=MIEN CHINH"
set "ROOT_DOMAIN=!HOSTNAME!"
goto HN_Done

:HN_IsRoot
set "DOMTYPE=1"
set "DOMTYPE_NAME=MIEN CHINH"
goto HN_Done

:HN_IsSub
set "DOMTYPE=2"
set "DOMTYPE_NAME=MIEN PHU"

:HN_Done
if "!HOSTNAME!"=="" (
    call :log "[LOI] Chua nhap hostname"
    echo [LOI] Chua nhap hostname.
    pause
    exit /b 1
)

:: Luu mien chinh de cac lan chay sau dung lai (Enter = mac dinh)
if defined ROOT_DOMAIN (
    > "%CF_ROOTDOM_FILE%" echo !ROOT_DOMAIN!
)

call :log "[INFO] Loai ten mien: !DOMTYPE_NAME! - Hostname: !HOSTNAME!"

:: Kiểm tra hostname hợp lệ (dung PowerShell -match, KHONG dung "echo | findstr"
:: vi lenh pipe "|" nay tung gay treo cua so cmd chay nang quyen qua UAC tren
:: mot so may - cung loai loi da tung gap o buoc dem dau cham phia tren).
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "if ('%HOSTNAME%' -match '^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'){exit 0}else{exit 1}"
if errorlevel 1 (
    call :log "[CANH BAO] Hostname co the khong hop le: %HOSTNAME%"
    echo [CANH BAO] Hostname co the khong hop le, nhung se tiep tuc...
)

echo [OK] Hostname: %HOSTNAME%
echo [OK] Loai ten mien: %DOMTYPE_NAME%
call :log "[OK] Hostname: %HOSTNAME%"

:: ----- Ten Tunnel: cho phep NGUOI DUNG tu dat ten, khong con tu dong
:: dat ma khong hoi nua. Enter = dung ten tu sinh nhu truoc day.
set "SAFE=%HOSTNAME:.=-%"
set "SAFE=%SAFE:/=-%"
set "SAFE=%SAFE:\=-%"
set "SAFE=%SAFE::=-%"
set "AUTO_TUNNEL_NAME=auto-%SAFE%"
if not "%AUTO_TUNNEL_NAME:~0,50%"=="%AUTO_TUNNEL_NAME%" set "AUTO_TUNNEL_NAME=%AUTO_TUNNEL_NAME:~0,50%"

call :log "[5b/10] Hoi ten tunnel..."
set "TUNNEL_INPUT="
set /p "TUNNEL_INPUT=[5b/10] Ten tunnel (Enter = %AUTO_TUNNEL_NAME%): "
if "!TUNNEL_INPUT!"=="" goto TN_UseAuto

:: Truyen ten qua bien moi truong (khong noi chuoi truc tiep vao lenh
:: PowerShell) de tranh loi neu ten co ky tu dac biet/dau nhay - day la
:: nguyen nhan khien ten tu go bi bo qua va roi lai dung ten "auto-..."
:: ma khong bao loi gi ca.
set "TUNNAME_TMP=%CF_DIR%\_tunnelname.tmp"
set "TUNNEL_INPUT_RAW=!TUNNEL_INPUT!"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s=$env:TUNNEL_INPUT_RAW; $s=$s -replace '[^a-zA-Z0-9-]','-'; $s=$s.Trim('-'); Write-Output $s" > "%TUNNAME_TMP%" 2>>"%SETUP_LOG%"
set "TUNNEL="
set /p "TUNNEL=" < "%TUNNAME_TMP%"
del /f /q "%TUNNAME_TMP%" >nul 2>&1
if "!TUNNEL!"=="" (
    echo [CANH BAO] Ten "!TUNNEL_INPUT!" khong hop le sau khi lam sach, dung ten tu dong thay the.
    call :log "[CANH BAO] Ten tunnel nhap vao khong hop le: !TUNNEL_INPUT!"
    goto TN_UseAuto
)
if not "!TUNNEL:~0,50!"=="!TUNNEL!" set "TUNNEL=!TUNNEL:~0,50!"
goto TN_Done

:TN_UseAuto
set "TUNNEL=%AUTO_TUNNEL_NAME%"

:TN_Done
echo [OK] Ten tunnel: %TUNNEL%
call :log "[OK] Ten tunnel: %TUNNEL%"

:: ----- Create tunnel -----
echo [6/10] Tao Cloudflare Tunnel...
call :log "[6/10] Tao Cloudflare Tunnel: %TUNNEL%"

:: Moi credential JSON moi se duoc cloudflared ghi THANG vao %CF_CREDS% (trong
:: du an) qua --credentials-file, khong con roi vao %USERPROFILE%\.cloudflared
:: nua. Dat ten tam vi luc tao chua biet Tunnel ID.
set "NEWCRED=%CF_CREDS%\_new-%RANDOM%.json"

"%CF_BIN%" tunnel --origincert "%CF_CERT%" info "%TUNNEL%" >"%CREATE_LOG%" 2>&1
if errorlevel 1 goto CreateTunnelNew

:: Tunnel cung ten da co tren Cloudflare: chi tai su dung neu con file credential
:: cua no trong du an. Neu mat credential (vd da xoa thu muc) thi xoa tunnel do
:: va tao lai - khong the khoi phuc credential cua tunnel cu.
call :GetTunnelId
if not defined TUNNEL_ID goto RecreateTunnel
if exist "%CF_CREDS%\%TUNNEL_ID%.json" goto TunnelReuse

:RecreateTunnel
echo [INFO] Tunnel "%TUNNEL%" da co nhung thieu credential - xoa va tao lai...
call :log "[INFO] Xoa tunnel cu thieu credential: %TUNNEL%"
"%CF_BIN%" tunnel --origincert "%CF_CERT%" delete -f "%TUNNEL%" >>"%CREATE_LOG%" 2>&1

:CreateTunnelNew
call :log "[INFO] Tao tunnel moi: %TUNNEL%"
"%CF_BIN%" tunnel --origincert "%CF_CERT%" create --credentials-file "%NEWCRED%" "%TUNNEL%" >>"%CREATE_LOG%" 2>&1
if not errorlevel 1 goto TunnelCreated
set "RND=%RANDOM%"
set "TUNNEL=%TUNNEL%-!RND!"
call :log "[INFO] Ten trung, thu lai: !TUNNEL!"
echo [INFO] Thu ten: !TUNNEL!
"%CF_BIN%" tunnel --origincert "%CF_CERT%" create --credentials-file "%NEWCRED%" "!TUNNEL!" >>"%CREATE_LOG%" 2>&1
if not errorlevel 1 goto TunnelCreated
call :log "[LOI] Khong tao duoc tunnel"
echo [LOI] Khong tao duoc tunnel.
type "%CREATE_LOG%"
pause
exit /b 1

:TunnelCreated
echo [OK] Da tao tunnel: %TUNNEL%
goto TunnelReady

:TunnelReuse
call :log "[OK] Tunnel da ton tai, tai su dung"
echo [OK] Tunnel da ton tai, tai su dung.

:TunnelReady

:: ----- Xac dinh Tunnel ID (hoan toan trong pham vi du an) -----
echo [7/10] Lay Tunnel ID va credential...
call :log "[7/10] Lay Tunnel ID va credential..."
call :GetTunnelId

if not defined TUNNEL_ID (
    call :log "[LOI] Khong lay duoc Tunnel ID"
    echo [LOI] Khong lay duoc Tunnel ID cua tunnel "%TUNNEL%".
    echo [INFO] Chi tiet loi ^(neu co^) da duoc ghi vao: %SETUP_LOG%
    pause
    exit /b 1
)
echo [OK] Tunnel ID: %TUNNEL_ID%
call :log "[OK] Tunnel ID: %TUNNEL_ID%"

if exist "%NEWCRED%" (
    move /y "%NEWCRED%" "%CF_CREDS%\%TUNNEL_ID%.json" >nul
) else if not exist "%CF_CREDS%\%TUNNEL_ID%.json" (
    call :log "[LOI] Khong tim thay credential trong du an: %CF_CREDS%\%TUNNEL_ID%.json"
    echo [LOI] Khong tim thay file credential cua tunnel trong du an ^(%CF_CREDS%^).
    echo [INFO] Neu tunnel nay duoc tao boi ban script cu ^(luu o %%USERPROFILE%%^),
    echo        hay xoa tunnel do tren dashboard Cloudflare roi chay lai buoc nay
    echo        de tao moi hoan toan trong pham vi du an.
    pause
    exit /b 1
)

:: ----- Create config.yml -----
echo [8/10] Tao config.yml...
call :log "[8/10] Tao config.yml..."
:: Bat dau file log MOI cho lan setup nay (thay vi cong don mai vao file
:: cu qua nhieu lan chay) - giup log gon, de doc, chi con log cua lan
:: ket noi gan nhat.
if exist "%TUNNEL_LOG%" del /f /q "%TUNNEL_LOG%" >nul 2>&1

> "%CF_CONFIG%" (
    echo tunnel: %TUNNEL_ID%
    echo credentials-file: %CF_CREDS%\%TUNNEL_ID%.json
    echo.
    echo ingress:
    echo   - hostname: %HOSTNAME%
    echo     service: %ORIGIN%
    echo   - service: http_status:404
    echo.
    echo loglevel: warn
    echo logfile: %TUNNEL_LOG%
    echo protocol: http2
)

"%CF_BIN%" --config "%CF_CONFIG%" tunnel ingress validate >>"%SETUP_LOG%" 2>&1
if errorlevel 1 (
    call :log "[LOI] Config ingress khong hop le"
    echo [LOI] Config ingress khong hop le.
    type "%CF_CONFIG%"
    pause
    exit /b 1
)
echo [OK] Config ingress hop le.
call :log "[OK] Config hop le"

:: ----- Add DNS Route -----
echo [9/10] Tao DNS route: %HOSTNAME% =^> %TUNNEL%
call :log "[9/10] Tao DNS route..."

set "ROUTE_LOG=%CF_LOG%\route-dns.log"
"%CF_BIN%" tunnel --origincert "%CF_CERT%" route dns --overwrite-dns "%TUNNEL%" "%HOSTNAME%" >"%ROUTE_LOG%" 2>&1
type "%ROUTE_LOG%" >> "%SETUP_LOG%"
if errorlevel 1 (
    call :log "[CANH BAO] ADD ROUTE that bai - xem %ROUTE_LOG%"
    echo.
    echo [CANH BAO] ADD ROUTE LOI - day la ly do MIEN PHU chua lien ket duoc
    echo            voi MIEN CHINH. Chi tiet loi tu Cloudflare:
    echo ----------------------------------------------------------
    type "%ROUTE_LOG%"
    echo ----------------------------------------------------------
    echo.
    echo Nguyen nhan thuong gap:
    echo - "%HOSTNAME%" khong nam trong ZONE ban da chon o buoc [3/10]
    echo   dang nhap ^(vd: ban chon zone "example.com" nhung mien phu lai
    echo   thuoc mot ten mien KHAC^). Cach sua: chay lai script, o buoc
    echo   dang nhap hay chon dung zone chua "%HOSTNAME%".
    echo - DNS record trung ten da ton tai tren Cloudflare Dashboard ^> DNS
    echo   va dang tro sang noi khac - vao xoa record trung roi chay lai.
    echo - Tai khoan Cloudflare khong co quyen sua DNS cho zone nay.
    echo.
    echo Se van tiep tuc cai Windows Service, nhung ban CAN sua loi tren
    echo thi mien phu moi truy cap duoc.
    echo.
) else (
    echo [OK] ADD ROUTE THANH CONG - "%HOSTNAME%" da lien ket vao zone.
    call :log "[OK] DNS route da tao"
)


:: ----- Windows service -----
echo [10/10] Chay tunnel an, quyen user (khong can Admin)...
call :log "[10/10] Chay cloudflared an (quyen user)"
taskkill /F /IM cloudflared.exe /T >nul 2>&1
if exist "%CF_DIR%\disabled.flag" del /f /q "%CF_DIR%\disabled.flag" >nul 2>&1
set CF_ARGS=--no-autoupdate --config "%CF_CONFIG%" tunnel run %TUNNEL_ID%
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath $env:CF_BIN -ArgumentList $env:CF_ARGS -WindowStyle Hidden"
timeout /t 4 /nobreak >nul
powershell -NoProfile -Command "if(Get-Process cloudflared -ErrorAction SilentlyContinue){exit 0}else{exit 1}"
if errorlevel 1 (
    call :log "[LOI] cloudflared khong chay"
    echo [LOI] cloudflared khong chay duoc. Xem log: %TUNNEL_LOG%
    pause
    exit /b 1
)
echo [OK] Tunnel dang chay.
call :log "[OK] cloudflared dang chay"

:: ----- Save configuration to MediaPlayer -----
call :log "[INFO] Luu cau hinh vao MediaPlayer..."

:: Ghi hostname vào Setting\.env (LUON THAY the dong cu, khong cong don ten mien cu)
if exist "%ENV_FILE%" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$f='%ENV_FILE%'; $c=''; for($i=0;$i -lt 10;$i++){ try{ $c=[IO.File]::ReadAllText($f); break }catch{ Start-Sleep -Milliseconds 300 } }; $c=[regex]::Replace($c,'(?m)^\s*#?\s*CLOUDFLARE_HOSTNAME=.*\r?\n?',''); $c=$c.TrimEnd()+\"`r`n# Cloudflare Tunnel hostname`r`nCLOUDFLARE_HOSTNAME=%HOSTNAME%`r`n\"; for($i=0;$i -lt 10;$i++){ try{ [IO.File]::WriteAllText($f,$c,(New-Object Text.UTF8Encoding $false)); break }catch{ Start-Sleep -Milliseconds 300 } }"
) else (
    >> "%ENV_FILE%" echo CLOUDFLARE_HOSTNAME=%HOSTNAME%
)

:: Tạo các file trạng thái
> "%CF_DIR%\tunnel-linked.json" (
    echo {"tunnelId":"%TUNNEL_ID%","hostname":"%HOSTNAME%","created":"%DATE% %TIME%"}
)

> "%CF_DIR%\Cloudflare_Tunnel.json" (
    echo {"tunnel":"%TUNNEL%","tunnelId":"%TUNNEL_ID%","hostname":"%HOSTNAME%","origin":"%ORIGIN%"}
)

> "%CF_DIR%\setup-state.json" (
    echo {"status":"completed","timestamp":"%DATE% %TIME%","hostname":"%HOSTNAME%"}
)

> "%CF_DIR%\tunnel-state.json" (
    echo {"status":"running","tunnelId":"%TUNNEL_ID%"}
)

where node >nul 2>&1 && node "%SETTING%\js\tunnel.js" save

:: ----- Status -----
echo --- KET QUA ---
echo Hostname : %HOSTNAME% ^(%DOMTYPE_NAME%^)
echo Origin   : %ORIGIN%
echo Tunnel   : %TUNNEL% ^(%TUNNEL_ID%^)
call :log "[KET QUA] Hostname=%HOSTNAME%, TunnelID=%TUNNEL_ID%"

:: ----- Online test (log tunnel o muc warn: chi hien khi co canh bao/loi) -----
call :log "[TEST] Kiem tra HTTPS public..."
echo [TEST] Dang cho tunnel khoi dong va kiem tra HTTPS...
timeout /t 8 /nobreak >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$u='https://%HOSTNAME%'; $max=60; $ok=$false; for($i=0;$i -lt $max;$i++){try{$r=Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 10; if($r.StatusCode -eq 200){Write-Host ('[OK] HTTP 200 - '+$u) -ForegroundColor Green; $ok=$true; break}else{Write-Host ('HTTP '+$r.StatusCode)}}catch{Start-Sleep -Seconds 2}}; if(-not $ok){Write-Host ('[CANH BAO] Chua truy cap duoc '+$u+' (DNS propagation hoac MediaPlayer chua chay)')}"

start "" "https://%HOSTNAME%"

:: Save result
> "%CF_DIR%\result.json" (
    echo {"success":true,"hostname":"%HOSTNAME%","tunnelId":"%TUNNEL_ID%","timestamp":"%DATE% %TIME%"}
)

call :log "[SUCCESS] Hoan tat cau hinh Cloudflare Tunnel"

echo === HOAN TAT: https://%HOSTNAME% ===
echo Bat/Tat tunnel: menu khay he thong ^> Cloudflare Tunnel - Bat/Tat
pause
endlocal
exit /b 0

:log
set "MSG=%~1"
echo %DATE% %TIME% %MSG% >> "%SETUP_LOG%"
exit /b

:StopAndDeleteService
set "_SVC=%~1"
sc.exe query "%_SVC%" >nul 2>&1
if errorlevel 1 exit /b 0
echo    Dang dung/xoa service %_SVC% ...
sc.exe stop "%_SVC%" >nul 2>&1
set "_W=0"
:StopAndDeleteService_wait
:: Khong dung pipe "|" o day (co the treo trong cua so cmd chay qua UAC
:: RunAs tren mot so may) - dung PowerShell Get-Service de kiem tra thay.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try{$s=Get-Service -Name '%_SVC%' -ErrorAction Stop; if($s.Status -eq 'Stopped'){exit 0}else{exit 1}}catch{exit 0}"
if not errorlevel 1 goto StopAndDeleteService_done
set /a "_W+=1"
if %_W% GEQ 10 goto StopAndDeleteService_done
timeout /t 1 /nobreak >nul
goto StopAndDeleteService_wait
:StopAndDeleteService_done
sc.exe delete "%_SVC%" >nul 2>&1
exit /b 0

:StrLen
setlocal EnableDelayedExpansion
set "_S=%~1"
set "_LEN=0"
:StrLen_loop
if defined _S (
    set "_S=!_S:~1!"
    set /a "_LEN+=1"
    goto StrLen_loop
)
endlocal & set "%~2=%_LEN%"
exit /b 0

:GetTunnelId
set "TUNNEL_ID="
set "TUNID_TMP=%CF_DIR%\_tunnel-id-read.tmp"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try{$list = & '%CF_BIN%' tunnel --origincert '%CF_CERT%' list -o json; $j = $list | ConvertFrom-Json; $t = $j | Where-Object { $_.name -eq '%TUNNEL%' } | Select-Object -First 1; if($t){ $t.id }}catch{}" > "%TUNID_TMP%" 2>>"%SETUP_LOG%"
set /p "TUNNEL_ID=" < "%TUNID_TMP%"
del /f /q "%TUNID_TMP%" >nul 2>&1
exit /b 0
