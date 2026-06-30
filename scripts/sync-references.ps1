<#
.SYNOPSIS
    Syncs all agent reference files from main into the current directory.

.DESCRIPTION
    Useful when starting work in a new Git worktree.
    It reads the list from docs/references/INDEX.md (or falls back to all .md files).

.EXAMPLE
    .\scripts\sync-references.ps1
#>

$ErrorActionPreference = "Stop"

$repoRoot = git rev-parse --show-toplevel
$refsDir = Join-Path $repoRoot "docs/references"

Write-Host "Syncing agent reference files from main branch..." -ForegroundColor Cyan

# Get list of reference files (prefer INDEX.md, otherwise all .md files)
$indexPath = Join-Path $refsDir "INDEX.md"
$files = @()

if (Test-Path $indexPath) {
    # Very simple extraction: look for lines containing .md in the table
    $content = git show main:docs/references/INDEX.md
    $files = $content | Select-String -Pattern '\| `([A-Za-z0-9_.-]+\.md)`' | ForEach-Object {
        $_.Matches.Groups[1].Value
    }
}

if ($files.Count -eq 0) {
    # Fallback: all markdown files in the references dir on main
    $lsOutput = git ls-tree -r --name-only main docs/references/ | Where-Object { $_ -match '\.md$' }
    $files = $lsOutput | ForEach-Object { Split-Path $_ -Leaf }
}

if ($files.Count -eq 0) {
    Write-Warning "No reference files found."
    exit 0
}

$synced = 0
foreach ($file in $files) {
    $gitPath = "main:docs/references/$file"
    try {
        $content = git show $gitPath 2>$null
        if ($content) {
            $content | Out-File -FilePath $file -Encoding utf8 -NoNewline
            Write-Host "  ✓ $file" -ForegroundColor Green
            $synced++
        }
    } catch {
        Write-Warning "  Could not sync $file"
    }
}

Write-Host "`nSynced $synced reference file(s) from main." -ForegroundColor Cyan
Write-Host "You can now reference them directly in this worktree." -ForegroundColor DarkGray