# Vérifie que l'API locale répond (proxy ng serve -> localhost:8080)
# Usage: .\scripts\check-local-api.ps1

$ErrorActionPreference = 'Continue'

function Test-PortApi {
    param([string]$Url)
    try {
        $res = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 4
        return [pscustomobject]@{ Ok = $true; Code = $res.StatusCode; Detail = 'OK' }
    } catch {
        $code = $null
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        return [pscustomobject]@{ Ok = $false; Code = $code; Detail = $_.Exception.Message }
    }
}

Write-Host "=== Diagnostic API locale ===" -ForegroundColor Cyan

docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[KO] Docker daemon — non démarré" -ForegroundColor Red
    Write-Host "     -> Lance Docker Desktop, puis : .\scripts\start-local.ps1" -ForegroundColor Yellow
} else {
    Write-Host "[OK] Docker daemon" -ForegroundColor Green
    $apiContainer = docker ps --filter "name=dragons-api-local" --format "{{.Status}}" 2>$null
    if ($apiContainer) {
        Write-Host "[OK] Conteneur dragons-api-local : $apiContainer" -ForegroundColor Green
    } else {
        Write-Host "[KO] Conteneur dragons-api-local absent" -ForegroundColor Red
        Write-Host "     -> .\scripts\start-local.ps1" -ForegroundColor Yellow
    }
}

$direct = Test-PortApi 'http://localhost:8080/species/summary'
if ($direct.Ok) {
    Write-Host "[OK] API directe :8080 ($($direct.Code))" -ForegroundColor Green
} else {
    Write-Host "[KO] API directe :8080 — $($direct.Detail)" -ForegroundColor Red
}

foreach ($port in @(4200, 8081)) {
    $proxy = Test-PortApi "http://localhost:$port/api/species/summary"
    if ($proxy.Ok) {
        Write-Host "[OK] Proxy ng serve :$port/api ($($proxy.Code))" -ForegroundColor Green
    } elseif ($proxy.Code -eq 500 -and -not $direct.Ok) {
        Write-Host "[KO] Proxy :$port/api -> 500 (API :8080 injoignable, pas un bug front)" -ForegroundColor Red
    } else {
        Write-Host "[--] ng serve :$port — $($proxy.Detail)" -ForegroundColor DarkYellow
    }
}

Write-Host ""
Write-Host "Front hot-reload : cd DragonsGenerator.WEB && npm start" -ForegroundColor Cyan
Write-Host "Stack complète   : .\scripts\start-local.ps1 -Build" -ForegroundColor Cyan
