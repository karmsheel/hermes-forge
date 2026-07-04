$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
$standaloneDir = Join-Path $root "dist\desktop\win-unpacked\resources\standalone"
$electronExe = Join-Path $root "dist\desktop\win-unpacked\Hermes Forge.exe"
$prismaCli = Join-Path $standaloneDir "node_modules\prisma\build\index.js"
$schemaPath = Join-Path $standaloneDir "prisma\schema.prisma"
$userData = Join-Path $env:TEMP "hermes-forge-prisma-test"

if (Test-Path $userData) { Remove-Item -Recurse -Force $userData }
New-Item -ItemType Directory -Force -Path $userData | Out-Null

$env:DATABASE_URL = "file:$userData\forge.db"
$env:ELECTRON_RUN_AS_NODE = "1"

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $electronExe
$psi.Arguments = "`"$prismaCli`" migrate deploy --schema `"$schemaPath`""
$psi.WorkingDirectory = $standaloneDir
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.Environment["DATABASE_URL"] = $env:DATABASE_URL
$psi.Environment["ELECTRON_RUN_AS_NODE"] = "1"

$proc = [System.Diagnostics.Process]::Start($psi)
$proc.WaitForExit()
$stdout = $proc.StandardOutput.ReadToEnd()
$stderr = $proc.StandardError.ReadToEnd()

Write-Host "Exit code: $($proc.ExitCode)"
if ($stdout) { Write-Host "STDOUT:`n$stdout" }
if ($stderr) { Write-Host "STDERR:`n$stderr" }