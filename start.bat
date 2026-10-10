@echo off
setlocal
cd /d "%~dp0"
title Smart Elderly Care AI - Khoi Dong Nhanh

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*

if %ERRORLEVEL% neq 0 (
    echo.
    echo Script ket thuc. Nhan phim bat ky de thoat...
    pause >nul
)
