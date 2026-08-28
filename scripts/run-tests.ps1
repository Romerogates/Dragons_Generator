# Run API tests (needs Docker). Angular tests run locally via npm test.
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (docker info 2>$null)) {
    Write-Error "Docker requis pour les tests API (SDK .NET 9 dans le conteneur)."
}

Write-Host "=== API tests (dotnet SDK 9 container) ==="
docker compose -f "$Root\docker-compose.test.yml" run --rm api-tests

Write-Host "`n=== Angular tests ==="
Push-Location "$Root\DragonsGenerator.WEB"
npm test
Pop-Location
