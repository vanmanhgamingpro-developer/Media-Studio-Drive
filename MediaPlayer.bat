@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title MediaPlayer - One Click Launcher
mode con: cols=130 lines=45
cd /d "%~dp0"
set "ROOT=%~dp0"
set "BIN=%ROOT%bin"
set "SETTING=%ROOT%Setting"
set "PS1DIR=%SETTING%\ps1"
set "DIST=%SETTING%\dist"
set "ENV=%SETTING%\.env"
set "APP=%BIN%\MediaPlayer.exe"
set "FONTPS1=%PS1DIR%\Set-ConsoleFont.ps1"

if not exist "%SETTING%" mkdir "%SETTING%" >nul 2>&1
if not exist "%PS1DIR%" mkdir "%PS1DIR%" >nul 2>&1
if exist "%FONTPS1%" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%FONTPS1%" >nul 2>&1
if not exist "%ENV%" (
  >"%ENV%" echo PORT=6556
)

echo.
echo ================================================================
echo   MEDIA PLAYER - ONE CLICK LAUNCHER  (chi chay WEB)
echo ================================================================

echo [1/2] Dung phien ban cu...
taskkill /F /IM MediaPlayer.exe /T >nul 2>&1
taskkill /F /IM MediaPlayer-console.exe /T >nul 2>&1

rem build.js se tu ghi de bin\MediaPlayer.exe, khong can xoa ca thu muc bin.
mkdir "%BIN%" >nul 2>&1

:: doc PORT tu Setting\.env (mac dinh 6556)
set "WEBPORT=6556"
if exist "%ENV%" for /f "usebackq tokens=1,2 delims==" %%A in ("%ENV%") do if /I "%%A"=="PORT" if not "%%B"=="" set "WEBPORT=%%B"

:: log khoi dong rieng (stdout/stderr cua node) + file ".ready" (server.js tu ghi ra NGAY KHI
:: da mo cong web xong) - de .bat biet CHINH XAC luc nao web that su san sang, khong doan mo.
set "DATADIR=%ROOT%data"
set "STARTLOG=%DATADIR%\logs"
mkdir "%STARTLOG%" >nul 2>&1
set "OUTLOG=%STARTLOG%\startup.out.log"
set "ERRLOG=%STARTLOG%\startup.err.log"
set "READYFILE=%DATADIR%\.ready"
del /f /q "%OUTLOG%" "%ERRLOG%" "%READYFILE%" >nul 2>&1

echo [2/2] Khoi dong MediaPlayer...
call :ensure_node
if errorlevel 1 goto app_fail

echo [OK] Dang khoi dong (chay ngam)...
rem MediaPlayer chay AN hoan toan, KHONG con cua so CMD nao hien len nua.
rem Dieu khien hoan toan qua ICON KHAY HE THONG (goc duoi ben phai man hinh,
rem chuot phai de xem menu: Start/Stop/Restart, mo Web/Admin, xem Log, Thoat...).
rem Dung VBScript (co san tren moi ban Windows, KHONG can PowerShell) de mo node
rem HOAN TOAN AN - nhanh va chac chan hon goi powershell.exe (PowerShell co the bi
rem cham/bi phan mem diet virus quet moi lan mo, de gay treo .bat).
set "RUNCMD=%DATADIR%\mp_run.cmd"
> "%RUNCMD%" echo @echo off
>> "%RUNCMD%" echo cd /d "%ROOT%"
>> "%RUNCMD%" echo "%NODEEXE%" "%SETTING%\js\server.js" ^> "%OUTLOG%" 2^> "%ERRLOG%"

set "VBS=%TEMP%\mp_run_%RANDOM%.vbs"
> "%VBS%" echo Set sh = CreateObject("WScript.Shell")
>> "%VBS%" echo sh.Run "cmd.exe /c " ^& Chr(34) ^& "%RUNCMD%" ^& Chr(34), 0, False
cscript //nologo "%VBS%" >nul 2>&1
del /f /q "%VBS%" >nul 2>&1

:: cho web that su san sang bang cach doi file "%READYFILE%" (server.js tu tao ra ngay khi
:: mo cong xong) - KHONG mo tien trinh phu nao de kiem tra, nen khong the lam treo .bat.
set "UPOK=0"
for /l %%i in (1,1,40) do (
  if exist "%READYFILE%" (set "UPOK=1" & goto :up_done)
  timeout /t 1 /nobreak >nul
)
:up_done

echo.
if "%UPOK%"=="1" (
  echo ================================================================
  echo [OK] MEDIA PLAYER DA CHAY  -  http://127.0.0.1:%WEBPORT%
  echo Icon o goc duoi ben phai - Chuot phai de xem menu ^(Stop/Restart/Thoat...^)
  echo Cua so nay se tu dong dong sau vai giay.
  echo ================================================================
  timeout /t 3 /nobreak >nul
  exit
) else (
  echo ================================================================
  echo [LOI] MediaPlayer KHONG len web duoc sau 40 giay.
  echo Co the Node bi loi ngay khi khoi dong. Noi dung loi ^(neu co^):
  echo ----------------------------------------------------------------
  type "%ERRLOG%" 2>nul
  type "%OUTLOG%" 2>nul
  echo ----------------------------------------------------------------
  echo Xem them: %OUTLOG%  va  %ERRLOG%
  echo Cong dang dat trong Setting\.env la %WEBPORT% - co the da co chuong trinh
  echo khac dung cong nay, hoac thieu module/goi can thiet.
  echo ================================================================
  pause
  exit /b 1
)

:ensure_node
set "NODEEXE="
where node >nul 2>&1
if not errorlevel 1 (
  for /f "delims=" %%V in ('node -p "process.versions.node" 2^>nul') do set "SYSTEMNODE=%%V"
  for /f "tokens=1,2 delims=." %%A in ("!SYSTEMNODE!") do set "NM=%%A" & set "NN=%%B"
  if defined NM if !NM! GTR 22 set "NODEEXE=node"
  if defined NM if !NM! EQU 22 if defined NN if !NN! GEQ 13 set "NODEEXE=node"
)
if defined NODEEXE exit /b 0

set "RUNTIME=%ROOT%runtime\node"
set "NODEEXE=%RUNTIME%\node.exe"
if exist "%NODEEXE%" exit /b 0
mkdir "%RUNTIME%" >nul 2>&1
set "NODEZIP=%RUNTIME%\node.zip"
set "NODEURL="
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "NODEURL=https://nodejs.org/dist/v22.22.2/node-v22.22.2-win-arm64.zip"
if /I "%PROCESSOR_ARCHITECTURE%"=="AMD64" set "NODEURL=https://nodejs.org/dist/v22.22.2/node-v22.22.2-win-x64.zip"
if /I "%PROCESSOR_ARCHITECTURE%"=="x86" set "NODEURL=https://nodejs.org/dist/v22.22.2/node-v22.22.2-win-x86.zip"
if not defined NODEURL set "NODEURL=https://nodejs.org/dist/v22.22.2/node-v22.22.2-win-x64.zip"
echo       Dang tai Node.js portable...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing -Uri '%NODEURL%' -OutFile '%NODEZIP%'; Expand-Archive -Force '%NODEZIP%' '%RUNTIME%'; $d=Get-ChildItem '%RUNTIME%' -Directory | Where-Object {$_.Name -like 'node-v22.22.2-*'} | Select-Object -First 1; if($d){Get-ChildItem $d.FullName -Force | Move-Item -Destination '%RUNTIME%' -Force}; Remove-Item '%RUNTIME%\node-v22.22.2-*' -Recurse -Force -ErrorAction SilentlyContinue; Remove-Item '%NODEZIP%' -Force -ErrorAction SilentlyContinue"
if errorlevel 1 exit /b 1
if not exist "%NODEEXE%" exit /b 1
exit /b 0

:app_fail
echo [LOI] Khong tao/khoi dong duoc MediaPlayer.exe.
pause
exit /b 1
