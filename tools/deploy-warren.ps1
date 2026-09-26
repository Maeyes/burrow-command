# Build Burrow Command for GitHub Pages and push it to github.com/Maeyes/burrow-command (branch main).
# Usage (from the repo root):  powershell -File tools/deploy-warren.ps1
# The published repo holds only the built game (dist-warren), never the Bunny World sources.
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

$env:WARREN_BASE = '/burrow-command/'
npx vite build --config vite.warren.config.ts
Remove-Item Env:WARREN_BASE

$deploy = '.deploy-warren'
if (-not (Test-Path "$deploy\.git")) {
  New-Item -ItemType Directory -Force $deploy | Out-Null
  git -C $deploy init -q -b main
  git -C $deploy remote add origin https://github.com/Maeyes/burrow-command.git
  git -C $deploy pull -q origin main
}
Get-ChildItem $deploy -Force | Where-Object Name -ne '.git' | Remove-Item -Recurse -Force
Copy-Item dist-warren\* $deploy -Recurse -Force
Copy-Item dist-warren\.nojekyll $deploy -Force
git -C $deploy add -A
git -C $deploy commit -qm "Update Burrow Command build $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
git -C $deploy push -q origin main
Write-Host 'Pushed. GitHub Pages updates in about a minute: https://maeyes.github.io/burrow-command/'

# Restore the root-path build used by the local preview / quick tunnel.
npx vite build --config vite.warren.config.ts
