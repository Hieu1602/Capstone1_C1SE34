@echo off
chcp 65001 >nul
title SSH Camera Tunnel to EC2

set EC2_HOST=16.178.128.42
set EC2_USER=ubuntu
set KEY_PATH=%USERPROFILE%\.ssh\elderly-care-new

echo ========================================================
echo    Smart Elderly Care AI - Permanent Camera Tunnel
echo ========================================================
echo [i] EC2 Host: %EC2_USER%@%EC2_HOST%
echo [i] SSH Key:  %KEY_PATH%
echo [i] Forward:  Port 8090 (Camera) va 1984 (Intercom)
echo [i] URL tren EC2 da co dinh tai: http://host.docker.internal:8090
echo ========================================================
echo.

if not exist "%KEY_PATH%" (
    echo [!] Khong tim thay SSH key tai: %KEY_PATH%
    echo     Vui long kiem tra lai duong dan file key.
    pause
    exit /b 1
)

:loop
echo [%date% %time%] Dang ket noi va giu tunnel...
ssh -i "%KEY_PATH%" ^
    -N ^
    -R 0.0.0.0:8090:127.0.0.1:8090 ^
    -R 0.0.0.0:1984:127.0.0.1:1984 ^
    -o ServerAliveInterval=30 ^
    -o ServerAliveCountMax=3 ^
    -o ExitOnForwardFailure=yes ^
    -o StrictHostKeyChecking=accept-new ^
    %EC2_USER%@%EC2_HOST%

echo.
echo [!] Tunnel bi ngat ket noi (hoac mang chap chon). Tu dong thu lai sau 5 giay...
timeout /t 5 /nobreak >nul
goto loop
