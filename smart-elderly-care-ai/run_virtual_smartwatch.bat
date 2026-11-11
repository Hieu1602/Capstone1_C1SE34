@echo off
title SECA Virtual Smartwatch Simulator
cd /d "%~dp0"
echo =========================================================================
echo       DONG HO THONG MINH AO - SECA VIRTUAL SMARTWATCH SIMULATOR
echo =========================================================================
echo Chon kich ban muon mo phong kiem thu:
echo.
echo   --- NHOM CHUAN & CHONG BAO DONG GIA (ANTI-FALSE ALARMS) ---
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
set /p opt="Nhap lua chon (1-12, mac dinh 1): "

if "%opt%"=="2" (
    echo Dang khoi dong che do Van dong the duc (Chong bao dong gia)...
    backend\.venv\Scripts\python.exe backend\database\scripts\virtual_smartwatch.py --mode exercise
) else if "%opt%"=="3" (
    echo Dang khoi dong che do Thao vong tay / Cam sac (Chong bao ngung tim gia)...
    backend\.venv\Scripts\python.exe backend\database\scripts\virtual_smartwatch.py --mode off_wrist
) else if "%opt%"=="4" (
    echo Dang khoi dong che do Nhip tim cao luc nghi ngoi...
    backend\.venv\Scripts\python.exe backend\database\scripts\virtual_smartwatch.py --mode tachy
) else if "%opt%"=="5" (
    echo Dang khoi dong che do Nhip tim tang vot nguy hiem (^>= 145 bpm)...
    backend\.venv\Scripts\python.exe backend\database\scripts\virtual_smartwatch.py --mode tachy_critical
) else if "%opt%"=="6" (
    echo Dang khoi dong che do Nhip tim tut thap (^< 50 bpm)...
    backend\.venv\Scripts\python.exe backend\database\scripts\virtual_smartwatch.py --mode brady
) else if "%opt%"=="7" (
    echo Dang khoi dong che do Tut Oxy SpO2 (^< 90%%)...
    backend\.venv\Scripts\python.exe backend\database\scripts\virtual_smartwatch.py --mode hypoxia
) else if "%opt%"=="8" (
    echo Dang khoi dong che do Qua tai tim phoi khi gang suc (Tim nhanh + Oxy tut)...
    backend\.venv\Scripts\python.exe backend\database\scripts\virtual_smartwatch.py --mode exertion_hypoxia
) else if "%opt%"=="9" (
    echo Dang khoi dong che do Sot cao kem tim nhanh...
    backend\.venv\Scripts\python.exe backend\database\scripts\virtual_smartwatch.py --mode fever
) else if "%opt%"=="10" (
    echo Dang khoi dong che do TAM CHUNG NGUY KICH...
    backend\.venv\Scripts\python.exe backend\database\scripts\virtual_smartwatch.py --mode critical_triad
) else if "%opt%"=="11" (
    echo Dang khoi dong che do Te nga khan cap...
    backend\.venv\Scripts\python.exe backend\database\scripts\virtual_smartwatch.py --mode fall
) else if "%opt%"=="12" (
    echo Dang khoi dong che do Xa pin nhanh...
    backend\.venv\Scripts\python.exe backend\database\scripts\virtual_smartwatch.py --mode drain
) else (
    echo Dang khoi dong che do Binh thuong...
    backend\.venv\Scripts\python.exe backend\database\scripts\virtual_smartwatch.py --mode normal
)

pause
