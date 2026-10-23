@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Smart Elderly Care AI - He Thong Giam Sat Nguoi Cao Tuoi (C1SE.34)

REM Chay PowerShell script voi ExecutionPolicy Bypass
if "%~1"=="" (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
) else (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
)

REM Giu man hinh neu co loi xay ra
if %ERRORLEVEL% neq 0 (
    echo.
    echo ================================================================================
    echo [!] Script ket thuc voi ma loi: %ERRORLEVEL%.
    echo Nhan phim bat ky de thoat cua so...
    pause >nul
)
