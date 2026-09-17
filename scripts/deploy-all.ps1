# ============================================================================
#  deploy-all.ps1 - Deploy NUBSEN ke internet dalam satu perintah.
#
#  Alur: GitHub (push repo) -> Render (backend + disk) -> Vercel (frontend)
#        -> set CORS_ORIGINS -> domain untuk APK.
#
#  Contoh:
#    .\scripts\deploy-all.ps1 -GitHubToken ghp_xxx -VercelToken vercel_xxx -RenderApiKey rnd_xxx
#    .\scripts\deploy-all.ps1 -GitHubToken x -VercelToken y -DryRun    # uji kering
# ============================================================================
param(
  [Parameter(Mandatory = $true)][string]$GitHubToken,
  [Parameter(Mandatory = $true)][string]$VercelToken,
  [string]$RenderApiKey = '',
  [string]$BackendUrl = '',
  [string]$RepoName = 'nubsen',
  [string]$ProjectName = 'nubsen',
  [string]$Branch = 'main',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Langkah($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }
function Info($t) { Write-Host "    $t" }
function Sukses($t) { Write-Host "    OK  $t" -ForegroundColor Green }
function Peringatan($t) { Write-Host "    !   $t" -ForegroundColor Yellow }
function Gagal($t) { Write-Host "    XX  $t" -ForegroundColor Red; throw $t }

# ---------------------------------------------------------------------------
Langkah '0. Prasyarat & repo Git'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Gagal 'git tidak ditemukan.' }
if (-not (Test-Path '.git')) {
  Info 'Belum ada repositori Git - membuat...'
  if (-not $DryRun) { git init -q }
  Sukses 'git init'
}
$berkasKotor = (git status --porcelain | Measure-Object).Count
if ($berkasKotor -gt 0) {
  Info "Ada $berkasKotor perubahan belum di-commit."
  if ($DryRun) {
    Info 'DRYRUN: git add -A && git commit'
  } else {
    git add -A
    git -c user.name='NUBSEN Dev' -c user.email='dev@nubsen.local' commit -q -m "deploy: pembaruan sebelum deploy"
    Sukses 'commit dibuat'
  }
} else { Sukses 'working tree bersih' }
if (-not $DryRun) { git branch -M $Branch }
Info "Branch: $Branch"

# ---------------------------------------------------------------------------
Langkah '1. GitHub - membuat repo & mendorong kode'
$ghHeaders = @{
  Authorization          = "Bearer $GitHubToken"
  Accept                 = 'application/vnd.github+json'
  'User-Agent'           = 'nubsen-deploy'
  'X-GitHub-Api-Version' = '2022-11-28'
}
$login = 'dryrun-user'
if ($DryRun) {
  Info 'DRYRUN: GET  https://api.github.com/user'
  Info "DRYRUN: POST https://api.github.com/user/repos  (name=$RepoName, private=false)"
  Info "DRYRUN: git push origin $Branch"
} else {
  try { $user = Invoke-RestMethod 'https://api.github.com/user' -Headers $ghHeaders -TimeoutSec 30 }
  catch { Gagal "Token GitHub tidak valid / tidak ada internet: $($_.Exception.Message)" }
  $login = $user.login
  Sukses "Login GitHub sebagai: $login"

  $body = @{ name = $RepoName; private = $false; auto_init = $false } | ConvertTo-Json
  try {
    Invoke-RestMethod 'https://api.github.com/user/repos' -Method Post -Headers $ghHeaders -Body $body -ContentType 'application/json' -TimeoutSec 30 | Out-Null
    Sukses "Repo dibuat: $login/$RepoName"
  } catch {
    Peringatan "Repo mungkin sudah ada - melanjutkan."
  }

  $repoUrl = "https://github.com/$login/$RepoName.git"
  $repoTok = "https://$login`:$GitHubToken@github.com/$login/$RepoName.git"
  git remote remove origin 2>$null
  git remote add origin $repoUrl
  git remote set-url origin $repoTok
  try { git push -u origin $Branch --force } finally { git remote set-url origin $repoUrl }
  Sukses "Kode terkirim ke $repoUrl"
}

# ---------------------------------------------------------------------------
Langkah '2. Render - backend (Express + SQLite + disk persisten)'
$backendFinal = $BackendUrl
if ($backendFinal) {
  Sukses "Backend dipakai dari parameter: $backendFinal"
} elseif (-not $RenderApiKey) {
  Peringatan 'RenderApiKey tidak diberikan - pembuatan backend otomatis dilewati.'
  Info 'Buat manual: Render Dashboard -> New + -> Blueprint -> pilih repo -> Render membaca render.yaml.'
  Info 'Setelah service jadi, jalankan ulang: .\scripts\deploy-all.ps1 -GitHubToken x -VercelToken y -BackendUrl https://xxx.onrender.com'
  if ($DryRun) { $backendFinal = 'https://nubsen-backend.onrender.com' }
} elseif ($DryRun) {
  Info 'DRYRUN: GET  https://api.render.com/v1/owners'
  Info 'DRYRUN: POST https://api.render.com/v1/services (web_service, rootDir=server, plan=free)'
  Info 'DRYRUN: tunggu URL service muncul (polling)'
  $backendFinal = 'https://nubsen-backend.onrender.com'
} else {
  $rHeaders = @{ Authorization = "Bearer $RenderApiKey"; Accept = 'application/json'; 'Content-Type' = 'application/json' }
  try { $owners = Invoke-RestMethod 'https://api.render.com/v1/owners' -Headers $rHeaders -TimeoutSec 30 }
  catch { Gagal "Render API key tidak valid: $($_.Exception.Message)" }
  $ownerId = $owners[0].owner.id
  Sukses "Owner Render: $($owners[0].owner.name) ($ownerId)"

  $body = @{
    type           = 'web_service'
    name           = 'nubsen-backend'
    ownerId        = $ownerId
    repo           = "https://github.com/$login/$RepoName"
    branch         = $Branch
    rootDir        = 'server'
    autoDeploy     = 'yes'
    serviceDetails = @{
      env             = 'node'
      plan            = 'free'
      region          = 'singapore'
      healthCheckPath = '/api/health'
      envSpecificDetails = @{ buildCommand = 'npm install'; startCommand = 'npm start' }
    }
    envVars        = @(
      @{ key = 'NODE_VERSION'; value = '24' },
      @{ key = 'NODE_ENV'; value = 'production' },
      @{ key = 'DATA_DIR'; value = '/var/data/db' },
      @{ key = 'UPLOAD_DIR'; value = '/var/data/uploads' }
    )
  } | ConvertTo-Json -Depth 8

  try {
    $svc = Invoke-RestMethod 'https://api.render.com/v1/services' -Method Post -Headers $rHeaders -Body $body -TimeoutSec 60
    Sukses "Service dibuat: $($svc.service.id)"
  } catch {
    Peringatan "Gagal membuat service via API: $($_.Exception.Message)"
    Info 'Fallback: buat lewat Render Dashboard (New + -> Blueprint -> repo Anda).'
  }

  Info 'Menunggu deploy pertama Render (3-6 menit)...'
  for ($i = 1; $i -le 40; $i++) {
    Start-Sleep -Seconds 15
    try {
      $list = Invoke-RestMethod 'https://api.render.com/v1/services?limit=50' -Headers $rHeaders -TimeoutSec 30
      $me = $list | Where-Object { $_.service.name -eq 'nubsen-backend' } | Select-Object -First 1
      $backendFinal = $me.service.serviceDetails.url
      if ($backendFinal) { break }
    } catch { }
    if ($i % 4 -eq 0) { Info "  ...masih menunggu ($($i * 15) detik)" }
  }
  if (-not $backendFinal) { Peringatan 'URL backend belum tersedia - jalankan ulang dengan -BackendUrl manual.' }
}
if ($backendFinal) { Sukses "Backend: $backendFinal" }

# ---------------------------------------------------------------------------
Langkah '3. Vercel - frontend (React + PWA)'
$vHeaders = @{ Authorization = "Bearer $VercelToken"; 'Content-Type' = 'application/json' }
$frontendUrl = ''
if ($DryRun) {
  Info "DRYRUN: POST https://api.vercel.com/v11/projects (name=$ProjectName)"
  Info "DRYRUN: POST https://api.vercel.com/v10/projects/$ProjectName/env (VITE_BACKEND_URL=$backendFinal)"
  Info 'DRYRUN: npx vercel link --yes --project ' + $ProjectName
  Info 'DRYRUN: npx vercel deploy --prod --yes'
  $frontendUrl = "https://$ProjectName.vercel.app"
} else {
  $body = @{ name = $ProjectName; framework = 'vite' } | ConvertTo-Json
  try {
    Invoke-RestMethod 'https://api.vercel.com/v11/projects' -Method Post -Headers $vHeaders -Body $body -TimeoutSec 30 | Out-Null
    Sukses "Project Vercel dibuat: $ProjectName"
  } catch { Peringatan 'Project mungkin sudah ada - melanjutkan.' }

  if ($backendFinal) {
    $envBody = @{
      key = 'VITE_BACKEND_URL'; value = $backendFinal
      type = 'plain'; target = @('production', 'preview')
    } | ConvertTo-Json
    try {
      Invoke-RestMethod "https://api.vercel.com/v10/projects/$ProjectName/env" -Method Post -Headers $vHeaders -Body $envBody -TimeoutSec 30 | Out-Null
      Sukses "Env VITE_BACKEND_URL diset ke $backendFinal"
    } catch { Peringatan "Gagal menyetel env Vercel: $($_.Exception.Message)" }
  } else {
    Peringatan 'Backend URL belum diketahui - set VITE_BACKEND_URL manual di dashboard Vercel.'
  }

  Info 'Menghubungkan & men-deploy (build Vite ~1 menit)...'
  npx vercel link --yes --project $ProjectName --token $VercelToken 2>&1 | Out-Null
  $outDeploy = npx vercel deploy --prod --yes --token $VercelToken 2>&1 | Out-String
  $m = [regex]::Match($outDeploy, 'https://[a-zA-Z0-9\.\-]+\.vercel\.app')
  if ($m.Success) { $frontendUrl = $m.Value; Sukses "Frontend live: $frontendUrl" }
  else { Peringatan 'URL frontend tidak terdeteksi dari keluaran CLI - cek dashboard Vercel.' }
}

# ---------------------------------------------------------------------------
Langkah '4. Sinkronisasi CORS backend <-> domain Vercel'
if ($RenderApiKey -and $frontendUrl -and -not $DryRun) {
  try {
    $list = Invoke-RestMethod 'https://api.render.com/v1/services?limit=50' -Headers @{ Authorization = "Bearer $RenderApiKey"; Accept = 'application/json' } -TimeoutSec 30
    $me = $list | Where-Object { $_.service.name -eq 'nubsen-backend' } | Select-Object -First 1
    if ($me) {
      $cors = @{ key = 'CORS_ORIGINS'; value = $frontendUrl } | ConvertTo-Json
      Invoke-RestMethod "https://api.render.com/v1/services/$($me.service.id)/env-vars" -Method Put -Headers @{ Authorization = "Bearer $RenderApiKey"; Accept = 'application/json'; 'Content-Type' = 'application/json' } -Body $cors -TimeoutSec 30 | Out-Null
      Sukses "CORS_ORIGINS backend = $frontendUrl"
    }
  } catch { Peringatan "Gagal menyetel CORS di Render: $($_.Exception.Message)" }
} else { Info 'Dilewati (butuh RenderApiKey & URL frontend).' }

# ---------------------------------------------------------------------------
Langkah '5. Aplikasi Android'
if ($frontendUrl) {
  Info "Menyetel domain aplikasi Android ke $frontendUrl"
  if (-not $DryRun) { & "$PSScriptRoot\set-url-android.ps1" -Url $frontendUrl }
  Sukses 'Siap: jalankan  npm run android:apk  untuk membangun APK ke domain ini.'
} else { Peringatan 'Domain belum diketahui - jalankan: npm run android:url -- https://domain-anda' }

# ---------------------------------------------------------------------------
Langkah 'SELESAI'
Write-Host @"

  +------------------------------------------------------------+
  |  NUBSEN ONLINE                                             |
  +------------------------------------------------------------+
   Frontend  : $frontendUrl
   Backend   : $backendFinal
   Panel     : $frontendUrl/#admin

   Login admin : afriani.putri@perusahaan.co.id / 123456
   Login staf  : budi.santoso@perusahaan.co.id  / 654321

   APK Android : npm run android:apk  ->  NUBSEN-debug.apk
   Perbarui    : git add -A; git commit -m "update"; git push
                 (Vercel & Render otomatis deploy ulang)
"@ -ForegroundColor Green


