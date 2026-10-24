@echo off
setlocal EnableExtensions
title Cloudflare Tunnel Status

cd /d "%~dp0.."
set "ROOT=%CD%"
set "SETTING=%ROOT%\Setting"
set "CF_DIR=%SETTING%\cloudflare_Tunnel"
set "SERVICE=MediaPlayerCloudflareTunnel"
set "BIN=%ROOT%\bin\cloudflared.exe"

echo.
echo ==========================================================
echo        CLOUDFLARE TUNNEL - TRANG THAI
echo ==========================================================
echo.

:: Kiểm tra service
echo [0] TIEN TRINH cloudflared:
tasklist /FI "IMAGENAME eq cloudflared.exe" /NH
echo.
echo [1] WINDOWS SERVICE cu ^(neu con^):
sc.exe query "%SERVICE%" 2>nul
if errorlevel 1 (
    echo    Service chua duoc cai dat
    echo.
) else (
    sc.exe query "%SERVICE%" | findstr /I "STATE DISPLAY_NAME"
    echo.
)

:: Kiểm tra config files
echo [2] CAU HINH:
if exist "%CF_DIR%\config.yml" (
    echo    + config.yml: [OK]
) else (
    echo    - config.yml: [KHONG TON TAI]
)

if exist "%CF_DIR%\result.json" (
    echo    + result.json: [OK]
    type "%CF_DIR%\result.json" 2>nul
) else (
    echo    - result.json: [KHONG TON TAI]
)
echo.

:: Kiểm tra logs
echo [3] LOGS:
if exist "%CF_DIR%\logs\tunnel-run.log" (
    echo    Log moi nhat (10 dong):
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "Get-Content '%CF_DIR%\logs\tunnel-run.log' -Tail 10 -ErrorAction SilentlyContinue"
) else (
    echo    Chua co log file
)
echo.

:: Kiểm tra cloudflared
echo [4] CLOUDFLARED:
if exist "%BIN%" (
    "%BIN%" --version 2>nul
    if errorlevel 1 (
        echo    cloudflared.exe ton tai nhung khong chay duoc
    )
) else (
    echo    cloudflared.exe chua duoc tai
)
echo.

echo ==========================================================
echo.
echo Lenh huu ich:
echo   - Khoi dong: sc start %SERVICE%
echo   - Dung lai: sc stop %SERVICE%
echo   - Xem log: notepad %CF_DIR%\logs\tunnel-run.log
echo   - Cau hinh lai: CloudflareTunnelAuto-OPEN.cmd
echo.

pause
endlocal
