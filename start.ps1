# ==============================================================================
# SMART ELDERLY CARE AI - SCRIPT KHOI DONG NHANH DU AN (C1SE.34)
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
$EdgeDir = "$AiDir\edge"
$DockerComposeFile = "$AiDir\docker-compose.yml"
$BackendVenvPy = "$BackendDir\.venv\Scripts\python.exe"

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

function Test-Prerequisites {
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
        Write-Warn "Docker Desktop chua duoc bat hoac chua san sang!"
        Write-Warn "Vui long mo ung dung Docker Desktop tren may tinh roi thu lai."
        return $false
    }

    return $true
}

function Start-DockerServices {
    Write-Info "Dang khoi dong cac dich vu Ha tang Docker (TimescaleDB, Redis, EMQX)..."
    
    if (-not (Test-Prerequisites)) {
        return $false
    }

    docker compose -f "$DockerComposeFile" up -d timescaledb redis emqx
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "Loi khi chay Docker Compose!"
        return $false
    }

    Write-Info "Dang doi TimescaleDB & Redis san sang (3-5 giay)..."
    $maxWait = 10
    $waited = 0
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 1
        $waited++
        $dbUp = Test-PortListening -Port 5433
        $redisUp = Test-PortListening -Port 6379
        if ($dbUp -and $redisUp) {
            break
        }
    }

    Write-Success "Ha tang Docker da san sang:"
    Write-Host "     - TimescaleDB (PostgreSQL 16) : localhost:5433" -ForegroundColor Gray
    Write-Host "     - Redis Cache & PubSub        : localhost:6379" -ForegroundColor Gray
    Write-Host "     - EMQX MQTT Broker            : localhost:1883 (Dashboard: http://localhost:18083)" -ForegroundColor Gray
    Write-Host ""
    return $true
}

function Start-BackendService {
    Write-Info "Dang khoi dong Cloud Backend FastAPI..."

    if (-not (Test-Path $BackendVenvPy)) {
        Write-Warn "Chua tim thay moi truong ao tai: $BackendVenvPy"
        Write-Info "Dang thu chay voi python mac dinh cua he thong..."
        $pyCmd = "python"
    } else {
        $pyCmd = $BackendVenvPy
    }

    $psCommand = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; `$host.UI.RawUI.WindowTitle = '[Elderly Care] Backend FastAPI (Port 8000)'; Set-Location '$BackendDir'; & '$pyCmd' -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
    Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $psCommand

    Write-Success "Da mo tien trinh Backend FastAPI tren port 8000."
    Write-Host "     - API Docs (Swagger UI)       : http://localhost:8000/api/docs" -ForegroundColor Yellow
    Write-Host "     - Health Check                : http://localhost:8000/health" -ForegroundColor Gray
    Write-Host ""
}

function Start-MobileService {
    [CmdletBinding()]
    param(
        [Parameter()]
        [string]$Platform = "web"
    )
    Write-Info "Dang khoi dong Mobile App (React Native Expo)..."

    $nodeCmd = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $nodeCmd) {
        Write-ErrorMsg "Khong tim thay Node.js / npm! Vui long cai dat Node.js de chay Mobile App."
        return
    }

    $subCmd = if ($Platform -eq "expo") { "npx expo start" } else { "npm run web" }
    $psCommand = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; `$host.UI.RawUI.WindowTitle = '[Elderly Care] Mobile App (Port 8081)'; Set-Location '$MobileDir'; $subCmd"
    Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $psCommand

    Write-Success "Da mo tien trinh Mobile App."
    Write-Host "     - Giao dien Web (Chrome/Edge) : http://localhost:8081" -ForegroundColor Yellow
    Write-Host ""
}

function Start-EdgeService {
    Write-Info "Dang kiem tra Edge Hub AI..."
    $edgePy = $BackendVenvPy
    if (-not (Test-Path $edgePy)) {
        $edgePy = "python"
    }
    
    $testCamPath = "$EdgeDir\test_camera.py"
    if (Test-Path $testCamPath) {
        Write-Info "Mo cua so chay kiem tra Camera / Edge Sensor Simulation..."
        $psCommand = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; `$host.UI.RawUI.WindowTitle = '[Elderly Care] Edge AI Test'; Set-Location '$EdgeDir'; & '$edgePy' test_camera.py"
        Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $psCommand
        Write-Success "Da mo tien trinh Edge AI Test."
    } else {
        Write-Warn "Khong tim thay file $testCamPath"
    }
}

function Show-SystemStatus {
    Write-Host "--------------------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  BAO CAO TINH TRANG CAC THANH PHAN HE THONG" -ForegroundColor Cyan
    Write-Host "--------------------------------------------------------------------------------" -ForegroundColor DarkGray

    # TimescaleDB
    $dbOk = Test-PortListening -Port 5433
    $dbStatus = if ($dbOk) { "[ONLINE] Port 5433" } else { "[OFFLINE]" }
    $dbColor = if ($dbOk) { "Green" } else { "Red" }
    Write-Host ("  {0,-28} : {1}" -f "TimescaleDB (PostgreSQL)", $dbStatus) -ForegroundColor $dbColor

    # Redis
    $redisOk = Test-PortListening -Port 6379
    $redisStatus = if ($redisOk) { "[ONLINE] Port 6379" } else { "[OFFLINE]" }
    $redisColor = if ($redisOk) { "Green" } else { "Red" }
    Write-Host ("  {0,-28} : {1}" -f "Redis Cache", $redisStatus) -ForegroundColor $redisColor

    # EMQX
    $emqxOk = Test-PortListening -Port 1883
    $emqxStatus = if ($emqxOk) { "[ONLINE] Port 1883 / 18083" } else { "[OFFLINE]" }
    $emqxColor = if ($emqxOk) { "Green" } else { "Red" }
    Write-Host ("  {0,-28} : {1}" -f "EMQX MQTT Broker", $emqxStatus) -ForegroundColor $emqxColor

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
    Write-Host ("  {0,-28} : {1}" -f "FastAPI Backend", $backendStatus) -ForegroundColor $backendColor

    # Mobile App
    $mobileOk = Test-PortListening -Port 8081
    $mobileStatus = if ($mobileOk) { "[ONLINE] -> http://localhost:8081" } else { "[OFFLINE]" }
    $mobileColor = if ($mobileOk) { "Green" } else { "Red" }
    Write-Host ("  {0,-28} : {1}" -f "Mobile App Web", $mobileStatus) -ForegroundColor $mobileColor

    Write-Host "--------------------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host ""
}

function Stop-AllServices {
    Write-Warn "Dang tien hanh dung toan bo dich vu cua he thong..."

    Write-Info "Dang tat Docker containers..."
    docker compose -f "$DockerComposeFile" down 2>$null
    Write-Success "Da dung cac Docker containers."

    $portsToKill = @(8000, 8081)
    foreach ($p in $portsToKill) {
        $conns = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
        if ($conns) {
            foreach ($c in $conns) {
                if ($c.OwningProcess -gt 0) {
                    Write-Info "Dung tien trinh tren Port $p (PID: $($c.OwningProcess))..."
                    Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
                }
            }
        }
    }

    Write-Success "Toan bo he thong da duoc dung an toan!"
}

function Open-WebLinks {
    Write-Info "Dang mo cac lien ket tren trinh duyet..."
    Start-Process "http://localhost:8000/api/docs"
    Start-Process "http://localhost:8081"
    Start-Process "http://localhost:18083"
    Write-Success "Da mo cac trang web!"
}

function Start-AllServices {
    Write-Header
    Write-Host "  [+] BAT DAU KHOI DONG TOAN BO HE THONG TRONG 1 BUOC..." -ForegroundColor Green
    Write-Host ""

    $dockerOk = Start-DockerServices
    if (-not $dockerOk) {
        Write-ErrorMsg "Khong the khoi dong ha tang Docker. Vui long kiem tra Docker Desktop!"
        return
    }

    Start-Sleep -Seconds 2

    Start-BackendService
    Start-Sleep -Seconds 2

    Start-MobileService -Platform "web"
    Start-Sleep -Seconds 2

    Write-Host ""
    Write-Success "KHOI DONG THANH CONG TAT CA CAC THANH PHAN!"
    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host "  DIA CHI TRUY CAP CAC DICH VU:" -ForegroundColor Yellow
    Write-Host "  - Mobile App Web        : http://localhost:8081" -ForegroundColor White
    Write-Host "  - Swagger API Docs      : http://localhost:8000/api/docs" -ForegroundColor White
    Write-Host "  - EMQX MQTT Dashboard   : http://localhost:18083  (User: admin / public)" -ForegroundColor White
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host ""

    $openNow = Read-Host "Ban co muon mo ngay Mobile App & Swagger Docs tren trinh duyet? (Y/N) [Mac dinh: Y]"
    if ($openNow -eq "" -or $openNow -match "^[yY]") {
        Start-Process "http://localhost:8000/api/docs"
        Start-Process "http://localhost:8081"
    }
}

switch ($Target.ToLower()) {
    "all"     { Start-AllServices; exit }
    "docker"  { Start-DockerServices; exit }
    "backend" { Start-BackendService; exit }
    "mobile"  { Start-MobileService -Platform "web"; exit }
    "edge"    { Start-EdgeService; exit }
    "status"  { Show-SystemStatus; exit }
    "stop"    { Stop-AllServices; exit }
    "open"    { Open-WebLinks; exit }
}

do {
    Write-Header
    Show-SystemStatus

    Write-Host "  CHON TAC VU BAN MUON THUC HIEN:" -ForegroundColor Yellow
    Write-Host "  ------------------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  [1] Khoi dong TOAN BO (Docker + Backend FastAPI + Mobile Web)" -ForegroundColor Green
    Write-Host "  [2] Khoi dong Ha tang Docker (TimescaleDB, Redis, EMQX)" -ForegroundColor Cyan
    Write-Host "  [3] Khoi dong Cloud Backend FastAPI (localhost:8000)" -ForegroundColor Cyan
    Write-Host "  [4] Khoi dong Mobile App Web (localhost:8081)" -ForegroundColor Cyan
    Write-Host "  [5] Khoi dong Edge Hub AI (Kiem tra Camera / Cam bien)" -ForegroundColor Cyan
    Write-Host "  ------------------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  [6] Kiem tra lai trang thai he thong (Health Check)" -ForegroundColor White
    Write-Host "  [7] Mo cac trang quan tri Web (Swagger, EMQX, Mobile App)" -ForegroundColor White
    Write-Host "  [8] Dung toan bo he thong (Docker Down & Tat processes)" -ForegroundColor Yellow
    Write-Host "  [0] Thoat" -ForegroundColor Red
    Write-Host "  ------------------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host ""

    $choice = Read-Host "  Nhap lua chon cua ban (0-8)"

    switch ($choice) {
        "1" { Start-AllServices; Write-Host "Nhan Enter de tiep tuc..."; [void][System.Console]::ReadLine() }
        "2" { Start-DockerServices; Write-Host "Nhan Enter de tiep tuc..."; [void][System.Console]::ReadLine() }
        "3" { Start-BackendService; Write-Host "Nhan Enter de tiep tuc..."; [void][System.Console]::ReadLine() }
        "4" { Start-MobileService -Platform "web"; Write-Host "Nhan Enter de tiep tuc..."; [void][System.Console]::ReadLine() }
        "5" { Start-EdgeService; Write-Host "Nhan Enter de tiep tuc..."; [void][System.Console]::ReadLine() }
        "6" { Write-Info "Dang kiem tra..."; Start-Sleep -Seconds 1 }
        "7" { Open-WebLinks; Write-Host "Nhan Enter de tiep tuc..."; [void][System.Console]::ReadLine() }
        "8" { Stop-AllServices; Write-Host "Nhan Enter de tiep tuc..."; [void][System.Console]::ReadLine() }
        "0" { Write-Host "`nTam biet!`n"; break }
        default { Write-Warn "Lua chon khong hop le, vui long chon tu 0 den 8."; Start-Sleep -Seconds 2 }
    }
} while ($choice -ne "0")