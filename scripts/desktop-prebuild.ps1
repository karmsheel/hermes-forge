# Stop processes that commonly lock Prisma / Electron build outputs on Windows.
$ErrorActionPreference = "SilentlyContinue"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$distUnpacked = Join-Path $root "dist\desktop\win-unpacked"

Write-Host "Stopping Hermes Forge instances launched from $distUnpacked..."
Get-CimInstance Win32_Process |
  Where-Object { $_.Name -eq "Hermes Forge.exe" -and $_.ExecutablePath -like "$distUnpacked*" } |
  ForEach-Object {
    Write-Host "  Stopping PID $($_.ProcessId)"
    Stop-Process -Id $_.ProcessId -Force
  }

Write-Host "Stopping npm/next dev servers and standalone test servers in $root..."
Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -eq "node.exe" -and
    $_.CommandLine -and
    (
      (
        ($_.CommandLine -like "*$root*") -and
        ($_.CommandLine -match "next(\.cmd)?\s+dev" -or $_.CommandLine -match "npm.*run dev")
      ) -or
      ($_.CommandLine -like "*$root*" -and $_.CommandLine -match "server\.js")
    )
  } |
  ForEach-Object {
    Write-Host "  Stopping PID $($_.ProcessId)"
    Stop-Process -Id $_.ProcessId -Force
  }

$dist = Join-Path $root "dist\desktop"
if (Test-Path $dist) {
  Write-Host "Removing $dist..."
  Remove-Item -Recurse -Force $dist
}

Write-Host "Desktop prebuild cleanup complete."