# Vérifie tests + stack locale (comme CI, sans deploy)
# Usage:
#   .\scripts\run-tests.ps1              # API (Docker) + Angular unitaires
#   .\scripts\run-tests.ps1 -E2E         # + E2E Playwright (stack locale requise)
#   .\scripts\run-tests.ps1 -E2E -Build # rebuild stack avant E2E

param(
    [switch]$E2E,
    [switch]$Build
)

$ErrorActionPreference = 'Stop'
$ScriptDir = $PSScriptRoot
$Root = Split-Path -Parent $ScriptDir
$WebRoot = Join-Path $Root 'DragonsGenerator.WEB'

function Test-DockerReady {
    try {
        docker info *> $null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

if (-not (Test-DockerReady)) {
    Write-Error "Docker requis pour les tests API (SDK .NET 9 dans le conteneur). Lance Docker Desktop."
}

Write-Host "=== Validation JSON classes ===" -ForegroundColor Cyan
node (Join-Path $Root 'scripts\validate-class-json.mjs')

Write-Host "`n=== Tests API (conteneur SDK .NET 9) ===" -ForegroundColor Cyan
docker compose -f (Join-Path $Root 'docker-compose.test.yml') run --rm api-tests

Write-Host "`n=== Tests Angular (215+) ===" -ForegroundColor Cyan
Push-Location $WebRoot
npm test
if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }

Write-Host "`n=== Lint Angular ===" -ForegroundColor Cyan
npm run lint
if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
Pop-Location

if ($E2E) {
    Write-Host "`n=== Stack locale pour E2E ===" -ForegroundColor Cyan
    $startArgs = @()
    if ($Build) { $startArgs += '-Build' }
    & (Join-Path $Root 'scripts\start-local.ps1') @startArgs

    Write-Host "`n=== E2E Playwright (smoke CI) ===" -ForegroundColor Cyan
    Push-Location $WebRoot
    $env:E2E_BASE_URL = 'http://localhost:8081'
    npx playwright install chromium 2>$null
    npm run e2e:ci
    $e2eCode = $LASTEXITCODE
    Pop-Location
    if ($e2eCode -ne 0) { exit $e2eCode }
}

Write-Host "`n=== Tous les tests demandés sont OK ===" -ForegroundColor Green
