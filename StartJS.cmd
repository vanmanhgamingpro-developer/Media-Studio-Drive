@echo off
chcp 65001 >nul
title MediaPlayer - chay bang Node.js
cd /d "%~dp0"
where node >nul 2>&1 || (echo Chua co Node.js 22.13+ - tai tai https://nodejs.org & pause & exit /b 1)
node start.js %*
pause
