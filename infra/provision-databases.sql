-- Migrations use sa; API logins can access only the database owned by their service.
USE master;
IF DB_ID(N'GiveAid_Identity') IS NULL CREATE DATABASE GiveAid_Identity;
IF DB_ID(N'GiveAid_Organization') IS NULL CREATE DATABASE GiveAid_Organization;
IF SUSER_ID(N'giveaid_identity') IS NULL CREATE LOGIN giveaid_identity WITH PASSWORD = '$(IDENTITY_DB_PASSWORD)', CHECK_POLICY = ON;
ELSE IF (SELECT PWDCOMPARE('$(IDENTITY_DB_PASSWORD)', password_hash) FROM sys.sql_logins WHERE name=N'giveaid_identity') = 0
    ALTER LOGIN giveaid_identity WITH PASSWORD = '$(IDENTITY_DB_PASSWORD)';
IF SUSER_ID(N'giveaid_organization') IS NULL CREATE LOGIN giveaid_organization WITH PASSWORD = '$(ORGANIZATION_DB_PASSWORD)', CHECK_POLICY = ON;
ELSE IF (SELECT PWDCOMPARE('$(ORGANIZATION_DB_PASSWORD)', password_hash) FROM sys.sql_logins WHERE name=N'giveaid_organization') = 0
    ALTER LOGIN giveaid_organization WITH PASSWORD = '$(ORGANIZATION_DB_PASSWORD)';
GO
USE GiveAid_Identity;
IF DATABASE_PRINCIPAL_ID(N'giveaid_identity') IS NULL CREATE USER giveaid_identity FOR LOGIN giveaid_identity;
ALTER ROLE db_datareader ADD MEMBER giveaid_identity;
ALTER ROLE db_datawriter ADD MEMBER giveaid_identity;
GO
USE GiveAid_Organization;
IF DATABASE_PRINCIPAL_ID(N'giveaid_organization') IS NULL CREATE USER giveaid_organization FOR LOGIN giveaid_organization;
ALTER ROLE db_datareader ADD MEMBER giveaid_organization;
ALTER ROLE db_datawriter ADD MEMBER giveaid_organization;
GO

USE master;
IF DB_ID(N'GiveAid_Campaign') IS NULL CREATE DATABASE GiveAid_Campaign;
IF SUSER_ID(N'giveaid_campaign') IS NULL CREATE LOGIN giveaid_campaign WITH PASSWORD = '$(CAMPAIGN_DB_PASSWORD)', CHECK_POLICY = ON;
ELSE IF (SELECT PWDCOMPARE('$(CAMPAIGN_DB_PASSWORD)', password_hash) FROM sys.sql_logins WHERE name=N'giveaid_campaign') = 0
    ALTER LOGIN giveaid_campaign WITH PASSWORD = '$(CAMPAIGN_DB_PASSWORD)';
GO
USE GiveAid_Campaign;
IF DATABASE_PRINCIPAL_ID(N'giveaid_campaign') IS NULL CREATE USER giveaid_campaign FOR LOGIN giveaid_campaign;
ALTER ROLE db_datareader ADD MEMBER giveaid_campaign;
ALTER ROLE db_datawriter ADD MEMBER giveaid_campaign;
GO
