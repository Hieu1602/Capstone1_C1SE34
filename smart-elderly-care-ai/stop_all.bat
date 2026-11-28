@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Smart Elderly Care AI - Stop All

echo [*] Dang dung tat ca containers...
set "COMPOSE_FILES=-f docker-compose.yml -f docker-compose.camera.yml"
if exist "%USERPROFILE%\.aws" (
    if exist ".local\video-tls\certificate.pem" (
        set "COMPOSE_FILES=%COMPOSE_FILES% -f docker-compose.aws-local.yml"
    )
)

docker compose %COMPOSE_FILES% down --remove-orphans
echo [OK] Da dung tat ca containers.
pause

