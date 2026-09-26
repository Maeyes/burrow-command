# Build Burrow Command for GitHub Pages and push it to github.com/Maeyes/burrow-command (branch main).
# Usage (from the repo root, in an interactive terminal so git can ask for GitHub credentials):
#   powershell -ExecutionPolicy Bypass -File tools/deploy-warren.ps1
# The published repo holds only the built game (dist-warren), never the Bunny World sources.
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
function Run($what) { if ($LASTEXITCODE -ne 0) { throw "deploy-warren: $what failed (exit $LASTEXITCODE)" } }

$env:WARREN_BASE = '/burrow-command/'
npx vite build --config vite.warren.config.ts; Run 'build'
Remove-Item Env:WARREN_BASE

$deploy = '.deploy-warren'
if (-not (Test-Path "$deploy\.git")) {
  New-Item -ItemType Directory -Force $deploy | Out-Null
  git -C $deploy init -q -b main; Run 'git init'
  git -C $deploy remote add origin https://github.com/Maeyes/burrow-command.git; Run 'git remote'
  git -C $deploy pull -q origin main; Run 'git pull'
}
# commits in the deploy repo need an identity even on machines without a global git config
if (-not (git -C $deploy config user.email)) { git -C $deploy config user.name thosa; git -C $deploy config user.email thosapornme@gmail.com }
Get-ChildItem $deploy -Force | Where-Object Name -ne '.git' | Remove-Item -Recurse -Force
Copy-Item dist-warren\* $deploy -Recurse -Force
Copy-Item dist-warren\.nojekyll $deploy -Force
git -C $deploy add -A; Run 'git add'
git -C $deploy diff --cached --quiet
if ($LASTEXITCODE -eq 0) { Write-Host 'Nothing changed since the last deploy.' }
else {
  git -C $deploy commit -qm "Update Burrow Command build $(Get-Date -Format 'yyyy-MM-dd HH:mm')"; Run 'git commit'
  git -C $deploy push -q origin main; Run 'git push'
  Write-Host 'Pushed. GitHub Pages updates in about a minute: https://maeyes.github.io/burrow-command/'
}

# Restore the root-path build used by the local preview / quick tunnel.
npx vite build --config vite.warren.config.ts; Run 'rebuild'
