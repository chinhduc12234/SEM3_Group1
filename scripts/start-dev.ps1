param([switch]$StageOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
& (Join-Path $PSScriptRoot 'init-dev.ps1')
# Docker BuildKit cannot read some OneDrive reparse-point files. Materialize
# a build context with normal bytes in TEMP; source and database volumes stay intact.
$env:CAMPAIGN_UPLOAD_DIR = Join-Path $projectRoot 'uploads/campaigns'
[IO.Directory]::CreateDirectory($env:CAMPAIGN_UPLOAD_DIR) | Out-Null
$contextRoot = Join-Path ([IO.Path]::GetTempPath()) 'sem3-group1-docker'
[IO.Directory]::CreateDirectory($contextRoot) | Out-Null
$resolvedContext = (Resolve-Path -LiteralPath $contextRoot).Path
$contextPrefix = $resolvedContext + [IO.Path]::DirectorySeparatorChar
foreach ($folder in @('backend', 'frontend')) {
    $stagedFolder = Join-Path $resolvedContext $folder
    if (Test-Path -LiteralPath $stagedFolder) {
        $resolvedFolder = (Resolve-Path -LiteralPath $stagedFolder).Path
        if (-not $resolvedFolder.StartsWith($contextPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Staging folder escaped the build context.' }
        [IO.Directory]::Delete($resolvedFolder, $true)
    }
}
$infraFolder = Join-Path $resolvedContext 'infra'
$gatewayPath = Join-Path $infraFolder 'gateway.conf'
if (Test-Path -LiteralPath $gatewayPath -PathType Container) {
    $resolvedGateway = (Resolve-Path -LiteralPath $gatewayPath).Path
    if (-not $resolvedGateway.StartsWith($contextPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Gateway staging path escaped the build context.' }
    [IO.Directory]::Delete($resolvedGateway, $true)
}
$files = @('.env', '.dockerignore', 'Give-AID.slnx', 'compose.yaml', '.secrets/jwt_public.pem', '.secrets/jwt_private.pem')
foreach ($folder in @('backend', 'frontend', 'infra')) {
    $folderRoot = Join-Path $projectRoot $folder
    Get-ChildItem -LiteralPath $folderRoot -Recurse -File | Where-Object {
        $_.FullName -notmatch '[\\/](node_modules|bin|obj|dist|\.next)[\\/]'
    } | ForEach-Object { $files += $_.FullName.Substring($projectRoot.Length + 1) }
}
foreach ($relative in $files) {
    $source = Join-Path $projectRoot $relative
    $destination = Join-Path $contextRoot $relative
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination)) | Out-Null
    [IO.File]::WriteAllBytes($destination, [IO.File]::ReadAllBytes($source))
}
Write-Host "Docker build context: $contextRoot"
if ($StageOnly) { exit 0 }
Push-Location $contextRoot
try {
    docker compose build
    if ($LASTEXITCODE -ne 0) { throw 'Docker build failed.' }
    docker compose up -d --no-build
    if ($LASTEXITCODE -ne 0) { throw 'Docker startup failed.' }
    docker compose exec -T gateway nginx -s reload
    if ($LASTEXITCODE -ne 0) { throw 'Gateway reload failed.' }
    Write-Host 'Open http://localhost:8080.'
} finally { Pop-Location }
