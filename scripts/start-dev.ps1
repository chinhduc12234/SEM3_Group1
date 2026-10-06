param([switch]$StageOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
& (Join-Path $PSScriptRoot 'init-dev.ps1')
# Docker BuildKit cannot read some OneDrive reparse-point files. Materialize
# a build context with normal bytes in TEMP; source and database volumes stay intact.
$contextRoot = Join-Path ([IO.Path]::GetTempPath()) 'sem3-group1-docker'
[IO.Directory]::CreateDirectory($contextRoot) | Out-Null
$files = @('.env', '.dockerignore', 'compose.yaml')
foreach ($folder in @('backend', 'frontend', 'infra')) {
    $folderRoot = Join-Path $projectRoot $folder
    Get-ChildItem -LiteralPath $folderRoot -Recurse -File | Where-Object {
        $_.FullName -notmatch '[\\/](node_modules|bin|obj|dist)[\\/]'
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
    Write-Host 'Open http://localhost:8080. Admin credentials are in the project .env file.'
} finally { Pop-Location }
