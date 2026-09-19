# Unggah NUBSEN-debug.apk ke GitHub Release v1.0.0 (ganti aset lama).
# Pakai: powershell -ExecutionPolicy Bypass -File scripts\unggah-rilis.ps1
$ErrorAction = 'Stop'
$in = "protocol=https`nhost=github.com`n"
$cred = $in | git credential fill
$token = ($cred | Select-String '^password=').Line -replace '^password=', ''
$auth = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("uta-003:$token"))

$rel = Invoke-RestMethod -Headers @{ Authorization = $auth } 'https://api.github.com/repos/uta-003/nubsen/releases/tags/v1.0.0'
$as = @($rel.assets | Where-Object { $_.name -eq 'NUBSEN-debug.apk' })
if ($as.Count -gt 0) {
  Invoke-RestMethod -Method Delete -Headers @{ Authorization = $auth } $as[0].url | Out-Null
  Write-Host "aset lama dihapus ($($as[0].size) byte)"
}
$apk = [IO.File]::ReadAllBytes((Join-Path $PSScriptRoot '..\NUBSEN-debug.apk'))
$url = ($rel.upload_url -replace '\{.*\}', '') + '?name=NUBSEN-debug.apk'
$up = Invoke-RestMethod -Method Post -Headers @{ Authorization = $auth; 'Content-Type' = 'application/vnd.android.package-archive' } -Uri $url -Body $apk
Write-Host "terunggah: $($up.state) | $($up.size) byte"
