@echo off
title SECA Virtual Smartwatch Simulator
cd /d "%~dp0"
echo ==============================================================
echo    DONG HO THONG MINH AO - SECA VIRTUAL SMARTWATCH
echo ==============================================================
echo Chon che do muon mo phong:
echo.
echo   [1] Binh thuong (Nhip tim on dinh, Pin giam tu nhien)
echo   [2] MO PHONG PIN GIAM NHANH: Pin yeu 15%% -^> Het pin 0%% (Test canh bao)
echo   [3] Test Canh bao Te nga khan cap (Fall Detection)
echo   [4] Test Canh bao Tim dap nhanh (Tachycardia ^> 120 bpm)
echo   [5] Test Canh bao Tut Oxy SpO2 (Hypoxia ^< 90%%)
echo.
set /p opt="Nhap lua chon (1-5, mac dinh 1): "

if "%opt%"=="2" (
    echo Dang khoi dong che do Xan pin nhanh...
    backend\.venv\Scripts\python.exe backend\database\scripts\virtual_smartwatch.py --mode drain
) else if "%opt%"=="3" (
    echo Dang khoi dong che do Te nga...
    backend\.venv\Scripts\python.exe backend\database\scripts\virtual_smartwatch.py --mode fall
) else if "%opt%"=="4" (
    echo Dang khoi dong che do Tim dap nhanh...
    backend\.venv\Scripts\python.exe backend\database\scripts\virtual_smartwatch.py --mode tachy
) else if "%opt%"=="5" (
    echo Dang khoi dong che do Tut Oxy SpO2...
    backend\.venv\Scripts\python.exe backend\database\scripts\virtual_smartwatch.py --mode hypoxia
) else (
    echo Dang khoi dong che do Binh thuong...
    backend\.venv\Scripts\python.exe backend\database\scripts\virtual_smartwatch.py --mode normal
)

pause
