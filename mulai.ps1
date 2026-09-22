# Peluncur NUBSEN â€” menyalakan backend (:9091) dan frontend (:9090) sekaligus.
# Pakai:  powershell -ExecutionPolicy Bypass -File .\mulai.ps1
#         npm run mulai            (dari folder absensi-app)
param([switch]$TanpaBrowser)

$root   = $PSScriptRoot
$server = Join-Path $root 'server'

function Test-PortAktif($p) {
  return [bool](Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)
}

Write-Host "=== NUBSEN ===" -ForegroundColor Cyan

# Pasang dependensi bila belum ada.
if (-not (Test-Path (Join-Path $server 'node_modules'))) {
  Write-Host 'Memasang dependensi backend...' -ForegroundColor Yellow
  Push-Location $server; npm install --no-audit --no-fund | Out-Null; Pop-Location
}
if (-not (Test-Path (Join-Path $root 'node_modules'))) {
  Write-Host 'Memasang dependensi frontend...' -ForegroundColor Yellow
  Push-Location $root; npm install --no-audit --no-fund | Out-Null; Pop-Location
}

# Backend (Express + SQLite) â€” sekaligus menyajikan panel web admin.
if (Test-PortAktif 9091) {
  Write-Host 'Backend :9091 sudah berjalan â€” dilewati.' -ForegroundColor DarkGray
} else {
  Start-Process powershell -ArgumentList '-NoExit', '-Command', `
    "`$Host.UI.RawUI.WindowTitle='NUBSEN Backend :9091'; Set-Location '$server'; node index.js"
  Write-Host 'Backend :9091 diluncurkan di jendela baru.' -ForegroundColor Green
}

# Frontend (Vite dev, hot reload).
if (Test-PortAktif 9090) {
  Write-Host 'Frontend :9090 sudah berjalan â€” dilewati.' -ForegroundColor DarkGray
} else {
  Start-Process powershell -ArgumentList '-NoExit', '-Command', `
    "`$Host.UI.RawUI.WindowTitle='NUBSEN Frontend :9090'; Set-Location '$root'; npm run dev"
  Write-Host 'Frontend :9090 diluncurkan di jendela baru.' -ForegroundColor Green
}

# Tunggu backend siap (maks 25 detik).
$siap = $false
foreach ($i in 1..25) {
  Start-Sleep -Seconds 1
  try {
    $r = Invoke-RestMethod 'http://localhost:9091/api/health' -TimeoutSec 2
    if ($r.data.status -eq 'ok') { $siap = $true; break }
  } catch { }
}

Write-Host ''
if ($siap) {
  Write-Host 'âœ” Backend siap.' -ForegroundColor Green
} else {
  Write-Host 'âš  Backend belum merespons â€” cek jendela "NUBSEN Backend :9091".' -ForegroundColor Yellow
}

Write-Host 'â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€' -ForegroundColor DarkGray
Write-Host ' Aplikasi (frontend dev)  : http://localhost:9090'          -ForegroundColor White
Write-Host ' Panel admin (web backend): http://localhost:9091/#admin'   -ForegroundColor White
Write-Host ' API health               : http://localhost:9091/api/health' -ForegroundColor White
Write-Host 'â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€' -ForegroundColor DarkGray
Write-Host ' Database mulai KOSONG (tanpa data contoh).' -ForegroundColor DarkGray
Write-Host ' Buka aplikasi -> form "Pengaturan Awal" untuk membuat akun admin pertama.' -ForegroundColor White
Write-Host ' Tutup jendela server untuk menghentikan. Ctrl+C juga bisa.' -ForegroundColor DarkGray

if (-not $TanpaBrowser) {
  Start-Process 'http://localhost:9091/#admin'
  Write-Host ' Browser dibuka ke panel adminâ€¦' -ForegroundColor Cyan
}
