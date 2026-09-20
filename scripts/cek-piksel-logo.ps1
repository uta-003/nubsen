Add-Type -AssemblyName System.Drawing
$dir = "C:\Users\Afriani\.cline\data\workspaces\chat\nubsen"
$files = @()
$icons = Join-Path $dir 'public\icons'
if (Test-Path $icons) { $files += Get-ChildItem $icons -Filter *.png }
$mm = Join-Path $dir 'android\app\src\main\res'
$files += Get-ChildItem $mm -Recurse -Include *.png -ErrorAction SilentlyContinue | Select-Object -First 24
foreach ($file in $files) {
  $bmp = [System.Drawing.Bitmap]::FromFile($file.FullName)
  $w = $bmp.Width; $h = $bmp.Height
  $pts = @(
    @(1,1), @(($w-2),1), @(1,($h-2)), @(($w-2),($h-2)),
    @(10,10), @([int]($w/2),1), @(1,[int]($h/2)), @([int]($w/2),[int]($h/2))
  )
  $desc = foreach ($pt in $pts) {
    $c = $bmp.GetPixel($pt[0],$pt[1])
    "({0},{1})=A{2}R{3}G{4}B{5}" -f $pt[0],$pt[1],$c.A,$c.R,$c.G,$c.B
  }
  Write-Output ("== {0} {1}x{2} ==" -f ($file.FullName.Substring($dir.Length+1)), $w, $h)
  Write-Output ("   " + ($desc -join ' '))
  $bmp.Dispose()
}