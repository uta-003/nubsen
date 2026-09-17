# Membangun APK debug NUBSEN tanpa perlu membuka Android Studio.
# Pakai:  npm run android:apk
# Hasil:  NUBSEN-debug.apk di folder root proyek.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

# 1) JDK: Gradle 8.2.1 (Capacitor 6) butuh JDK 17.
#    Prioritas: JDK 17 portabel di %LOCALAPPDATA%\NubsenTools ->
#    JAVA_HOME yang sudah diset -> JBR bawaan Android Studio (JDK 25, sering tidak cocok).
$portable = Get-ChildItem "$env:LOCALAPPDATA\NubsenTools" -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like 'jdk-17*' } | Select-Object -First 1
if ($portable) {
  $env:JAVA_HOME = $portable.FullName
} elseif ($env:JAVA_HOME) {
  # pakai yang sudah ada
} elseif (Test-Path 'C:\Program Files\Android\Android Studio\jbr') {
  $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
} else {
  Write-Warning 'JDK 17 tidak ditemukan. Lihat DEPLOY.md §6 untuk cara memasangnya.'
}
Write-Host "JAVA_HOME = $env:JAVA_HOME"

# 2) Android SDK
if (-not $env:ANDROID_HOME) {
  $sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
  if (Test-Path $sdk) { $env:ANDROID_HOME = $sdk }
}
if (-not $env:ANDROID_HOME) { Write-Warning 'ANDROID_HOME tidak ditemukan.' }
Write-Host "ANDROID_HOME = $env:ANDROID_HOME"

$androidDir = Join-Path $root 'android'
if (-not (Test-Path $androidDir)) {
  Write-Error "Folder android/ belum ada. Jalankan dulu: npx cap add android"
  exit 1
}

# 3) Bangun web + sinkronkan ke proyek Android
Write-Host "`n[1/2] Build web & sync ke Android..." -ForegroundColor Cyan
Push-Location $root
npm run build
npx cap sync android
Pop-Location

# 4) Gradle assembleDebug
Write-Host "`n[2/2] Gradle: assembleDebug..." -ForegroundColor Cyan
Push-Location $androidDir
if (Test-Path '.\gradlew.bat') { .\gradlew.bat assembleDebug } else { .\gradlew assembleDebug }
Pop-Location

$apk = Join-Path $androidDir 'app\build\outputs\apk\debug\app-debug.apk'
if (Test-Path $apk) {
  $tujuan = Join-Path $root 'NUBSEN-debug.apk'
  Copy-Item $apk $tujuan -Force
  Write-Host "`nAPK siap: $tujuan" -ForegroundColor Green
  Write-Host 'Kirim berkas ini ke HP Android lalu install (izinkan sumber tidak dikenal).' -ForegroundColor Cyan
} else {
  Write-Error 'APK tidak ditemukan - periksa pesan error Gradle di atas.'
}
