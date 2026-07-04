$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
$standaloneDir = Join-Path $root ".next\standalone"
$prismaCli = Join-Path $standaloneDir "node_modules\prisma\build\index.js"
$schemaPath = Join-Path $standaloneDir "prisma\schema.prisma"
$userData = Join-Path $env:TEMP "hermes-forge-standalone-prisma-test"

if (Test-Path $userData) { Remove-Item -Recurse -Force $userData }
New-Item -ItemType Directory -Force -Path $userData | Out-Null

$env:DATABASE_URL = "file:$userData\forge.db"
Set-Location $standaloneDir
node $prismaCli migrate deploy --schema $schemaPath 2>&1
Write-Host "Exit code: $LASTEXITCODE"