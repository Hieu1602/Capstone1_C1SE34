@echo off
setlocal
title SECA Virtual Smartwatch Simulator
cd /d "%~dp0"

echo =========================================================================
echo       DONG HO THONG MINH AO - SECA VIRTUAL SMARTWATCH SIMULATOR
echo =========================================================================
echo Chon kich ban muon mo phong kiem thu:
echo.
echo   --- NHOM CHUAN VA CHONG BAO DONG GIA (ANTI-FALSE ALARMS) ---
echo   [1] Binh thuong (Nhip tim 74 bpm, SpO2 98%%, 36.5C - Khong bao dong)
echo   [2] VAN DONG THE DUC SINH LY (Tim tang dan 82 -^> 120 bpm, SpO2 97%% -^> KHONG BAO DONG GIA)
echo   [3] Thao vong tay / Cam sac (is_worn=False, HR=0 -^> KHONG BAO NGUNG TIM GIA)
echo.
echo   --- NHOM CANH BAO CHI SO DON LE (SINGLE-VITAL ALERTS) ---
echo   [4] Nhip tim tang cao luc NGHI NGOI (HR ~126 bpm khi dang ngoi yen -^> Canh bao Vang/HIGH)
echo   [5] Nhip tim tang vot NGUY HIEM (HR ^>= 145 bpm -^> Bao dong Do/CRITICAL)
echo   [6] Nhip tim tut qua THAP (HR ^< 50 bpm -^> Canh bao Nhip cham)
echo   [7] Tut Oxy mau SpO2 don le (SpO2 ^< 90%% -^> Canh bao Suy ho hap CRITICAL)
echo.
echo   --- NHOM TO HOP DA YEU TO (MULTI-VITAL SYNDROMES) ---
echo   [8] Qua tai tim phoi khi gang suc (Tim ^> 118 bpm + SpO2 tut ^< 90%% -^> CRITICAL)
echo   [9] Sot cao kem tim dap nhanh (Than nhiet 38.6C + Tim 108 bpm -^> HIGH)
echo   [10] TAM CHUNG NGUY KICH (Sot 38.9C + Tim 126 bpm + SpO2 86%% -^> BAO DONG DO)
echo.
echo   --- NHOM SU CO KHAC ---
echo   [11] Su co te nga khan cap (Fall Detected = True)
echo   [12] Xa pin nhanh (Pin yeu 15%% -^> Can pin 0%%)
echo.
set "opt=1"
set /p "opt=Nhap lua chon (1-12, mac dinh 1): "

set "MODE=normal"
if "%opt%"=="2" set "MODE=exercise"
if "%opt%"=="3" set "MODE=off_wrist"
if "%opt%"=="4" set "MODE=tachy"
if "%opt%"=="5" set "MODE=tachy_critical"
if "%opt%"=="6" set "MODE=brady"
if "%opt%"=="7" set "MODE=hypoxia"
if "%opt%"=="8" set "MODE=exertion_hypoxia"
if "%opt%"=="9" set "MODE=fever"
if "%opt%"=="10" set "MODE=critical_triad"
if "%opt%"=="11" set "MODE=fall"
if "%opt%"=="12" set "MODE=drain"

echo.
echo =========================================================================
echo Dang khoi dong mo phong che do: %MODE%
echo =========================================================================
backend\.venv\Scripts\python.exe backend\database\scripts\virtual_smartwatch.py --mode %MODE% --profile full

pause
