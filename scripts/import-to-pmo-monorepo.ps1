<#
.SYNOPSIS
  Merge this repo (MoneyReleasePlan) into eToro/platform-solutions-pmo-write as a subdirectory.

.PREREQUISITES
  - Git with subtree support (standard in Git for Windows).
  - Push access to the parent monorepo (org SSO if required).
  - Clone/push access to https://github.com/eToro/platform-solutions-pmo-write (or SSH URL).

.PARAMETER ParentRepoUrl
  Clone URL for the monorepo, e.g. https://github.com/eToro/platform-solutions-pmo-write.git

.PARAMETER Subdir
  Folder name under the monorepo root (default: MoneyReleasePlan).

.PARAMETER SourceBranch
  Branch on MoneyReleasePlan to import (default: main).

.PARAMETER SourceRepoPath
  Path to this MoneyReleasePlan clone (default: parent of scripts/).

.EXAMPLE
  .\scripts\import-to-pmo-monorepo.ps1 -ParentRepoUrl "https://github.com/eToro/platform-solutions-pmo-write.git"
#>
param(
    [Parameter(Mandatory = $true)]
    [string] $ParentRepoUrl,

    [string] $Subdir = "MoneyReleasePlan",

    [string] $SourceBranch = "main",

    [string] $SourceRepoPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"
$prev = Get-Location

if (-not (Test-Path (Join-Path $SourceRepoPath ".git"))) {
    Write-Error "Not a git repo: $SourceRepoPath"
}

$parentWork = Join-Path ([System.IO.Path]::GetTempPath()) ("pmo-import-" + [guid]::NewGuid().ToString("n"))
$parentDir = Join-Path $parentWork "parent"
New-Item -ItemType Directory -Path $parentWork -Force | Out-Null

try {
    git clone $ParentRepoUrl $parentDir
    if ($LASTEXITCODE -ne 0) { throw "Clone failed. Check URL, VPN, GitHub org access / SSO." }

    if (Test-Path (Join-Path $parentDir $Subdir)) {
        throw "Subdirectory '$Subdir' already exists in parent repo. Remove or use -Subdir another name."
    }

    Set-Location $parentDir

    git remote add mrp-source $SourceRepoPath
    if ($LASTEXITCODE -ne 0) { throw "git remote add mrp-source failed" }

    git fetch mrp-source $SourceBranch --no-tags
    if ($LASTEXITCODE -ne 0) {
        throw "git fetch mrp-source $SourceBranch failed. Set -SourceBranch to your default branch."
    }

    $srcRef = "mrp-source/$SourceBranch"
    Write-Host "Subtree add: --prefix=$Subdir $srcRef (one squashed commit)."
    git subtree add --prefix=$Subdir $srcRef --squash -m "Add $Subdir (MoneyReleasePlan)"
    if ($LASTEXITCODE -ne 0) { throw "git subtree add failed" }

    Write-Host ""
    Write-Host "Import succeeded. Parent clone is at:"
    Write-Host "  $parentDir"
    Write-Host "Next:"
    Write-Host "  cd `"$parentDir`""
    Write-Host "  git push origin HEAD"
    Write-Host ""
    Write-Host "Optional: archive https://github.com/Ilantatar/MoneyReleasePlan if this replaces it."
}
finally {
    Set-Location $prev
}
