# ==============================================================================
# SMART ELDERLY CARE AI - SCRIPT KHOI DONG & QUAN TRI HE THONG (C1SE.34)
# ==============================================================================

[CmdletBinding()]
param(
    [Parameter(Position = 0, Mandatory = $false)]
    [string]$Target = ""
)

try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

$ScriptDir = $PSScriptRoot
if (Test-Path "$ScriptDir\smart-elderly-care-ai") {
    $AiDir = "$ScriptDir\smart-elderly-care-ai"
} elseif (Test-Path "$ScriptDir\backend") {
    $AiDir = $ScriptDir
} else {
    $AiDir = "$ScriptDir\smart-elderly-care-ai"
}

$BackendDir = "$AiDir\backend"
$MobileDir = "$AiDir\apps\mobile"
$WebDir = "$AiDir\apps\web"
$EdgeDir = "$AiDir\edge"
$DockerComposeFile = "$AiDir\docker-compose.yml"

# ------------------------------------------------------------------------------
# 1. TIM KIEM PYTHON RUNTIME HOAC UV CHO BACKEND
# ------------------------------------------------------------------------------
$BackendVenvPy = "$BackendDir\.venv\Scripts\python.exe"
$UvCmd = Get-Command uv -ErrorAction SilentlyContinue

function Get-PythonCommand {
    if (Test-Path $BackendVenvPy) {
        return $BackendVenvPy
    }
    $sysPy = Get-Command python -ErrorAction SilentlyContinue
    if ($sysPy) {
        return "python"
    }
    return $null
}

# ------------------------------------------------------------------------------
# 2. HAM TIEN ICH GIAO DIEN (CONSOLE UI)
# ------------------------------------------------------------------------------
function Write-Header {
    Clear-Host
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host "   [+] SMART ELDERLY CARE AI - HE THONG GIAM SAT NGUOI CAO TUOI (C1SE.34)       " -ForegroundColor Yellow
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Success {
    param([string]$Message)
    Write-Host "  [OK] $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "  [i]  $Message" -ForegroundColor Cyan
}

function Write-Warn {
    param([string]$Message)
    Write-Host "  [!]  $Message" -ForegroundColor Yellow
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host "  [X]  $Message" -ForegroundColor Red
}

function Test-PortListening {
    param([int]$Port)
    try {
        $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        return ($null -ne $conns)
    } catch {
        return $false
    }
}

# ------------------------------------------------------------------------------
# 3. KIEM TRA TIEN DIEU KIEN (PREREQUISITES)
# ------------------------------------------------------------------------------
function Test-Prerequisites {
    # Check .env
    if (-not (Test-Path "$AiDir\.env")) {
        if (Test-Path "$AiDir\.env.example") {
            Copy-Item "$AiDir\.env.example" "$AiDir\.env"
            Write-Success "Da khoi tao file .env tu .env.example"
        }
    }
    if (-not (Test-Path "$BackendDir\.env")) {
        if (Test-Path "$BackendDir\.env.example") {
            Copy-Item "$BackendDir\.env.example" "$BackendDir\.env"
            Write-Success "Da khoi tao file backend/.env tu .env.example"
        }
    }

    $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $dockerCmd) {
        Write-ErrorMsg "Khong tim thay Docker tren he thong! Vui long cai dat Docker Desktop."
        return $false
    }

    docker info >$null 2>&1
    if ($LASTEXITCODE -ne 0) {
        # Thu chuyen context ve default neu desktop-linux loi
        docker context use default >$null 2>&1
        docker info >$null 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "Docker Desktop chua bat hoac chua san sang!"
            return $false
        }
    }

    return $true
}

# ------------------------------------------------------------------------------
# 4. KHOI DONG HA TANG DOCKER (TIMESCALEDB, REDIS, EMQX)
# ------------------------------------------------------------------------------
function Start-DockerServices {
    Write-Info "Dang kiem tra va khoi dong ha tang Docker (TimescaleDB, Redis, EMQX)..."
    
    if (-not (Test-Prerequisites)) {
        Write-Warn "Bo qua khoi dong Docker (he thong se dung CSDL Cloud Supabase neu da cau hinh trong .env)."
        return $false
    }

    docker compose -f "$DockerComposeFile" up -d timescaledb redis emqx
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "Loi khi chay Docker Compose!"
        return $false
    }

    Write-Info "Dang doi cac port ha tang san sang..."
    $maxWait = 8
    $waited = 0
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 1
        $waited++
        if ((Test-PortListening -Port 5433) -and (Test-PortListening -Port 6379)) {
            break
        }
    }

    Write-Success "Ha tang Docker san sang:"
    Write-Host "     - TimescaleDB (PostgreSQL 16) : localhost:5433" -ForegroundColor Gray
    Write-Host "     - Redis Cache & PubSub        : localhost:6379" -ForegroundColor Gray
    Write-Host "     - EMQX MQTT Broker            : localhost:1883 (Dashboard: http://localhost:18083)" -ForegroundColor Gray
    Write-Host ""
    return $true
}

# ------------------------------------------------------------------------------
# 5. KHOI DONG FASTAPI BACKEND
# ------------------------------------------------------------------------------
function Start-BackendService {
    Write-Info "Dang khoi dong Cloud Backend FastAPI..."

    $pyCmd = Get-PythonCommand
    if (-not $pyCmd) {
        Write-ErrorMsg "Khong tim thay moi truong Python hoac venv tai: $BackendVenvPy"
        return
    }

    # Chay uvicorn qua PowerShell cua so moi voi UTF-8 va PYTHONPATH day du
    $execCmd = if ($UvCmd) {
        "uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
    } else {
        "& '$pyCmd' -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
    }

    $psCommand = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; `$env:PYTHONIOENCODING='utf-8'; `$env:PYTHONPATH='.'; `$host.UI.RawUI.WindowTitle = '[Elderly Care] Backend FastAPI (Port 8000)'; Set-Location '$BackendDir'; $execCmd"
    Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $psCommand

    Write-Success "Da mo tien trinh Backend FastAPI tren port 8000."
    Write-Host "     - API Docs (Swagger UI)       : http://localhost:8000/api/docs" -ForegroundColor Yellow
    Write-Host "     - Health Check                : http://localhost:8000/health" -ForegroundColor Gray
    Write-Host ""
}

# ------------------------------------------------------------------------------
# 6. KHOI DONG WEB ADMIN PORTAL
# ------------------------------------------------------------------------------
function Start-WebService {
    Write-Info "Dang khoi dong Web Admin Portal (Vite React)..."

    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $npmCmd) {
        Write-ErrorMsg "Khong tim thay Node.js / npm! Vui long cai dat Node.js de chay Web Admin."
        return
    }

    if (-not (Test-Path "$WebDir\node_modules")) {
        Write-Warn "Chua tim thay node_modules tai apps/web. Dang tien hanh npm install..."
        Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "Set-Location '$WebDir'; npm install; npm run dev"
        return
    }

    $psCommand = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; `$host.UI.RawUI.WindowTitle = '[Elderly Care] Web Admin Portal (Port 3000)'; Set-Location '$WebDir'; npm run dev"
    Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $psCommand

    Write-Success "Da mo tien trinh Web Admin Portal tren port 3000."
    Write-Host "     - Cong Quan Tri Web Admin     : http://localhost:3000" -ForegroundColor Yellow
    Write-Host ""
}

# ------------------------------------------------------------------------------
# 7. KHOI DONG MOBILE APP (REACT NATIVE EXPO)
# ------------------------------------------------------------------------------
function Start-MobileService {
    [CmdletBinding()]
    param(
        [Parameter()]
        [string]$Mode = "web"
    )
    Write-Info "Dang khoi dong Mobile App (React Native Expo)..."

    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $npmCmd) {
        Write-ErrorMsg "Khong tim thay Node.js / npm! Vui long cai dat Node.js de chay Mobile App."
        return
    }

    if (-not (Test-Path "$MobileDir\node_modules")) {
        Write-Warn "Chua tim thay node_modules tai apps/mobile. Dang tien hanh npm install..."
        Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "Set-Location '$MobileDir'; npm install; npx expo start -c"
        return
    }

    $subCmd = if ($Mode -eq "web") { "npx expo start --web" } else { "npx expo start -c" }
    $psCommand = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; `$host.UI.RawUI.WindowTitle = '[Elderly Care] Mobile App (Port 8081)'; Set-Location '$MobileDir'; $subCmd"
    Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $psCommand

    Write-Success "Da mo tien trinh Mobile App (Expo Metro Bundler)."
    Write-Host "     - Expo Metro Bundler          : http://localhost:8081" -ForegroundColor Yellow
    Write-Host "     - Quet QR tren dien thoai bang ung dung Expo Go" -ForegroundColor Yellow
    Write-Host ""
}

# ------------------------------------------------------------------------------
# 8. KHOI DONG EDGE AI SENSOR TEST
# ------------------------------------------------------------------------------
function Start-EdgeService {
    Write-Info "Dang kiem tra Edge Hub AI..."
    $pyCmd = Get-PythonCommand
    if (-not $pyCmd) {
        Write-ErrorMsg "Khong tim thay Python runtime."
        return
    }
    
    $testCamPath = "$EdgeDir\test_camera.py"
    if (Test-Path $testCamPath) {
        Write-Info "Mo cua so kiem tra Camera / Edge Sensor Simulation..."
        $psCommand = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; `$env:PYTHONIOENCODING='utf-8'; `$host.UI.RawUI.WindowTitle = '[Elderly Care] Edge AI Test'; Set-Location '$EdgeDir'; & '$pyCmd' test_camera.py"
        Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $psCommand
        Write-Success "Da mo tien trinh Edge AI Test."
    } else {
        Write-Warn "Khong tim thay file $testCamPath"
    }
}

# ------------------------------------------------------------------------------
# 9. CHAY UNIT TESTS BACKEND
# ------------------------------------------------------------------------------
function Run-BackendTests {
    Write-Info "Dang thuc thi bo kiem thu Unit Test Backend..."
    $pyCmd = Get-PythonCommand
    if (-not $pyCmd) {
        Write-ErrorMsg "Khong tim thay Python runtime."
        return
    }

    Push-Location $BackendDir
    try {
        $env:PYTHONPATH = "."
        $env:PYTHONIOENCODING = "utf-8"
        if ($UvCmd) {
            uv run pytest tests/
        } else {
            & $pyCmd -m pytest tests/
        }
    } finally {
        Pop-Location
    }
}

# ------------------------------------------------------------------------------
# 10. BAO CAO TINH TRANG HE THONG (SYSTEM STATUS)
# ------------------------------------------------------------------------------
function Show-SystemStatus {
    Write-Host "--------------------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  BAO CAO TINH TRANG CAC THANH PHAN HE THONG" -ForegroundColor Cyan
    Write-Host "--------------------------------------------------------------------------------" -ForegroundColor DarkGray

    # TimescaleDB Local
    $dbOk = Test-PortListening -Port 5433
    $dbStatus = if ($dbOk) { "[ONLINE] Port 5433" } else { "[OFFLINE]" }
    $dbColor = if ($dbOk) { "Green" } else { "DarkGray" }
    Write-Host ("  {0,-28} : {1}" -f "Local TimescaleDB (:5433)", $dbStatus) -ForegroundColor $dbColor

    # Redis Local
    $redisOk = Test-PortListening -Port 6379
    $redisStatus = if ($redisOk) { "[ONLINE] Port 6379" } else { "[OFFLINE]" }
    $redisColor = if ($redisOk) { "Green" } else { "DarkGray" }
    Write-Host ("  {0,-28} : {1}" -f "Local Redis Cache (:6379)", $redisStatus) -ForegroundColor $redisColor

    # EMQX Local
    $emqxOk = Test-PortListening -Port 1883
    $emqxStatus = if ($emqxOk) { "[ONLINE] Port 1883" } else { "[OFFLINE]" }
    $emqxColor = if ($emqxOk) { "Green" } else { "DarkGray" }
    Write-Host ("  {0,-28} : {1}" -f "Local EMQX MQTT (:1883)", $emqxStatus) -ForegroundColor $emqxColor

    # Backend
    $backendOk = Test-PortListening -Port 8000
    if ($backendOk) {
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -TimeoutSec 2 -ErrorAction Stop
            $backendStatus = "[ONLINE] (v$($health.version)) -> http://localhost:8000/api/docs"
        } catch {
            $backendStatus = "[LISTENING] (Dang khoi dong...)"
        }
    } else {
        $backendStatus = "[OFFLINE]"
    }
    $backendColor = if ($backendOk) { "Green" } else { "Red" }
    Write-Host ("  {0,-28} : {1}" -f "FastAPI Backend (:8000)", $backendStatus) -ForegroundColor $backendColor

    # Web Admin Portal
    $webOk = Test-PortListening -Port 3000
    $webStatus = if ($webOk) { "[ONLINE] -> http://localhost:3000" } else { "[OFFLINE]" }
    $webColor = if ($webOk) { "Green" } else { "Red" }
    Write-Host ("  {0,-28} : {1}" -f "Web Admin Portal (:3000)", $webStatus) -ForegroundColor $webColor

    # Mobile App
    $mobileOk = Test-PortListening -Port 8081
    $mobileStatus = if ($mobileOk) { "[ONLINE] -> http://localhost:8081" } else { "[OFFLINE]" }
    $mobileColor = if ($mobileOk) { "Green" } else { "Red" }
    Write-Host ("  {0,-28} : {1}" -f "Mobile App Expo (:8081)", $mobileStatus) -ForegroundColor $mobileColor

    Write-Host "--------------------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host ""
}

# ------------------------------------------------------------------------------
# 11. DUNG TAT CA DICH VU (STOP ALL)
# ------------------------------------------------------------------------------
function Stop-AllServices {
    Write-Warn "Dang tien hanh dung toan bo cac tien trinh cua he thong..."

    # Tat Docker containers
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        Write-Info "Dang tat Docker containers..."
        docker compose -f "$DockerComposeFile" down 2>$null
        Write-Success "Da dung Docker containers."
    }

    # Dung tien trinh tren cac cong 8000, 8081, 3000, 19000, 19001
    $portsToKill = @(8000, 8081, 3000, 19000, 19001)
    $killedPids = @()
    foreach ($p in $portsToKill) {
        $pids = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | 
                Select-Object -ExpandProperty OwningProcess -Unique
        if ($pids) {
            foreach ($procId in $pids) {
                if ($procId -gt 0 -and ($killedPids -notcontains $procId)) {
                    Write-Info "Dung tien trinh tren Port $p (PID: $procId)..."
                    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                    $killedPids += $procId
                }
            }
        }
    }

    Write-Success "Toan bo dich vu da duoc dung an toan!"
}

# ------------------------------------------------------------------------------
# 12. MO CAC TRANG WEB QUAN TRI TREN BROWSER
# ------------------------------------------------------------------------------
function Open-WebLinks {
    Write-Info "Dang mo cac lien ket tren trinh duyet..."
    if (Test-PortListening -Port 3000) { Start-Process "http://localhost:3000" }
    if (Test-PortListening -Port 8000) { Start-Process "http://localhost:8000/api/docs" }
    if (Test-PortListening -Port 8081) { Start-Process "http://localhost:8081" }
    if (Test-PortListening -Port 1883) { Start-Process "http://localhost:18083" }
    Write-Success "Da mo cac trang quan tri!"
}

# ------------------------------------------------------------------------------
# 13. KHOI DONG TOAN BO HE THONG
# ------------------------------------------------------------------------------
function Start-AllServices {
    Write-Header
    Write-Host "  [+] BAT DAU KHOI DONG TOAN BO HE THONG..." -ForegroundColor Green
    Write-Host ""

    # Khoi dong Docker ha tang neu co
    $dockerOk = Start-DockerServices
    Start-Sleep -Seconds 1

    Start-BackendService
    Start-Sleep -Seconds 2

    Start-WebService
    Start-Sleep -Seconds 2

    Start-MobileService -Mode "web"
    Start-Sleep -Seconds 2

    Write-Host ""
    Write-Success "KHOI DONG THANH CONG CAC DICH VU CHINH!"
    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host "  DIA CHI TRUY CAP CAC DICH VU:" -ForegroundColor Yellow
    Write-Host "  - Web Admin Portal      : http://localhost:3000" -ForegroundColor White
    Write-Host "  - Mobile App Web        : http://localhost:8081" -ForegroundColor White
    Write-Host "  - Backend Swagger Docs  : http://localhost:8000/api/docs" -ForegroundColor White
    Write-Host "  - Health Check API      : http://localhost:8000/health" -ForegroundColor White
    if (Test-PortListening -Port 1883) {
        Write-Host "  - EMQX MQTT Dashboard   : http://localhost:18083  (User: admin / public)" -ForegroundColor White
    }
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host ""

    $openNow = Read-Host "Ban co muon mo ngay Web Admin, Mobile App & Swagger Docs tren trinh duyet? (Y/N) [Mac dinh: Y]"
    if ($openNow -eq "" -or $openNow -match "^[yY]") {
        Start-Process "http://localhost:3000"
        Start-Process "http://localhost:8000/api/docs"
        Start-Process "http://localhost:8081"
    }
}

# ------------------------------------------------------------------------------
# 14. DIEU HUONG CLI PARAMETERS
# ------------------------------------------------------------------------------
switch ($Target.ToLower()) {
    "all"     { Start-AllServices; exit }
    "docker"  { Start-DockerServices; exit }
    "backend" { Start-BackendService; exit }
    "web"     { Start-WebService; exit }
    "mobile"  { Start-MobileService -Mode "web"; exit }
    "edge"    { Start-EdgeService; exit }
    "test"    { Run-BackendTests; exit }
    "status"  { Show-SystemStatus; exit }
    "stop"    { Stop-AllServices; exit }
    "open"    { Open-WebLinks; exit }
}

# ------------------------------------------------------------------------------
# 15. MENU TUONG TAC CLI
# ------------------------------------------------------------------------------
do {
    Write-Header
    Show-SystemStatus

    Write-Host "  CHON TAC VU BAN MUON THUC HIEN:" -ForegroundColor Yellow
    Write-Host "  ------------------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  [1] Khoi dong TOAN BO (Docker + Backend + Web Admin + Mobile Web)" -ForegroundColor Green
    Write-Host "  [2] Khoi dong Ha tang (Docker: TimescaleDB, Redis, EMQX)" -ForegroundColor Cyan
    Write-Host "  [3] Khoi dong Cloud Backend FastAPI (localhost:8000)" -ForegroundColor Cyan
    Write-Host "  [4] Khoi dong Web Admin Portal (localhost:3000)" -ForegroundColor Cyan
    Write-Host "  [5] Khoi dong Mobile App (localhost:8081)" -ForegroundColor Cyan
    Write-Host "  [6] Khoi dong Edge Hub AI (Kiem tra Camera / Cam bien)" -ForegroundColor Cyan
    Write-Host "  ------------------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  [7] Kiem tra trang thai he thong (Health Check)" -ForegroundColor White
    Write-Host "  [8] Chay Unit Tests Backend (pytest)" -ForegroundColor White
    Write-Host "  [9] Mo cac trang quan tri tren Web Browser" -ForegroundColor White
    Write-Host "  [10] Dung toan bo he thong (Stop All)" -ForegroundColor Yellow
    Write-Host "  [0] Thoat" -ForegroundColor Red
    Write-Host "  ------------------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host ""

    $choice = Read-Host "  Nhap lua chon cua ban (0-10)"

    switch ($choice) {
        "1"  { Start-AllServices; Write-Host "Nhan Enter de tiep tuc..."; [void][System.Console]::ReadLine() }
        "2"  { Start-DockerServices; Write-Host "Nhan Enter de tiep tuc..."; [void][System.Console]::ReadLine() }
        "3"  { Start-BackendService; Write-Host "Nhan Enter de tiep tuc..."; [void][System.Console]::ReadLine() }
        "4"  { Start-WebService; Write-Host "Nhan Enter de tiep tuc..."; [void][System.Console]::ReadLine() }
        "5"  { Start-MobileService -Mode "web"; Write-Host "Nhan Enter de tiep tuc..."; [void][System.Console]::ReadLine() }
        "6"  { Start-EdgeService; Write-Host "Nhan Enter de tiep tuc..."; [void][System.Console]::ReadLine() }
        "7"  { Write-Info "Dang kiem tra..."; Start-Sleep -Seconds 1 }
        "8"  { Run-BackendTests; Write-Host "Nhan Enter de tiep tuc..."; [void][System.Console]::ReadLine() }
        "9"  { Open-WebLinks; Write-Host "Nhan Enter de tiep tuc..."; [void][System.Console]::ReadLine() }
        "10" { Stop-AllServices; Write-Host "Nhan Enter de tiep tuc..."; [void][System.Console]::ReadLine() }
        "0"  { Write-Host "`nTam biet!`n"; break }
        default { Write-Warn "Lua chon khong hop le, vui long chon tu 0 den 10."; Start-Sleep -Seconds 2 }
    }
} while ($choice -ne "0")