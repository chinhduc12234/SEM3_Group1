$ErrorActionPreference = 'Stop'

# Local-only seed for the four demo accounts created through the registration UI.
# This intentionally bypasses legal review only in the local demo database; it does
# not create legal documents, set consent, or alter Identity account roles.
$projectRoot = Split-Path $PSScriptRoot -Parent
$envPath = Join-Path $projectRoot '.env'
if (-not (Test-Path -LiteralPath $envPath)) {
    throw 'Missing .env. Start the local Give-AID development stack first.'
}

$settings = @{}
foreach ($line in Get-Content -LiteralPath $envPath) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#') -or $trimmed -notmatch '=') { continue }
    $parts = $trimmed -split '=', 2
    $settings[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'")
}
if (-not $settings['SQL_SA_PASSWORD']) {
    throw 'SQL_SA_PASSWORD is missing from .env.'
}

$builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
$builder['Data Source'] = '127.0.0.1,1433'
$builder['Initial Catalog'] = 'master'
$builder['User ID'] = 'sa'
$builder['Password'] = $settings['SQL_SA_PASSWORD']
$builder['Encrypt'] = $true
$builder['TrustServerCertificate'] = $true
$builder['Connect Timeout'] = 10
$builder['Application Name'] = 'GiveAidDemoSeeder'
$connection = New-Object System.Data.SqlClient.SqlConnection($builder.ConnectionString)

$accountSpecs = @(
    [pscustomobject]@{ Email = 'owner.demo@giveaid.local'; Role = 'OWNER'; Name = 'Demo Owner' },
    [pscustomobject]@{ Email = 'campaign.demo@giveaid.local'; Role = 'CAMPAIGN_MANAGER'; Name = 'Demo Campaign Manager' },
    [pscustomobject]@{ Email = 'finance.demo@giveaid.local'; Role = 'FINANCE_MANAGER'; Name = 'Demo Finance Manager' },
    [pscustomobject]@{ Email = 'staff.demo@giveaid.local'; Role = 'STAFF'; Name = 'Demo Staff Member' }
)
$organizationId = [Guid]'8e89772a-0417-4f13-baa3-01c3a4ded000'
$now = [DateTimeOffset]::UtcNow

function New-Command([string]$sql, $transaction) {
    $command = $connection.CreateCommand()
    $command.CommandText = $sql
    $command.CommandTimeout = 30
    if ($transaction) { $command.Transaction = $transaction }
    return $command
}

try {
    $connection.Open()

    $lookup = New-Command @'
SELECT Id, NormalizedEmail, FullName, IsActive
FROM GiveAid_Identity.dbo.AspNetUsers
WHERE NormalizedEmail IN (@Owner, @Campaign, @Finance, @Staff);
'@ $null
    foreach ($spec in $accountSpecs) {
        $parameterName = switch ($spec.Role) {
            'OWNER' { '@Owner' }
            'CAMPAIGN_MANAGER' { '@Campaign' }
            'FINANCE_MANAGER' { '@Finance' }
            'STAFF' { '@Staff' }
        }
        $parameter = $lookup.Parameters.Add($parameterName, [System.Data.SqlDbType]::NVarChar, 256)
        $parameter.Value = $spec.Email.ToUpperInvariant()
    }
    $users = @{}
    $reader = $lookup.ExecuteReader()
    try {
        while ($reader.Read()) {
            $users[[string]$reader['NormalizedEmail']] = [pscustomobject]@{
                Id = [Guid]$reader['Id']
                Name = [string]$reader['FullName']
                IsActive = [bool]$reader['IsActive']
            }
        }
    } finally {
        $reader.Dispose()
        $lookup.Dispose()
    }

    foreach ($spec in $accountSpecs) {
        $key = $spec.Email.ToUpperInvariant()
        if (-not $users.ContainsKey($key)) { throw "Demo account not found: $($spec.Email). Register all four demo accounts first." }
        if (-not $users[$key].IsActive) { throw "Demo account is disabled: $($spec.Email)." }
    }

    $ownerId = $users['OWNER.DEMO@GIVEAID.LOCAL'].Id
    $transaction = $connection.BeginTransaction()
    try {
        $organization = New-Command @'
IF EXISTS (SELECT 1 FROM GiveAid_Organization.dbo.Organizations WHERE RegistrationKey = N'DEMO-GIVEAID-LOCAL-001' AND Id <> @OrganizationId)
    THROW 51000, 'The demo registration key is already in use by another organization.', 1;

IF EXISTS (SELECT 1 FROM GiveAid_Organization.dbo.Organizations WHERE Id = @OrganizationId)
BEGIN
    UPDATE GiveAid_Organization.dbo.Organizations SET
        ApplicantUserId=@OwnerId, Profile_LegalName=N'[DEMO] Give-AID Sample Organization',
        Profile_OrganizationType=N'NGO', Profile_RegistrationNumber=N'DEMO-LOCAL-001',
        Profile_RegistrationDate='2026-01-01', Profile_RegistrationAuthority=N'Local development seed',
        Profile_FoundedDate='2026-01-01', Profile_TaxCode=NULL,
        Profile_Address=N'Local development only — synthetic demo data', Profile_Province=N'Demo Province',
        Profile_ContactEmail=N'owner.demo@giveaid.local', Profile_ContactPhone=N'0000000000',
        Profile_Website=N'http://localhost:8080',
        Profile_Mission=N'Synthetic local demo workspace for exploring Give-AID organization roles and dashboards.',
        Profile_RepresentativeName=N'Demo Owner', Profile_RepresentativeTitle=N'Demo representative',
        Profile_RepresentativeBirthDate='1990-01-01', Profile_RepresentativeEmail=N'owner.demo@giveaid.local',
        Profile_RepresentativePhone=N'0000000000', Profile_IdentityType=N'CCCD',
        Profile_IdentityIssuedDate='2020-01-01', Profile_IdentityIssuedBy=N'Local development seed',
        ProtectedIdentityNumber=N'DEMO-SEED-NO-REAL-ID', Status=N'ACTIVE', Consent=0,
        UpdatedAt=@Now, SubmittedAt=NULL
    WHERE Id=@OrganizationId;
END
ELSE
BEGIN
    INSERT INTO GiveAid_Organization.dbo.Organizations
        (Id, ApplicantUserId, Profile_LegalName, Profile_OrganizationType, Profile_RegistrationNumber,
         Profile_RegistrationDate, Profile_RegistrationAuthority, Profile_FoundedDate, Profile_TaxCode,
         Profile_Address, Profile_Province, Profile_ContactEmail, Profile_ContactPhone, Profile_Website,
         Profile_Mission, Profile_RepresentativeName, Profile_RepresentativeTitle,
         Profile_RepresentativeBirthDate, Profile_RepresentativeEmail, Profile_RepresentativePhone,
         Profile_IdentityType, Profile_IdentityIssuedDate, Profile_IdentityIssuedBy, RegistrationKey,
         ProtectedIdentityNumber, Status, Consent, CreatedAt, UpdatedAt, SubmittedAt)
    VALUES
        (@OrganizationId, @OwnerId, N'[DEMO] Give-AID Sample Organization', N'NGO', N'DEMO-LOCAL-001',
         '2026-01-01', N'Local development seed', '2026-01-01', NULL,
         N'Local development only — synthetic demo data', N'Demo Province', N'owner.demo@giveaid.local',
         N'0000000000', N'http://localhost:8080',
         N'Synthetic local demo workspace for exploring Give-AID organization roles and dashboards.',
         N'Demo Owner', N'Demo representative', '1990-01-01', N'owner.demo@giveaid.local',
         N'0000000000', N'CCCD', '2020-01-01', N'Local development seed', N'DEMO-GIVEAID-LOCAL-001',
         N'DEMO-SEED-NO-REAL-ID', N'ACTIVE', 0, @Now, @Now, NULL);
END;
'@ $transaction
        [void]$organization.Parameters.Add('@OrganizationId', [System.Data.SqlDbType]::UniqueIdentifier)
        $organization.Parameters['@OrganizationId'].Value = $organizationId
        [void]$organization.Parameters.Add('@OwnerId', [System.Data.SqlDbType]::UniqueIdentifier)
        $organization.Parameters['@OwnerId'].Value = $ownerId
        [void]$organization.Parameters.Add('@Now', [System.Data.SqlDbType]::DateTimeOffset)
        $organization.Parameters['@Now'].Value = $now
        [void]$organization.ExecuteNonQuery()
        $organization.Dispose()

        $workspace = New-Command @'
IF EXISTS (SELECT 1 FROM GiveAid_Organization.dbo.Workspaces WHERE OrganizationId=@OrganizationId)
    UPDATE GiveAid_Organization.dbo.Workspaces SET
        DisplayName=N'[DEMO] Give-AID Sample Organization',
        Introduction=N'Synthetic local demo workspace. No legal documents or real identity data are used.',
        Mission=N'Explore organization, campaign, finance, and staff dashboards using local-only sample data.',
        FocusAreasJson=N'["EDUCATION","COMMUNITY"]', ContactEmail=N'owner.demo@giveaid.local',
        ContactPhone=N'0000000000', Website=N'http://localhost:8080',
        Address=N'Local development only — synthetic demo data', UpdatedAt=@Now
    WHERE OrganizationId=@OrganizationId;
ELSE
    INSERT INTO GiveAid_Organization.dbo.Workspaces
        (OrganizationId, DisplayName, Introduction, Mission, FocusAreasJson, ContactEmail,
         ContactPhone, Website, Address, UpdatedAt)
    VALUES
        (@OrganizationId, N'[DEMO] Give-AID Sample Organization',
         N'Synthetic local demo workspace. No legal documents or real identity data are used.',
         N'Explore organization, campaign, finance, and staff dashboards using local-only sample data.',
         N'["EDUCATION","COMMUNITY"]', N'owner.demo@giveaid.local', N'0000000000',
         N'http://localhost:8080', N'Local development only — synthetic demo data', @Now);
'@ $transaction
        [void]$workspace.Parameters.Add('@OrganizationId', [System.Data.SqlDbType]::UniqueIdentifier)
        $workspace.Parameters['@OrganizationId'].Value = $organizationId
        [void]$workspace.Parameters.Add('@Now', [System.Data.SqlDbType]::DateTimeOffset)
        $workspace.Parameters['@Now'].Value = $now
        [void]$workspace.ExecuteNonQuery()
        $workspace.Dispose()

        foreach ($spec in $accountSpecs) {
            $user = $users[$spec.Email.ToUpperInvariant()]
            $member = New-Command @'
DECLARE @MemberId uniqueidentifier;
SELECT @MemberId=Id FROM GiveAid_Organization.dbo.Members
WHERE OrganizationId=@OrganizationId AND UserId=@UserId;

IF @MemberId IS NULL
BEGIN
    SET @MemberId=NEWID();
    INSERT INTO GiveAid_Organization.dbo.Members
        (Id, OrganizationId, UserId, Role, IsActive, JoinedAt, UpdatedAt, PersonnelName)
    VALUES (@MemberId, @OrganizationId, @UserId, @Role, 1, @Now, @Now, @Name);
END
ELSE
    UPDATE GiveAid_Organization.dbo.Members
    SET Role=@Role, IsActive=1, UpdatedAt=@Now, PersonnelName=@Name
    WHERE Id=@MemberId;

DELETE FROM GiveAid_Organization.dbo.OrganizationMemberRole WHERE MemberId=@MemberId;
INSERT INTO GiveAid_Organization.dbo.OrganizationMemberRole (MemberId, Role) VALUES (@MemberId, @Role);
'@ $transaction
            [void]$member.Parameters.Add('@OrganizationId', [System.Data.SqlDbType]::UniqueIdentifier)
            $member.Parameters['@OrganizationId'].Value = $organizationId
            [void]$member.Parameters.Add('@UserId', [System.Data.SqlDbType]::UniqueIdentifier)
            $member.Parameters['@UserId'].Value = $user.Id
            [void]$member.Parameters.Add('@Role', [System.Data.SqlDbType]::NVarChar, 40)
            $member.Parameters['@Role'].Value = $spec.Role
            [void]$member.Parameters.Add('@Name', [System.Data.SqlDbType]::NVarChar, 120)
            $member.Parameters['@Name'].Value = $spec.Name
            [void]$member.Parameters.Add('@Now', [System.Data.SqlDbType]::DateTimeOffset)
            $member.Parameters['@Now'].Value = $now
            [void]$member.ExecuteNonQuery()
            $member.Dispose()
        }

        $activity = New-Command @'
IF NOT EXISTS (SELECT 1 FROM GiveAid_Organization.dbo.Activities
               WHERE OrganizationId=@OrganizationId AND Action=N'DEMO_SEED')
    INSERT INTO GiveAid_Organization.dbo.Activities (Id, OrganizationId, ActorUserId, Action, Detail, At)
    VALUES (NEWID(), @OrganizationId, @OwnerId, N'DEMO_SEED',
            N'Local-only demo seed. This workspace did not pass legal review.', @Now);
'@ $transaction
        [void]$activity.Parameters.Add('@OrganizationId', [System.Data.SqlDbType]::UniqueIdentifier)
        $activity.Parameters['@OrganizationId'].Value = $organizationId
        [void]$activity.Parameters.Add('@OwnerId', [System.Data.SqlDbType]::UniqueIdentifier)
        $activity.Parameters['@OwnerId'].Value = $ownerId
        [void]$activity.Parameters.Add('@Now', [System.Data.SqlDbType]::DateTimeOffset)
        $activity.Parameters['@Now'].Value = $now
        [void]$activity.ExecuteNonQuery()
        $activity.Dispose()

        $transaction.Commit()
    } catch {
        $transaction.Rollback()
        throw
    } finally {
        $transaction.Dispose()
    }

    Write-Host 'Seeded local demo workspace: [DEMO] Give-AID Sample Organization'
    foreach ($spec in $accountSpecs) { Write-Host ("  {0} -> {1}" -f $spec.Email, $spec.Role) }
    Write-Host 'The seed is idempotent and does not change Identity account roles.'
} finally {
    $connection.Dispose()
}
