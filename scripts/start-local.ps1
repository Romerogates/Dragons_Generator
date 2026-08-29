# Local stack (mirrors prod routes: /api, SPA)
# Requires Docker Desktop running.
# Frontend http://localhost:8081  |  API http://localhost:8080/swagger

param(
    [switch]$Build,
    [switch]$Down
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

if ($Down) {
    docker compose -f "$Root\docker-compose.local.yml" down
    exit 0
}

if (-not (docker info 2>$null)) {
    Write-Error "Docker n'est pas demarre. Lance Docker Desktop puis relance ce script."
}

$args = @('-f', "$Root\docker-compose.local.yml", 'up', '-d')
if ($Build) { $args += '--build' }

docker compose @args
Write-Host "`n--- Local ---"
Write-Host "Web  : http://localhost:8081"
Write-Host "API  : http://localhost:8080/swagger"
Write-Host "Mail : http://localhost:8025"
Write-Host "Admin: admin@dragons.local / AdminDragons!2026"
Write-Host "Test : anthony.martinr@hotmail.be / Ma3ds3ds  |  test@dragons.local / TestDragons!2026"
