# Profil radial logo-icon.png — deteksi cincin/stroke gelap dekat tepi disc.
Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile("C:\Users\Afriani\.cline\data\workspaces\chat\nubsen\public\logo-icon.png")
$cx = $bmp.Width / 2.0; $cy = $bmp.Height / 2.0
Write-Output "--- diagonal 45 derajat (dari 65% ke 102% radius) ---"
for ($pct = 0.65; $pct -le 1.03; $pct += 0.02) {
  $r = ($bmp.Width / 2.0) * $pct
  $x = [int][Math]::Round($cx + $r * 0.7071); $y = [int][Math]::Round($cy - $r * 0.7071)
  if ($x -ge 0 -and $x -lt $bmp.Width -and $y -ge 0 -and $y -lt $bmp.Height) {
    $c = $bmp.GetPixel($x, $y)
    Write-Output ("pct={0:P0} ({1},{2}) A{3} R{4} G{5} B{6}" -f $pct, $x, $y, $c.A, $c.R, $c.G, $c.B)
  }
}
Write-Output "--- sumbu X kanan (pusat -> tepi) ---"
for ($x = [int]$cx; $x -lt $bmp.Width; $x += 4) {
  $c = $bmp.GetPixel($x, [int]$cy)
  Write-Output ("x={0} A{1} R{2} G{3} B{4}" -f $x, $c.A, $c.R, $c.G, $c.B)
}
$bmp.Dispose()