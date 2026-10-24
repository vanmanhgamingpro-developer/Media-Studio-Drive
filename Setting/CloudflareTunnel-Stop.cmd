@echo off
setlocal EnableExtensions
title Stop Cloudflare Tunnel
cd /d "%~dp0.."
set "CF_DIR=%CD%\Setting\cloudflare_Tunnel"
> "%CF_DIR%\disabled.flag" echo off
taskkill /F /IM cloudflared.exe /T >nul 2>&1
echo [OK] Da tat Cloudflare Tunnel.
timeout /t 2 /nobreak >nul
