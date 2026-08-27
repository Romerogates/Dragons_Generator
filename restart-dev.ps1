# Relance API + front Dragons Generator (dev local)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$api = Join-Path $root "DragonsGenerator.API"
$web = Join-Path $root "DragonsGenerator.WEB"

Get-NetTCPConnection -LocalPort 4200,5117 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 2

$env:Path = "$env:LOCALAPPDATA\Microsoft\dotnet;$env:Path"

Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "Set-Location '$api'; dotnet run --launch-profile http"
)

Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "Set-Location '$web'; npm start -- --host 0.0.0.0 --port 4200"
)

Write-Host "Deux fenetres PowerShell ouvertes (API :5117, Front :4200)."
Write-Host "PC    : http://localhost:4200"
Write-Host "Mobile: http://192.168.68.137:4200"
