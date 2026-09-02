# Stack locale — démarrage + attente health (comme la CI)
# Usage:
#   .\scripts\start-local.ps1 -Build          # rebuild + démarrage
#   .\scripts\start-local.ps1                 # démarrage sans rebuild
#   .\scripts\start-local.ps1 -Down           # arrêt

param(
    [switch]$Build,
    [switch]$Down,
    [switch]$NoWait
)

$ErrorActionPreference = 'Stop'
$ScriptDir = $PSScriptRoot
$Root = Split-Path -Parent $ScriptDir
$ComposeFile = Join-Path $Root 'docker-compose.local.yml'

if ($Down) {
    docker compose -f $ComposeFile down
    exit 0
}

function Test-DockerReady {
    try {
        docker info *> $null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

if (-not (Test-DockerReady)) {
    Write-Error "Docker n'est pas démarré. Lance Docker Desktop puis relance ce script."
}

$composeArgs = @('-f', $ComposeFile, 'up', '-d')
if ($Build) { $composeArgs += '--build' }

Write-Host "=== Démarrage stack locale ===" -ForegroundColor Cyan
docker compose @composeArgs mailhog ollama
if ($Build) {
    docker compose -f $ComposeFile build dragons-api dragons-web
}
docker compose -f $ComposeFile up -d dragons-api dragons-web

if (-not $NoWait) {
    Write-Host "Attente des services (max 5 min)…" -ForegroundColor Yellow
    $ready = $false
    for ($i = 1; $i -le 60; $i++) {
        try {
            $webOk = (Invoke-WebRequest -Uri 'http://localhost:8081/' -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200
            $apiOk = (Invoke-WebRequest -Uri 'http://localhost:8081/api/species/summary' -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200
            if ($webOk -and $apiOk) {
                Write-Host "Stack prête après $i tentative(s)." -ForegroundColor Green
                $ready = $true
                break
            }
        } catch {
            # retry
        }
        Write-Host "  … en attente ($i/60)"
        Start-Sleep -Seconds 5
    }
    if (-not $ready) {
        Write-Error "La stack n'a pas répondu à temps. Logs API : docker logs dragons-api-local --tail 80"
    }
}

Write-Host ""
Write-Host "--- Local (Docker) ---" -ForegroundColor Cyan
Write-Host "App  : http://localhost:8081"
Write-Host "API  : http://localhost:8080/swagger"
Write-Host "Mail : http://localhost:8025"
Write-Host ""
Write-Host "Comptes seed :"
Write-Host "  admin@dragons.local / AdminDragons!2026"
Write-Host "  test@dragons.local / TestDragons!2026"
Write-Host ""
Write-Host "Compte perso (optionnel) : copier .env.local.example -> .env.local (gitignored)"
Write-Host "Front hot-reload (API Docker) :"
Write-Host "  cd DragonsGenerator.WEB"
Write-Host "  npm start   -> http://localhost:4200 (proxy /api -> :8080)"
