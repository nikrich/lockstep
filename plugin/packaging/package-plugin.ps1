# Packages the Lockstep Unreal plugin into a clean, droppable, binary distributable.
# Single source of truth for both local packaging and CI (.github/workflows/ue-plugin-release.yml).
#
# Runs RunUAT BuildPlugin (needs Unreal Engine installed), strips build cruft and
# debug symbols, adds INSTALL.txt, and zips it so the archive root is a single
# "LockstepSourceControl/" folder (unzip straight into a project's Plugins/).
#
# Usage (local):
#   ./plugin/packaging/package-plugin.ps1 -OutDir .\dist
#   ./plugin/packaging/package-plugin.ps1 -EngineRoot "D:\UE_5.7" -OutDir .\dist
#
# Produces: <OutDir>\LockstepSourceControl-UE5.7-Win64.zip

[CmdletBinding()]
param(
    [string]$EngineRoot = $(if ($env:UE_5_7_ROOT) { $env:UE_5_7_ROOT } else { "C:\Program Files\Epic Games\UE_5.7" }),
    [Parameter(Mandatory = $true)][string]$OutDir,
    [string]$ZipName = "LockstepSourceControl-UE5.7-Win64.zip"
)

$ErrorActionPreference = "Stop"

$uat = Join-Path $EngineRoot "Engine\Build\BatchFiles\RunUAT.bat"
if (-not (Test-Path $uat)) {
    throw "RunUAT not found at '$uat'. Set -EngineRoot or the UE_5_7_ROOT env var to your UE 5.7 install."
}

# Repo paths (this script lives in <repo>/plugin/packaging/).
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$uplugin  = Join-Path $repoRoot "plugin\LockstepSourceControl\LockstepSourceControl.uplugin"
if (-not (Test-Path $uplugin)) { throw "Plugin descriptor not found at '$uplugin'." }

$OutDir = (New-Item -ItemType Directory -Force -Path $OutDir).FullName
$buildDir = Join-Path $OutDir "build"
$stageRoot = Join-Path $OutDir "stage"
$stage = Join-Path $stageRoot "LockstepSourceControl"
$zipPath = Join-Path $OutDir $ZipName

# Clean prior output.
foreach ($p in @($buildDir, $stageRoot, $zipPath)) {
    if (Test-Path $p) { Remove-Item -Recurse -Force $p }
}

Write-Host "==> BuildPlugin (UE 5.7, Win64) ..."
& $uat BuildPlugin -Plugin="$uplugin" -Package="$buildDir" -TargetPlatforms=Win64 -Rocket
if ($LASTEXITCODE -ne 0) { throw "BuildPlugin failed with exit code $LASTEXITCODE." }

Write-Host "==> Staging clean distributable ..."
New-Item -ItemType Directory -Force -Path $stage | Out-Null
Copy-Item -Recurse -Force (Join-Path $buildDir "*") $stage
# Strip build intermediates and debug symbols from the shipped zip.
Remove-Item -Recurse -Force (Join-Path $stage "Intermediate") -ErrorAction SilentlyContinue
Get-ChildItem -Recurse -Path $stage -Filter *.pdb | Remove-Item -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $PSScriptRoot "INSTALL.txt") (Join-Path $stage "INSTALL.txt") -Force

$dll = Join-Path $stage "Binaries\Win64\UnrealEditor-LockstepSourceControl.dll"
if (-not (Test-Path $dll)) { throw "Expected binary missing after packaging: $dll" }

Write-Host "==> Zipping ..."
Compress-Archive -Path $stage -DestinationPath $zipPath -CompressionLevel Optimal

$size = "{0:N0}" -f (Get-Item $zipPath).Length
Write-Host "==> Done: $zipPath ($size bytes)"

# Surface the artifact path to GitHub Actions if running there. Use a BOM-free
# append (Windows PowerShell's Out-File -utf8 writes a BOM that corrupts the
# first GITHUB_OUTPUT line).
if ($env:GITHUB_OUTPUT) {
    [System.IO.File]::AppendAllText($env:GITHUB_OUTPUT, "zip=$zipPath`n")
}
