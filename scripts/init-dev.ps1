$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$envPath = Join-Path $projectRoot '.env'
$secretDirectory = Join-Path $projectRoot '.secrets'
$publicKeyPath = Join-Path $secretDirectory 'jwt_public.pem'
$privateKeyPath = Join-Path $secretDirectory 'jwt_private.pem'

# Keep SQL and port settings stable on repeat runs, and create them only once.
if (-not (Test-Path -LiteralPath $envPath)) {
    $sqlBytes = New-Object byte[] 32
    $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $random.GetBytes($sqlBytes)
    $random.Dispose()
    $sqlSecret = 'Sql1!' + [Convert]::ToBase64String($sqlBytes)
    @"
SQL_SA_PASSWORD=$sqlSecret
WEB_PORT=8080
"@ | Set-Content -LiteralPath $envPath -Encoding utf8
}

# The identity API keeps the private key; other APIs receive only the public key.
[IO.Directory]::CreateDirectory($secretDirectory) | Out-Null
if (-not (Test-Path -LiteralPath $publicKeyPath) -or -not (Test-Path -LiteralPath $privateKeyPath)) {
    # Use the .NET 10 key generator to create portable PEM files on Windows and Linux.
    & dotnet run --project (Join-Path $PSScriptRoot 'Keygen/Keygen.csproj') -- $publicKeyPath $privateKeyPath
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the development JWT keys.' }
}

# Remove retired demo authentication settings without changing other .env values.
$envLines = Get-Content -LiteralPath $envPath | Where-Object { $_ -notmatch '^(JWT_KEY|ADMIN_EMAIL|ADMIN_PASSWORD)=' }
Set-Content -LiteralPath $envPath -Value $envLines -Encoding utf8
Write-Host 'Development environment is ready. Keep .env and .secrets private and out of source control.'
