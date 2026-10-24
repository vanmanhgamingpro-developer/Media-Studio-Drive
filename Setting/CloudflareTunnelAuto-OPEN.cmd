@echo off
setlocal EnableExtensions
cd /d "%~dp0"
:: Mo cua so setup bang quyen user thuong (khong can Admin).
start "Cloudflare Tunnel Setup" cmd.exe /c "%~dp0CloudflareTunnelAuto.bat" %*
exit /b
