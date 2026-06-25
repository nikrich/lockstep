# Packages the Lockstep Unreal plugin as a SOURCE-only, any-platform zip.
# No Unreal Engine required — the editor compiles it on first open. This is the
# macOS/Linux distribution (and a Windows build-it-yourself option).
#
# Usage:  ./plugin/packaging/package-source.ps1 -OutDir .\dist
# Produces: <OutDir>\LockstepSourceControl-Source-UE5.zip
#           (archive root is a single "LockstepSourceControl/" folder)

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$OutDir,
    [string]$ZipName = "LockstepSourceControl-Source-UE5.zip"
)

$ErrorActionPreference = "Stop"

$repoRoot  = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$pluginSrc = Join-Path $repoRoot "plugin\LockstepSourceControl"
if (-not (Test-Path (Join-Path $pluginSrc "LockstepSourceControl.uplugin"))) {
    throw "Plugin source not found at '$pluginSrc'."
}

$OutDir = (New-Item -ItemType Directory -Force -Path $OutDir).FullName
$stageRoot = Join-Path $OutDir "src-stage"
$stage = Join-Path $stageRoot "LockstepSourceControl"
$zipPath = Join-Path $OutDir $ZipName
foreach ($p in @($stageRoot, $zipPath)) { if (Test-Path $p) { Remove-Item -Recurse -Force $p } }
New-Item -ItemType Directory -Force -Path $stage | Out-Null

# Copy only source-distribution content (never binaries/intermediates).
foreach ($item in @("Source", "Config", "Resources", "LockstepSourceControl.uplugin", "README.md")) {
    $p = Join-Path $pluginSrc $item
    if (Test-Path $p) { Copy-Item -Recurse -Force $p $stage }
}
Remove-Item -Recurse -Force (Join-Path $stage "Binaries") -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force (Join-Path $stage "Intermediate") -ErrorAction SilentlyContinue
Copy-Item (Join-Path $PSScriptRoot "INSTALL-source.txt") (Join-Path $stage "INSTALL.txt") -Force

Compress-Archive -Path $stage -DestinationPath $zipPath -CompressionLevel Optimal
$size = "{0:N0}" -f (Get-Item $zipPath).Length
Write-Host "==> Source package: $zipPath ($size bytes)"
