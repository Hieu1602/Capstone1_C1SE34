@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Smart Elderly Care AI - Start All

echo ========================================================
echo    Smart Elderly Care AI - Khoi dong toan bo he thong
echo ========================================================

docker info >nul 2>&1
if errorlevel 1 (
    echo [!] Docker chua chay hoac chua duoc cai dat.
    echo     Vui long mo Docker Desktop roi chay lai file nay.
    pause
    exit /b 1
)

if not exist ".env" (
    if exist ".env.example" (
        copy /y ".env.example" ".env" >nul
        echo [i] Da tao .env tu .env.example.
    ) else (
        echo [!] Khong tim thay .env hoac .env.example.
        pause
        exit /b 1
    )
)

if not exist ".env.camera" (
    if exist ".env.camera.example" (
        copy /y ".env.camera.example" ".env.camera" >nul
        echo [i] Da tao .env.camera tu .env.camera.example.
        echo     Neu dung camera that, hay dien TAPO_HOST, TAPO_USERNAME, TAPO_PASSWORD trong .env.camera.
    )
)

set "COMPOSE_FILES=-f docker-compose.yml -f docker-compose.camera.yml"
set "SERVICES=timescaledb redis emqx backend tapo-audio tapo-camera"

if exist "%USERPROFILE%\.aws" (
    if exist ".local\video-tls\certificate.pem" (
        set "COMPOSE_FILES=%COMPOSE_FILES% -f docker-compose.aws-local.yml"
        set "SERVICES=%SERVICES% video-metadata"
        echo [i] Tim thay AWS profile + TLS local -^> bat kem video-metadata.
    )
)

if exist "%USERPROFILE%\.ssh\elderly-care-new" (
    set "SERVICES=%SERVICES% camera-tunnel"
    echo [i] Tim thay SSH key -^> bat kem camera-tunnel len EC2.
)

echo [*] Dang build va khoi dong containers: %SERVICES% ...
docker compose %COMPOSE_FILES% up -d --build %SERVICES%
if errorlevel 1 (
    echo [!] Khoi dong Docker that bai. Kiem tra lai logs bang: docker compose %COMPOSE_FILES% logs -f
    pause
    exit /b 1
)

where npm >nul 2>&1
if not errorlevel 1 (
    if exist "apps\web\package.json" (
        if not exist "apps\web\node_modules" (
            echo [*] Dang cai dat dependencies cho apps\web...
            pushd apps\web && call npm install && popd
        )
        start "SECA Web (3000)" cmd /k "cd /d "%~dp0apps\web" && npm run dev"
    )
    if exist "apps\doctor-web\package.json" (
        if not exist "apps\doctor-web\node_modules" (
            echo [*] Dang cai dat dependencies cho apps\doctor-web...
            pushd apps\doctor-web && call npm install && popd
        )
        start "SECA Doctor Web (3001)" cmd /k "cd /d "%~dp0apps\doctor-web" && npm run dev"
    )
) else (
    echo [i] Khong tim thay npm -^> bo qua khoi dong Web UI ^(apps\web, apps\doctor-web^).
)

echo.
echo [OK] He thong da khoi dong!
echo      - Backend API (Docs): http://localhost:8000/docs
echo      - Web App:            http://localhost:3000
echo      - Doctor Web App:     http://localhost:3001
echo      - Camera UI / API:    http://127.0.0.1:8090
echo      - go2rtc Audio:       http://127.0.0.1:1984
echo      - EMQX Dashboard:     http://localhost:18083
echo.
docker compose %COMPOSE_FILES% ps
echo.
pause

