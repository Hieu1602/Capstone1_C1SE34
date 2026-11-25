@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Smart Elderly Care AI - Camera Edge

echo ========================================================
echo    Smart Elderly Care AI - Khoi dong Camera Edge (25 FPS)
echo ========================================================

docker info >nul 2>&1
if errorlevel 1 (
    echo [!] Docker chua chay hoac chua duoc cai dat.
    echo     Vui long mo Docker Desktop roi chay lai file nay.
    pause
    exit /b 1
)

if not exist ".env.camera" (
    if exist ".env.camera.example" (
        copy /y ".env.camera.example" ".env.camera" >nul
        echo [!] Da tao file .env.camera tu .env.camera.example.
        echo     Vui long dien TAPO_HOST, TAPO_USERNAME, TAPO_PASSWORD trong .env.camera
        echo     roi chay lai file nay!
        notepad ".env.camera"
        pause
        exit /b 1
    ) else (
        echo [!] Khong tim thay .env.camera hoac .env.camera.example.
        pause
        exit /b 1
    )
)

set "SERVICES=tapo-audio tapo-camera"
if exist "%USERPROFILE%\.ssh\elderly-care-new" (
    set "SERVICES=tapo-audio tapo-camera camera-tunnel"
    echo [i] Tim thay SSH key -> bat kem camera-tunnel len EC2.
) else (
    echo [i] Khong co SSH key (%USERPROFILE%\.ssh\elderly-care-new) -> chay local (bo qua camera-tunnel).
)

echo [*] Dang build va khoi dong: %SERVICES% ...
docker compose -f docker-compose.camera.yml up -d --build %SERVICES%
if errorlevel 1 (
    echo [!] Khoi dong that bai. Kiem tra lai cau hinh trong .env.camera va Docker logs.
    pause
    exit /b 1
)

echo.
echo [OK] Camera Edge da khoi dong!
echo      - Camera UI / API: http://127.0.0.1:8090
echo      - go2rtc Audio:    http://127.0.0.1:1984
docker compose -f docker-compose.camera.yml ps
echo.
pause
