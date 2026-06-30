<#
.SYNOPSIS
    Fetches the latest version of an agent reference file from the main branch.

.DESCRIPTION
    Designed for Git worktree workflows. Writes the canonical version of a file
    from docs/references/ on the 'main' branch into the current directory.

.PARAMETER Name
    The filename inside docs/references/ (e.g. PRODUCT_BACKLOG.md)

.EXAMPLE
    .\scripts\get-reference.ps1 PRODUCT_BACKLOG.md

.EXAMPLE
    .\scripts\get-reference.ps1 ARCHITECTURE.md
#>
param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$Name
)

$ErrorActionPreference = "Stop"

# Find the root of the git repo
try {
    $repoRoot = git rev-parse --show-toplevel
} catch {
    Write-Error "Not inside a git repository."
    exit 1
}

$relativePath = "docs/references/$Name"
$fullGitPath = "main:$relativePath"

Write-Host "Fetching canonical version of $Name from main branch..." -ForegroundColor Cyan

try {
    $content = git show $fullGitPath 2>$null

    if (-not $content) {
        Write-Error "Could not find '$relativePath' on branch 'main'."
        exit 1
    }

    $content | Out-File -FilePath $Name -Encoding utf8 -NoNewline
    Write-Host "✓ Wrote $Name (from main:$relativePath)" -ForegroundColor Green

    # Optional: show a short preview
    Write-Host "`nFirst 5 lines:" -ForegroundColor DarkGray
    $content | Select-Object -First 5 | ForEach-Object { "  $_" }

} catch {
    Write-Error "Failed to retrieve reference file: $_"
    exit 1
}