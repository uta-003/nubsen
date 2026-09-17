# Mengubah URL aplikasi Android (server.url di capacitor.config.json).
# Contoh:  npm run android:url -- https://nubsen.vercel.app
param([Parameter(Mandatory = $true)][string]$Url)

$cfg = Join-Path (Split-Path -Parent $PSScriptRoot) 'capacitor.config.json'
if (-not (Test-Path $cfg)) { Write-Error "capacitor.config.json tidak ditemukan: $cfg"; exit 1 }

$json = Get-Content $cfg -Raw | ConvertFrom-Json
if (-not $json.server) { $json.server = [pscustomobject]@{} }
$json.server.url = $Url

$json | ConvertTo-Json -Depth 10 | Set-Content $cfg -Encoding utf8
Write-Host "OK  URL aplikasi Android diset ke: $Url" -ForegroundColor Green
Write-Host "    Lanjutkan: npm run android:sync  lalu  npm run android:apk" -ForegroundColor Cyan
