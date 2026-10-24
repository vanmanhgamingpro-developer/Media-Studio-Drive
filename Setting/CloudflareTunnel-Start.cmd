@echo off
setlocal EnableExtensions
title Start Cloudflare Tunnel
cd /d "%~dp0.."
set "ROOT=%CD%"
set "CF_DIR=%ROOT%\Setting\cloudflare_Tunnel"
set "CF_BIN=%ROOT%\bin\cloudflared.exe"
if not exist "%CF_DIR%\config.yml" (
    echo [LOI] Chua cau hinh tunnel. Chay CloudflareTunnelAuto.bat truoc.
    pause
    exit /b 1
)
if exist "%CF_DIR%\disabled.flag" del /f /q "%CF_DIR%\disabled.flag" >nul 2>&1
taskkill /F /IM cloudflared.exe /T >nul 2>&1
set CF_ARGS=--no-autoupdate --config "%CF_DIR%\config.yml" tunnel run
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath $env:CF_BIN -ArgumentList $env:CF_ARGS -WindowStyle Hidden"
echo [OK] Da bat Cloudflare Tunnel (chay an, quyen user).
timeout /t 2 /nobreak >nul
