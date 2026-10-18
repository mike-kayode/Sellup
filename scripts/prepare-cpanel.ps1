$ErrorActionPreference = "Stop"

npm run build

$deploymentRoot = Join-Path $PSScriptRoot "..\cpanel-deploy"
if (Test-Path $deploymentRoot) {
  Remove-Item $deploymentRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $deploymentRoot | Out-Null
Copy-Item (Join-Path $PSScriptRoot "..\.next\standalone\*") $deploymentRoot -Recurse -Force
Get-ChildItem $deploymentRoot -Recurse -Force -Filter ".env*" | Remove-Item -Force -ErrorAction SilentlyContinue
 $publicRoot = Join-Path $PSScriptRoot "..\public"
if (Test-Path $publicRoot) {
  Copy-Item $publicRoot (Join-Path $deploymentRoot "public") -Recurse -Force
}
New-Item -ItemType Directory -Path (Join-Path $deploymentRoot ".next\static") -Force | Out-Null
Copy-Item (Join-Path $PSScriptRoot "..\.next\static\*") (Join-Path $deploymentRoot ".next\static") -Recurse -Force

Write-Host "cPanel deployment bundle created at $deploymentRoot"
Write-Host "Upload the contents of this folder as the Node.js application root."
