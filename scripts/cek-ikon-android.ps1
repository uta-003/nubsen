# Memeriksa ikon & splash NUBSEN: dimensi berkas di android/app/src/main/res
# serta kesesuaiannya dengan yang benar-benar masuk ke dalam APK.
# Pakai:  powershell -ExecutionPolicy Bypass -File scripts\cek-ikon-android.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$res = Join-Path $root 'android\app\src\main\res'
$apk = Join-Path $root 'NUBSEN-debug.apk'

if (-not (Test-Path $res)) { throw "Folder res Android tidak ada: $res" }

# Daftar berkas yang harus ada beserta ukuran pikselnya (sumber: scripts/buat-ikon-android.ps1).
$harus = [ordered]@{}
foreach ($d in @(@('mdpi', 48, 108), @('hdpi', 72, 162), @('xhdpi', 96, 216), @('xxhdpi', 144, 324), @('xxxhdpi', 192, 432))) {
  $nama = $d[0]; $ikon = $d[1]; $adaptif = $d[2]
  $harus["mipmap-$nama\ic_launcher.png"] = @($ikon, $ikon)
  $harus["mipmap-$nama\ic_launcher_round.png"] = @($ikon, $ikon)
  $harus["mipmap-$nama\ic_launcher_foreground.png"] = @($adaptif, $adaptif)
}
$harus['drawable\splash.png'] = @(480, 320)
$harus['drawable-land-mdpi\splash.png'] = @(480, 320)
$harus['drawable-land-hdpi\splash.png'] = @(800, 480)
$harus['drawable-land-xhdpi\splash.png'] = @(1280, 720)
$harus['drawable-land-xxhdpi\splash.png'] = @(1600, 960)
$harus['drawable-land-xxxhdpi\splash.png'] = @(1920, 1280)
$harus['drawable-port-mdpi\splash.png'] = @(320, 480)
$harus['drawable-port-hdpi\splash.png'] = @(480, 800)
$harus['drawable-port-xhdpi\splash.png'] = @(720, 1280)
$harus['drawable-port-xxhdpi\splash.png'] = @(960, 1600)
$harus['drawable-port-xxxhdpi\splash.png'] = @(1280, 1920)

$salah = 0
Write-Host '== Berkas di res/ ==' -ForegroundColor Cyan
foreach ($k in $harus.Keys) {
  $path = Join-Path $res $k
  if (-not (Test-Path $path)) { Write-Host "  HILANG  $k" -ForegroundColor Red; $salah++; continue }
  $img = [System.Drawing.Image]::FromFile($path)
  $ok = ($img.Width -eq $harus[$k][0] -and $img.Height -eq $harus[$k][1])
  Write-Host ("  {0}  {1}  {2}x{3}" -f $(if ($ok) { 'OK    ' } else { 'UKURAN' }), $k, $img.Width, $img.Height) -ForegroundColor $(if ($ok) { 'Green' } else { 'Red' })
  if (-not $ok) { $salah++ }
  $img.Dispose()
}

Write-Host '== Nilai warna & XML ikon adaptif ==' -ForegroundColor Cyan
$bg = Join-Path $res 'values\ic_launcher_background.xml'
if (Test-Path $bg) {
  $isi = Get-Content $bg -Raw
  if ($isi -match '#0A1D57') { Write-Host '  OK      values\ic_launcher_background.xml memakai navy #0A1D57' -ForegroundColor Green }
  else { Write-Host '  SALAH   values\ic_launcher_background.xml bukan #0A1D57' -ForegroundColor Red; $salah++ }
} else { Write-Host '  HILANG  values\ic_launcher_background.xml' -ForegroundColor Red; $salah++ }
foreach ($f in @('values\colors.xml', 'mipmap-anydpi-v26\ic_launcher.xml', 'mipmap-anydpi-v26\ic_launcher_round.xml')) {
  if (Test-Path (Join-Path $res $f)) { Write-Host "  OK      $f" -ForegroundColor Green }
  else { Write-Host "  HILANG  $f" -ForegroundColor Red; $salah++ }
}

if (-not (Test-Path $apk)) {
  Write-Host "`nAPK belum ada ($apk) - jalankan npm run android:apk dulu." -ForegroundColor Yellow
  exit $salah
}

Write-Host '== Isi APK ==' -ForegroundColor Cyan
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $apk).Path)
$sama = 0; $beda = 0
foreach ($k in $harus.Keys) {
  $entri = $k -replace '\\', '/'
  if ($entri -match '^(mipmap-[a-z]+|drawable-(?:land|port)-[a-z]+)/(.+)$') { $entri = "res/$($Matches[1])-v4/$($Matches[2])" }
  else { $entri = "res/$entri" }
  $e = $zip.Entries | Where-Object { $_.FullName -eq $entri }
  if (-not $e) { Write-Host "  TIDAK ADA di APK: $entri" -ForegroundColor Red; $beda++; continue }
  $tmp = Join-Path $env:TEMP ("nubsen-ekstrak-" + [System.IO.Path]::GetFileName($k))
  [System.IO.Compression.ZipFileExtensions]::ExtractToFile($e, $tmp, $true)
  $h1 = (Get-FileHash $tmp).Hash
  $h2 = (Get-FileHash (Join-Path $res $k)).Hash
  if ($h1 -eq $h2) { $sama++ } else { Write-Host "  BEDA dari res/: $entri" -ForegroundColor Red; $beda++ }
  Remove-Item $tmp -Force
}
$zip.Dispose()
Write-Host ("  {0} berkas di APK COCOK dengan res/, {1} bermasalah" -f $sama, $beda) -ForegroundColor $(if ($beda -eq 0) { 'Green' } else { 'Red' })
$salah += $beda

if ($salah -eq 0) { Write-Host "`nSemua ikon & splash NUBSEN OK." -ForegroundColor Green }
else { Write-Host "`nAda $salah masalah - jalankan scripts\buat-ikon-android.ps1 lalu build ulang." -ForegroundColor Red }
exit $salah