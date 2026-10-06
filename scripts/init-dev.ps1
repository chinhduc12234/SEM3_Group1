$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$envPath = Join-Path $projectRoot '.env'
if (Test-Path -LiteralPath $envPath) { Write-Host '.env already exists; kept unchanged.'; exit 0 }
function New-Secret {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    return [Convert]::ToBase64String($bytes)
}
$sqlSecret = 'Sql1!' + (New-Secret)
$adminSecret = 'Admin1!' + (New-Secret)
$jwtSecret = New-Secret
@"
SQL_SA_PASSWORD=$sqlSecret
JWT_KEY=$jwtSecret
ADMIN_EMAIL=admin@sem3.local
ADMIN_PASSWORD=$adminSecret
WEB_PORT=8080
"@ | Set-Content -LiteralPath $envPath -Encoding utf8
Write-Host 'Created local .env with random secrets. Read ADMIN_EMAIL / ADMIN_PASSWORD in .env to sign in. Do not commit this file.'
