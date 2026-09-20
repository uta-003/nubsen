# Membangun ulang IKON LAUNCHER + SPLASH aplikasi Android NUBSEN dari logo yang
# sudah ada (public/logo-icon.png) — supaya tampilan aplikasi memakai logo NUBSEN,
# bukan ikon bawaan Capacitor.
#
# Tanpa dependensi tambahan: cukup System.Drawing (bawaan Windows) — sama seperti
# alasan scripts/generate-icons.mjs dibuat murni tanpa pustaka gambar.
#
# Pakai:  powershell -ExecutionPolicy Bypass -File scripts\buat-ikon-android.ps1
# Hasil:  android/app/src/main/res/{mipmap-*,drawable*,mipmap-anydpi-v26 tetap}

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$res = Join-Path $root 'android\app\src\main\res'
$logoPath = Join-Path $root 'public\logo-icon.png'

if (-not (Test-Path $res)) { throw "Folder res Android tidak ada: $res" }
if (-not (Test-Path $logoPath)) { throw "Logo tidak ada: $logoPath" }

# Warna brand: navy #0A1D57 (sama dengan splash Capacitor) & putih (latar ikon adaptive).
$NAVY = [System.Drawing.Color]::FromArgb(255, 10, 29, 87)
$PUTIH = [System.Drawing.Color]::White

# Ambang "kabut" latar logo: gradasi halus pada latar ikon sumber ikut terbaca
# sebagai mark (alpha 1-8 / ~3% opacity) sehingga tampak sebagai bintik saat mark
# ditempel di latar transparan. Piksel dengan alpha di bawah ambang ini dibuang.
$AMBANG_ALPHA = 10

$logo = [System.Drawing.Image]::FromFile($logoPath)

# Font wordmark "NUBSEN" pada splash (Segoe UI bila ada, kalau tidak Arial).
$fontNama = 'Arial'
try {
  $ada = (New-Object System.Drawing.Text.InstalledFontCollection).Families | Where-Object { $_.Name -eq 'Segoe UI' }
  if ($ada) { $fontNama = 'Segoe UI' }
} catch { /* pakai Arial */ }

function New-Kanvas([int]$w, [int]$h) {
  $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  @($bmp, $g)
}

# Gambar logo dengan tinggi sesuai $ukuran (sisi terpanjang), dipusatkan di titik tertentu.
function Add-Logo($g, [double]$ukuran, [double]$pusatX, [double]$pusatY) {
  $s = $ukuran / [Math]::Max($logo.Width, $logo.Height)
  $w = $logo.Width * $s
  $h = $logo.Height * $s
  $g.DrawImage($logo, [single]($pusatX - $w / 2), [single]($pusatY - $h / 2), [single]$w, [single]$h)
}

function Add-Bundar([double]$x, [double]$y, [double]$w, [double]$h, [double]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = [single]($r * 2)
  $p.AddArc([single]$x, [single]$y, $d, $d, 180, 90)
  $p.AddArc([single]($x + $w - $r * 2), [single]$y, $d, $d, 270, 90)
  $p.AddArc([single]($x + $w - $r * 2), [single]($y + $h - $r * 2), $d, $d, 0, 90)
  $p.AddArc([single]$x, [single]($y + $h - $r * 2), $d, $d, 90, 90)
  $p.CloseFigure()
  $p
}

function Simpan($bmp, [string]$path) {
  $dir = Split-Path -Parent $path
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

# Wordmark dengan jarak antar-huruf (tracking) supaya terlihat seperti logo aplikasi.
function Add-Teks($g, [string]$teks, [single]$ukuran, [double]$pusatX, [double]$atasY, $warna) {
  $font = New-Object System.Drawing.Font($fontNama, $ukuran, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $brush = New-Object System.Drawing.SolidBrush($warna)
  $renggang = $ukuran * 0.24
  $lebar = 0.0
  foreach ($ch in $teks.ToCharArray()) { $lebar += $g.MeasureString($ch, $font).Width + $renggang }
  $lebar -= $renggang
  $x = $pusatX - $lebar / 2
  foreach ($ch in $teks.ToCharArray()) {
    $g.DrawString($ch, $font, $brush, [single]$x, [single]$atasY)
    $x += $g.MeasureString($ch, $font).Width + $renggang
  }
  $font.Dispose()
  $brush.Dispose()
}

# Mark PUTIH dari logo brand (lihat Buat-LogoPutih) supaya mark
# tetap terbaca di atas latar navy — dipakai untuk ikon adaptive, launcher, & splash.
function Buat-LogoPutih($src) {
  # Salin ke bitmap ARGB terpisah supaya pikselnya bisa dikunci & diubah langsung.
  $bmp = New-Object System.Drawing.Bitmap($src.Width, $src.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($src, 0, 0, $src.Width, $src.Height)
  $g.Dispose()

  $w = $bmp.Width; $h = $bmp.Height
  $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $stride = $data.Stride
  $len = $stride * $h
  $buf = New-Object byte[] $len
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buf, 0, $len)

  # Logo sumber adalah IKON APLIKASI: latar navy penuh + mark terang, jadi mark tidak
  # bisa diambil dari kanal alpha (semua piksel opaque). Mark diambil lewat LUMINANS:
  #     alfa_mark = (L - L_latar) / (L_mark - L_latar)
  # L_latar = luminans yang paling sering muncul (mode histogram) -> warna latar ikon.
  # L_mark  = luminans persentil 99,9 % -> bagian mark yang paling terang.
  # (Bila suatu saat logonya berlatar terang, arah dihitung otomatis dibalik.)
  $hist = @{}
  $total = 0
  for ($i = 0; $i -lt $len; $i += 4) {
    if ($buf[$i + 3] -le 128) { continue }
    $k = [int][Math]::Round(0.299 * $buf[$i + 2] + 0.587 * $buf[$i + 1] + 0.114 * $buf[$i])
    if ($hist.ContainsKey($k)) { $hist[$k]++ } else { $hist[$k] = 1 }
    $total++
  }
  if ($total -eq 0) { $bmp.UnlockBits($data); return $bmp }

  $Lb = (($hist.GetEnumerator() | Sort-Object -Property Value -Descending | Select-Object -First 1).Key) / 255.0
  $markTerang = $Lb -lt 0.5
  $acuan = $Lb
  if ($markTerang) {
    $acc = 0
    foreach ($k in ($hist.Keys | Sort-Object)) {
      $acc += $hist[$k]
      if ($acc -ge [int]($total * 0.999)) { $acuan = [Math]::Max($k / 255.0, $Lb + 0.05); break }
    }
  } else {
    $acc = 0
    foreach ($k in ($hist.Keys | Sort-Object)) {
      $acc += $hist[$k]
      if ($acc -ge [int]($total * 0.001)) { $acuan = [Math]::Min($k / 255.0, $Lb - 0.05); break }
    }
  }
  $den = [Math]::Abs($acuan - $Lb)
  if ($den -le 0.05) { $den = 0.05 }

  for ($i = 0; $i -lt $len; $i += 4) {
    $a = $buf[$i + 3]
    if ($a -eq 0) { continue }
    $lum = (0.299 * $buf[$i + 2] + 0.587 * $buf[$i + 1] + 0.114 * $buf[$i]) / 255.0
    $t = if ($markTerang) { ($lum - $Lb) / $den } else { ($Lb - $lum) / $den }
    if ($t -lt 0) { $t = 0.0 } elseif ($t -gt 1) { $t = 1.0 }
    $buf[$i] = 255; $buf[$i + 1] = 255; $buf[$i + 2] = 255
    $alfa = [int][Math]::Round($a * $t)
    if ($alfa -lt $AMBANG_ALPHA) { $alfa = 0 }
    $buf[$i + 3] = [byte]$alfa
  }
  [System.Runtime.InteropServices.Marshal]::Copy($buf, 0, $data.Scan0, $len)
  $bmp.UnlockBits($data)

  # Pangkas bidang kosong (bbox) supaya ukuran mark pada ikon/splash konsisten:
  # tanpa ini mark tampak kecil karena logo sumber punya banyak ruang kosong.
  $minX = $w; $minY = $h; $maxX = -1; $maxY = -1
  for ($y = 0; $y -lt $h; $y++) {
    $baris = $y * $stride
    for ($x = 0; $x -lt $w; $x++) {
      if ($buf[$baris + $x * 4 + 3] -gt 8) {
        if ($x -lt $minX) { $minX = $x }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  Write-Host ("  mark putih: luminans latar={0:F2} acuan={1:F2} bbox=({2},{3})-({4},{5})" -f $Lb, $acuan, $minX, $minY, $maxX, $maxY)
  if ($maxX -lt 0) { return $bmp }

  $pad = [int][Math]::Round([Math]::Max($maxX - $minX, $maxY - $minY) * 0.03)
  $sx = [int][Math]::Max(0, $minX - $pad)
  $sy = [int][Math]::Max(0, $minY - $pad)
  $cw = [int][Math]::Min($w - $sx, ($maxX - $minX + 1) + 2 * $pad)
  $ch = [int][Math]::Min($h - $sy, ($maxY - $minY + 1) + 2 * $pad)
  $crop = New-Object System.Drawing.Bitmap($cw, $ch, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $gc = [System.Drawing.Graphics]::FromImage($crop)
  $gc.Clear([System.Drawing.Color]::Transparent)
  $gc.DrawImage($bmp, (New-Object System.Drawing.Rectangle(0, 0, $cw, $ch)), (New-Object System.Drawing.Rectangle($sx, $sy, $cw, $ch)), [System.Drawing.GraphicsUnit]::Pixel)
  $gc.Dispose()
  $bmp.Dispose()
  $crop
}

$logoPutih = Buat-LogoPutih $logo

# Gambar gambar apa pun (logo navy / logo putih) dengan sisi terpanjang $ukuran,
# dipusatkan pada titik ($pusatX, $pusatY).
function Add-Gambar($g, $img, [double]$ukuran, [double]$pusatX, [double]$pusatY) {
  $s = $ukuran / [Math]::Max($img.Width, $img.Height)
  $w = $img.Width * $s
  $h = $img.Height * $s
  $g.DrawImage($img, [single]($pusatX - $w / 2), [single]($pusatY - $h / 2), [single]$w, [single]$h)
}

$dibuat = New-Object System.Collections.Generic.List[string]

# ---------- 1) Ikon launcher klasik (Android < 8) + ikon bulat ----------
# Latar navy dengan mark putih: kontras tinggi di semua tema & cocok dengan splash.
$ukuranLauncher = [ordered]@{ 'mdpi' = 48; 'hdpi' = 72; 'xhdpi' = 96; 'xxhdpi' = 144; 'xxxhdpi' = 192 }
foreach ($d in $ukuranLauncher.Keys) {
  $s = [double]$ukuranLauncher[$d]

  # 1a. LINGKARAN penuh — bukan kotak membulat. Launcher yang menampilkan ikon
  #     legacy apa adanya (tanpa masking) tidak lagi menampakkan "kotak gelap";
  #     bentuk lingkaran juga selaras dengan logo web & ikon adaptif Android 8+.
  $l = New-Kanvas ([int]$s) ([int]$s)
  $bmp = $l[0]; $g = $l[1]
  $brush = New-Object System.Drawing.SolidBrush($NAVY)
  $g.FillEllipse($brush, 0, 0, [single]$s, [single]$s)
  $brush.Dispose()
  Add-Gambar $g $logoPutih ($s * 0.60) ($s / 2) ($s / 2)
  $g.Dispose()
  Simpan $bmp (Join-Path $res "mipmap-$d\ic_launcher.png")
  $dibuat.Add("mipmap-$d\ic_launcher.png")

  # 1b. Bulat penuh (launcher yang memakai ikon bulat)
  $l = New-Kanvas ([int]$s) ([int]$s)
  $bmp = $l[0]; $g = $l[1]
  $brush = New-Object System.Drawing.SolidBrush($NAVY)
  $g.FillEllipse($brush, 0, 0, [single]$s, [single]$s)
  $brush.Dispose()
  Add-Gambar $g $logoPutih ($s * 0.60) ($s / 2) ($s / 2)
  $g.Dispose()
  Simpan $bmp (Join-Path $res "mipmap-$d\ic_launcher_round.png")
  $dibuat.Add("mipmap-$d\ic_launcher_round.png")
}

# ---------- 2) Ikon adaptif Android 8+: lapisan depan = mark PUTIH ----------
# Kanvas 108dp (mdpi..xxxhdpi). Mark dibuat ~52% kanvas supaya seluruh mark tetap
# berada di dalam "safe zone" 72dp — mask bulat/squircle apa pun tidak memotongnya.
# Latar navy diisi dari values/ic_launcher_background.xml (diatur skrip ini juga).
$ukuranAdaptif = [ordered]@{ 'mdpi' = 108; 'hdpi' = 162; 'xhdpi' = 216; 'xxhdpi' = 324; 'xxxhdpi' = 432 }
foreach ($d in $ukuranAdaptif.Keys) {
  $s = [double]$ukuranAdaptif[$d]
  $a = New-Kanvas ([int]$s) ([int]$s)
  $bmp = $a[0]; $g = $a[1]
  Add-Gambar $g $logoPutih ($s * 0.52) ($s / 2) ($s / 2)
  $g.Dispose()
  Simpan $bmp (Join-Path $res "mipmap-$d\ic_launcher_foreground.png")
  $dibuat.Add("mipmap-$d\ic_launcher_foreground.png")
}

# ---------- 3) Splash / splash screen: latar navy + mark + wordmark NUBSEN ------
# Ukuran harus SAMA PERSIS dengan berkas bawaan Capacitor yang digantikan
# (lihat daftar di bawah) supaya tidak ada resource Android yang hilang.
$splash = [ordered]@{
  'drawable'               = @(480, 320)
  'drawable-land-mdpi'     = @(480, 320)
  'drawable-land-hdpi'     = @(800, 480)
  'drawable-land-xhdpi'    = @(1280, 720)
  'drawable-land-xxhdpi'   = @(1600, 960)
  'drawable-land-xxxhdpi'  = @(1920, 1280)
  'drawable-port-mdpi'     = @(320, 480)
  'drawable-port-hdpi'     = @(480, 800)
  'drawable-port-xhdpi'    = @(720, 1280)
  'drawable-port-xxhdpi'   = @(960, 1600)
  'drawable-port-xxxhdpi'  = @(1280, 1920)
}
foreach ($k in $splash.Keys) {
  $w = [double]$splash[$k][0]
  $h = [double]$splash[$k][1]
  $sisi = [Math]::Min($w, $h)
  $s = New-Kanvas ([int]$w) ([int]$h)
  $bmp = $s[0]; $g = $s[1]
  $brush = New-Object System.Drawing.SolidBrush($NAVY)
  $g.FillRectangle($brush, 0, 0, [single]$w, [single]$h)
  $brush.Dispose()
  # Mark sedikit di atas titik tengah agar wordmark di bawahnya terlihat seimbang
  # walau splash tertutup sebagian oleh bilah status / navigasi.
  Add-Gambar $g $logoPutih ($sisi * 0.30) ($w / 2) ($h / 2 - $sisi * 0.06)
  Add-Teks $g 'NUBSEN' ($sisi * 0.072) ($w / 2) ($h / 2 + $sisi * 0.13) $PUTIH
  $g.Dispose()
  Simpan $bmp (Join-Path $res "$k\splash.png")
  $dibuat.Add("$k\splash.png")
}

# ---------- 4) Warna latar ikon adaptif = navy brand ----------
# Nilai ini yang dipakai <background android:drawable="@color/ic_launcher_background"/>
# pada mipmap-anydpi-v26/ic_launcher(.round).xml.
$bgPath = Join-Path $res 'values\ic_launcher_background.xml'
$bgXml = @"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0A1D57</color>
</resources>
"@
[System.IO.File]::WriteAllText($bgPath, $bgXml, (New-Object System.Text.UTF8Encoding($false)))
$dibuat.Add('values\ic_launcher_background.xml (navy #0A1D57)')

$logo.Dispose()
$logoPutih.Dispose()

Write-Host ("Ikon & splash NUBSEN dibuat ulang ({0} berkas):" -f $dibuat.Count)
foreach ($n in $dibuat) { Write-Host ("  - " + $n) }
