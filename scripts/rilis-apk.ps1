# ============================================================================
#  rilis-apk.ps1 - Unggah APK NUBSEN ke GitHub Releases.
#
#  APK sengaja TIDAK ikut git (lihat .gitignore: *.apk) agar riwayat repo tetap
#  ramping. GitHub Release adalah cara resmi membagikan biner: karyawan cukup
#  membuka tautan rilis di HP lalu mengunduh & memasang APK-nya.
#
#  Contoh:
#    .\scripts\rilis-apk.ps1                       # tag v1.0.0, token dari git credential
#    .\scripts\rilis-apk.ps1 -Tag v1.0.1 -GitHubToken ghp_xxx
#    .\scripts\rilis-apk.ps1 -Repo uta-003/nubsen -Pratinjau
# ============================================================================
param(
  [string]$GitHubToken = '',
  [string]$Repo = '',
  [string]$Tag = 'v1.0.0',
  [string]$NamaRilis = '',
  [string]$Catatan = '',
  [string]$Apk = 'NUBSEN-debug.apk',
  [string]$Branch = 'main',
  [switch]$Pratinjau
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Langkah($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }
function Info($t) { Write-Host "    $t" }
function Sukses($t) { Write-Host "    OK  $t" -ForegroundColor Green }
function Peringatan($t) { Write-Host "    !   $t" -ForegroundColor Yellow }
function Gagal($t) { Write-Host "    XX  $t" -ForegroundColor Red; exit 1 }

# ---------------------------------------------------------------------------
Langkah '1. Berkas APK'
if (-not (Test-Path $Apk)) { Gagal "APK tidak ditemukan: $Apk - jalankan dulu: npm run android:apk" }
$apkPath = (Resolve-Path $Apk).Path
$info = Get-Item $apkPath
$sha = (Get-FileHash $apkPath -Algorithm SHA256).Hash
Sukses "$($info.Name) - $([Math]::Round($info.Length / 1MB, 2)) MB, dibuat $($info.LastWriteTime)"
Info "SHA256: $sha"

# ---------------------------------------------------------------------------
Langkah '2. Repositori tujuan'
if (-not $Repo) {
  $url = (git remote get-url origin 2>$null)
  if ($url -match 'github\.com[:/](?<owner>[^/]+)/(?<repo>[^/.]+)') { $Repo = "$($Matches.owner)/$($Matches.repo)" }
}
if (-not $Repo) { Gagal 'Repo tidak dikenali. Isi manual: -Repo pengguna/nama-repo' }
Sukses "Repo: $Repo"

# ---------------------------------------------------------------------------
Langkah '3. Token GitHub'
if (-not $GitHubToken) { $GitHubToken = $env:GITHUB_TOKEN }
if (-not $GitHubToken) {
  # Kredensial yang sudah tersimpan untuk push (Git Credential Manager).
  $kred = "protocol=https`nhost=github.com`n`n" | git credential fill 2>$null
  $GitHubToken = (($kred | Where-Object { $_ -match '^password=' }) -replace '^password=', '')
}
if (-not $GitHubToken) {
  Gagal 'Token tidak ada. Isi -GitHubToken ghp_xxx atau set env GITHUB_TOKEN (scope: repo).'
}
Sukses 'Token GitHub siap (nilainya tidak dicetak demi keamanan).'

$hdr = @{
  Authorization          = "Bearer $GitHubToken"
  Accept                 = 'application/vnd.github+json'
  'User-Agent'           = 'nubsen-rilis'
  'X-GitHub-Api-Version' = '2022-11-28'
}

try { $me = Invoke-RestMethod 'https://api.github.com/user' -Headers $hdr -TimeoutSec 30 }
catch { Gagal "Token tidak valid / tanpa internet: $($_.Exception.Message)" }
Info "Login sebagai: $($me.login)"

# ---------------------------------------------------------------------------
Langkah '4. Catatan rilis'
$commit = (git rev-parse HEAD 2>$null)
$commitSingkat = if ($commit) { $commit.Substring(0, 7) } else { 'tidak diketahui' }
if (-not $NamaRilis) { $NamaRilis = "NUBSEN $Tag - APK debug (uji coba)" }
Info "Nama rilis: $NamaRilis"
Info "Tag: $Tag  (commit $commitSingkat)"

if (-not $Catatan) {
  $Catatan = @"
APK uji coba (debug) NUBSEN - aplikasi absensi karyawan.

Sumber: commit $commit pada branch $Branch.

Perbaikan penting pada build ini:
- GPS/lokasi: izin ACCESS_FINE_LOCATION & ACCESS_COARSE_LOCATION serta CAMERA
  ditambahkan ke AndroidManifest. Sebelumnya Capacitor membalas "izin ditolak"
  ke WebView sehingga aplikasi selalu menampilkan "Lokasi gagal diperbarui".
- Permintaan lokasi dua tahap: GPS presisi 12 detik, lalu fallback akurasi
  jaringan 10 detik (tidak diulang bila izin benar-benar ditolak).
- Kegagalan lokasi kini selalu tampil sebagai peringatan pada kartu "Lokasi
  Anda" (sebelumnya senyap bila koordinat lama masih terlihat) dan memuat
  langkah perbaikan yang konkret.
- Ikon & splash ber-brand NUBSEN untuk semua densitas; colors.xml dipulihkan.

Cara memasang:
1. Buka halaman rilis ini di HP, lalu unduh NUBSEN-debug.apk.
2. Izinkan "instal dari sumber tidak dikenal" bila diminta.
3. Uninstall NUBSEN versi lama lebih dulu agar ikon tidak ter-cache launcher.
4. Saat aplikasi meminta izin, pilih Izinkan untuk Lokasi.

Catatan: ini build debug (belum untuk Play Store); halaman web di dalamnya
memuat https://nubsen.vercel.app.

SHA256: $sha
"@
}

# ---------------------------------------------------------------------------
Langkah '5. Membuat rilis di GitHub'
$rel = $null
try { $rel = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/tags/$Tag" -Headers $hdr -TimeoutSec 30 }
catch { $rel = $null }
if ($rel) {
  Peringatan "Tag $Tag sudah ada - memakai rilis yang ada (#$($rel.id))."
} elseif ($Pratinjau) {
  Info "Pratinjau: POST https://api.github.com/repos/$Repo/releases (tag $Tag)"
} else {
  $body = @{
    tag_name         = $Tag
    target_commitish = $Branch
    name             = $NamaRilis
    body             = $Catatan
    draft            = $false
    prerelease       = $false
  } | ConvertTo-Json -Depth 4
  try {
    $rel = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases" -Method Post -Headers $hdr -Body $body -ContentType 'application/json' -TimeoutSec 60
    Sukses "Rilis dibuat: $($rel.html_url)"
  } catch { Gagal "Gagal membuat rilis: $($_.Exception.Message)" }
}

# ---------------------------------------------------------------------------
Langkah '6. Mengunggah APK'
if ($Pratinjau) {
  Info "Pratinjau: unggahan dilewati (aset: $([System.IO.Path]::GetFileName($apkPath)))."
} else {
  $nama = [System.IO.Path]::GetFileName($apkPath)
  $lama = $rel.assets | Where-Object { $_.name -eq $nama }
  if ($lama) {
    Info 'Aset dengan nama sama sudah ada - menghapus yang lama...'
    Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/assets/$($lama.id)" -Method Delete -Headers $hdr -TimeoutSec 30 | Out-Null
  }
  $unggah = "https://uploads.github.com/repos/$Repo/releases/$($rel.id)/assets?name=$nama"
  $aset = $null
  $teks = ''
  if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
    # curl.exe dipakai agar Content-Length pasti terkirim (syarat API unggah GitHub).
    $teks = (& curl.exe -sS -X POST -H "Authorization: Bearer $GitHubToken" `
        -H 'Content-Type: application/vnd.android.package-archive' `
        --data-binary "@$apkPath" $unggah 2>&1) -join "`n"
    try { $aset = $teks | ConvertFrom-Json } catch { $aset = $null }
  } else {
    try {
      $aset = Invoke-RestMethod $unggah -Method Post -Headers $hdr -ContentType 'application/vnd.android.package-archive' -InFile $apkPath -TimeoutSec 300
    } catch { $aset = $null }
  }
  if (-not $aset -or -not $aset.browser_download_url) { Gagal "Unggah gagal: $teks" }
  Sukses "Terunggah: $($aset.name) - $([Math]::Round($aset.size / 1MB, 2)) MB"
  Write-Host "`nTautan unduh langsung (buka di HP):" -ForegroundColor Cyan
  Write-Host "    $($aset.browser_download_url)" -ForegroundColor Cyan
  Write-Host "Halaman rilis: $($rel.html_url)" -ForegroundColor Cyan
}

Write-Host "`nSelesai." -ForegroundColor Green
