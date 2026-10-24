@echo off
setlocal EnableExtensions
title Uninstall Cloudflare Tunnel

:: Chi can Admin de go service CU (neu con); khong co service thi chay quyen user.
net session >nul 2>&1
if "%errorlevel%"=="0" goto AdminOk
sc.exe query "MediaPlayerCloudflareTunnel" >nul 2>&1
if errorlevel 1 goto AdminOk
echo [INFO] Con service cu, can Admin 1 lan de go bo...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
exit /b
:AdminOk

cd /d "%~dp0.."
set "ROOT=%CD%"
set "SETTING=%ROOT%\Setting"
set "CF_DIR=%SETTING%\cloudflare_Tunnel"
set "SERVICE=MediaPlayerCloudflareTunnel"
set "OLD_SERVICE=CloudflareTunnelAuto"
set "BIN=%ROOT%\bin\cloudflared.exe"

cls
echo.
echo ==========================================================
echo        GO BO CLOUDFLARE TUNNEL
echo ==========================================================
echo.
echo Chuong trinh nay se:
echo   1. Dung va xoa Windows Service
echo   2. Xoa cau hinh va log (tuy chon)
echo   3. Xoa cloudflared.exe (tuy chon)
echo.
echo LUU Y: Tunnel tren Cloudflare Dashboard van ton tai.
echo        Ban co the xoa thu cong neu khong dung nua.
echo.
pause

echo.
echo [1/4] Dung va xoa Windows Service...

:: Stop and delete new service
sc.exe query "%SERVICE%" >nul 2>&1
if not errorlevel 1 (
    echo    Dang dung %SERVICE%...
    sc.exe stop "%SERVICE%" >nul 2>&1
    timeout /t 3 /nobreak >nul
    echo    Dang xoa %SERVICE%...
    sc.exe delete "%SERVICE%" >nul 2>&1
    echo    [OK] Da xoa %SERVICE%
) else (
    echo    [INFO] %SERVICE% khong ton tai
)

:: Stop and delete old service if exists
sc.exe query "%OLD_SERVICE%" >nul 2>&1
if not errorlevel 1 (
    echo    Dang dung %OLD_SERVICE%...
    sc.exe stop "%OLD_SERVICE%" >nul 2>&1
    timeout /t 2 /nobreak >nul
    echo    Dang xoa %OLD_SERVICE%...
    sc.exe delete "%OLD_SERVICE%" >nul 2>&1
    echo    [OK] Da xoa %OLD_SERVICE%
)

echo.
echo [2/4] Xoa cau hinh va logs?
echo    Y = Xoa tat ca (config, credentials, logs)
echo    N = Giu lai (co the tai su dung sau)
echo.
choice /C YN /N /M "Lua chon (Y/N): "
if errorlevel 2 goto SKIP_CONFIG_DELETE
if errorlevel 1 (
    if exist "%CF_DIR%" (
        echo    Dang xoa %CF_DIR%...
        rd /s /q "%CF_DIR%" 2>nul
        if exist "%CF_DIR%" (
            echo    [CANH BAO] Khong xoa duoc mot so file
        ) else (
            echo    [OK] Da xoa cau hinh
        )
    ) else (
        echo    [INFO] Thu muc cau hinh khong ton tai
    )
)

:SKIP_CONFIG_DELETE
echo.
echo [3/4] Xoa cloudflared.exe?
echo    Y = Xoa (tai xuong lai khi can)
echo    N = Giu lai
echo.
choice /C YN /N /M "Lua chon (Y/N): "
if errorlevel 2 goto SKIP_BIN_DELETE
if errorlevel 1 (
    if exist "%BIN%" (
        echo    Dang xoa %BIN%...
        del /f /q "%BIN%" 2>nul
        if exist "%BIN%" (
            echo    [CANH BAO] Khong xoa duoc cloudflared.exe
        ) else (
            echo    [OK] Da xoa cloudflared.exe
        )
    ) else (
        echo    [INFO] cloudflared.exe khong ton tai
    )
)

:SKIP_BIN_DELETE
echo.
echo [4/4] Xoa credential tu Cloudflare?
set "CERT=%CF_DIR%\cert.pem"
if exist "%CERT%" (
    echo.
    echo    Ban co muon xoa cert.pem ^(dang xuat Cloudflare^)?
    echo    Y = Xoa ^(phai dang nhap lai sau^)
    echo    N = Giu lai ^(co the tao tunnel khac^)
    echo.
    choice /C YN /N /M "Lua chon (Y/N): "
    if errorlevel 2 goto SKIP_CERT_DELETE
    if errorlevel 1 (
        echo    Dang xoa %CERT%...
        del /f /q "%CERT%" 2>nul
        if exist "%CERT%" (
            echo    [CANH BAO] Khong xoa duoc cert.pem
        ) else (
            echo    [OK] Da dang xuat Cloudflare
        )
    )
)

:SKIP_CERT_DELETE
echo.
echo ==========================================================
echo        HOAN TAT GO BO
echo ==========================================================
echo.
echo Cloudflare Tunnel da duoc go bo khoi MediaPlayer.
echo.
echo LUU Y:
echo   - Tunnel tren Cloudflare Dashboard van ton tai
echo   - DNS record van ton tai tren Cloudflare
echo   - Truy cap dashboard.cloudflare.com de quan ly
echo.
echo Lenh xoa tunnel thu cong (neu can):
echo   cloudflared tunnel list
echo   cloudflared tunnel delete ^<tunnel-name^>
echo.

pause
endlocal
