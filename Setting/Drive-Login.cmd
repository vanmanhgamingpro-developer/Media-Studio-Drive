@echo off
chcp 65001 >nul
title Dang nhap Google Drive
cd /d "%~dp0js"
set "NODEEXE=node"
where node >nul 2>&1 || set "NODEEXE=%~dp0..\runtime\node\node.exe"
"%NODEEXE%" drive-auth.js
echo.
pause
