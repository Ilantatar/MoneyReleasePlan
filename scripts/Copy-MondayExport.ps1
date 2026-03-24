# Copy your latest Monday Excel download into data/board-export.xlsx, then run npm run generate:xlsx
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Copy-MondayExport.ps1 -Source "C:\Users\you\Downloads\eToro_Plus_Money_123.xlsx"

param(
  [string] $Source = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$dataDir = Join-Path $root "data"
$dest = Join-Path $dataDir "board-export.xlsx"

if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir | Out-Null }

if (-not $Source) {
  $latest = Get-ChildItem -Path (Join-Path $env:USERPROFILE "Downloads") -Filter "eToro_Plus_Money*.xlsx" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if (-not $latest) {
    Write-Host "No eToro_Plus_Money*.xlsx in Downloads. Pass -Source path to your export."
    exit 1
  }
  $Source = $latest.FullName
}

Copy-Item -LiteralPath $Source -Destination $dest -Force
Write-Host "Copied to $dest"
Set-Location $root
npm run generate:xlsx
Write-Host "Done. Commit data/board-export.xlsx and index.html if you want GitHub Pages updated."
