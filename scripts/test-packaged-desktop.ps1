$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root "dist\desktop\win-unpacked\Hermes Forge.exe"

if (-not (Test-Path $exe)) {
  Write-Error "Missing packaged app. Run npm run desktop:build first."
}

$userData = Join-Path $env:TEMP "hermes-forge-desktop-test"
if (Test-Path $userData) {
  Remove-Item -Recurse -Force $userData
}

$port = "3857"
$extraArgs = @("--user-data-dir=$userData")
if (Select-String -Path (Join-Path $root "electron\main.mjs") -Pattern "--forge-port=" -Quiet) {
  $extraArgs += "--forge-port=$port"
} else {
  $port = "3847"
  $env:FORGE_PORT = $port
}

Write-Host "Launching packaged app with isolated user data: $userData"
Write-Host "Expecting server on port: $port"

$proc = Start-Process -FilePath $exe -PassThru -ArgumentList $extraArgs

$deadline = (Get-Date).AddSeconds(120)
$ready = $false
while ((Get-Date) -lt $deadline) {
  if ($proc.HasExited) {
    Write-Host "App exited early with code $($proc.ExitCode)"
    break
  }
  try {
    $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$port/login" -UseBasicParsing -TimeoutSec 3
    if ($resp.StatusCode -eq 200) {
      $ready = $true
      break
    }
  } catch {
    Start-Sleep -Seconds 2
  }
}

Get-Process -Id $proc.Id -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }

# Also stop child processes Electron may have spawned.
Get-CimInstance Win32_Process |
  Where-Object { $_.Name -eq "Hermes Forge.exe" -and $_.ExecutablePath -like "$root\dist\desktop\win-unpacked*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

if ($ready) {
  Write-Host "PASS: Desktop server responded on http://127.0.0.1:$port/login"
  exit 0
}

Write-Host "FAIL: Timed out waiting for desktop server on port $port"
exit 1