# Membangun APK debug NUBSEN tanpa perlu membuka Android Studio.
# Pakai:  npm run android:apk
# Hasil:  NUBSEN-debug.apk di folder root proyek.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

# 1) JDK: Gradle 8.2.1 (Capacitor 6) butuh JDK 17.
#    Prioritas: jdk-17 di %LOCALAPPDATA%\NubsenTools -> jdk-17 yang dipasang resmi
#    (Microsoft/Adoptium/Corretto) -> JAVA_HOME yang sudah diset ->
#    JBR bawaan Android Studio (JDK 21/25, sering tidak cocok dengan Gradle 8.2).
$kandidat = @()
$kandidat += Get-ChildItem "$env:LOCALAPPDATA\NubsenTools" -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like 'jdk-17*' } | Select-Object -ExpandProperty FullName
foreach ($dir in @('C:\Program Files\Microsoft', 'C:\Program Files\Eclipse Adoptium', 'C:\Program Files\Java', 'C:\Program Files\Amazon Corretto')) {
  $kandidat += Get-ChildItem $dir -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like '*jdk-17*' -or $_.Name -like '*jdk17*' } | Select-Object -ExpandProperty FullName
}
$jdk17 = $kandidat | Where-Object { Test-Path (Join-Path $_ 'bin\java.exe') } | Select-Object -First 1
if ($jdk17) {
  $env:JAVA_HOME = $jdk17
} elseif ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME 'bin\java.exe'))) {
  # pakai yang sudah ada
} elseif (Test-Path 'C:\Program Files\Android\Android Studio\jbr') {
  $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
} else {
  Write-Warning 'JDK 17 tidak ditemukan. Lihat DEPLOY.md §6 untuk cara memasangnya.'
}
if ($env:JAVA_HOME) { $env:PATH = (Join-Path $env:JAVA_HOME 'bin') + ';' + $env:PATH }
Write-Host "JAVA_HOME = $env:JAVA_HOME"
# `java -version` menulis ke stderr; dengan ErrorActionPreference=Stop itu dianggap
# error yang menghentikan skrip, jadi bagian ini dijalankan dalam mode Continue.
$eapLama = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$versiJava = (& (Join-Path $env:JAVA_HOME 'bin\java.exe') -version 2>&1 | Select-Object -First 1)
$ErrorActionPreference = $eapLama
Write-Host "Versi Java: $versiJava"

# 2) Android SDK (local.properties juga menyimpan sdk.dir; ini hanya cadangan).
if (-not $env:ANDROID_HOME) {
  foreach ($sdk in @((Join-Path $env:LOCALAPPDATA 'Android\Sdk'), 'C:\Android\Sdk', 'C:\Android', (Join-Path $env:USERPROFILE 'AppData\Local\Android\Sdk'))) {
    if (Test-Path $sdk) { $env:ANDROID_HOME = $sdk; break }
  }
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
