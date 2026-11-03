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

# Bootstrap secrets are generated once; restarting never resets the administrator password.
$envLines = @(Get-Content -LiteralPath $envPath | Where-Object { $_ -notmatch '^JWT_KEY=' })
foreach ($setting in @('SQL_SA_PASSWORD', 'ADMIN_PASSWORD', 'IDENTITY_DB_PASSWORD', 'ORGANIZATION_DB_PASSWORD', 'INTERNAL_API_KEY')) {
    $existing = $envLines | Where-Object { $_ -match ("^" + $setting + "=") }
    if (-not $existing -or $existing -match '=(CHANGE_ME|GENERATE_WITH)') {
        $envLines = @($envLines | Where-Object { $_ -notmatch ("^" + $setting + "=") })
        $secretBytes = New-Object byte[] 32
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        $rng.GetBytes($secretBytes)
        $rng.Dispose()
        $envLines += $setting + '=Ga1!' + [Convert]::ToBase64String($secretBytes)
    }
}
if (-not ($envLines | Where-Object { $_ -match '^ADMIN_EMAIL=' })) { $envLines += 'ADMIN_EMAIL=admin@giveaid.local' }
Set-Content -LiteralPath $envPath -Value $envLines -Encoding utf8
Write-Host 'Development environment is ready. Keep .env and .secrets private and out of source control.'
