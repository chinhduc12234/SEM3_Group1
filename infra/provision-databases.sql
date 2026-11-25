-- Migrations use sa; API logins can access only the database owned by their service.
USE master;
IF DB_ID(N'GiveAid_Notification') IS NULL CREATE DATABASE GiveAid_Notification;
IF SUSER_ID(N'giveaid_notification') IS NULL CREATE LOGIN giveaid_notification WITH PASSWORD = '$(NOTIFICATION_DB_PASSWORD)', CHECK_POLICY = ON;
ELSE IF (SELECT PWDCOMPARE('$(NOTIFICATION_DB_PASSWORD)', password_hash) FROM sys.sql_logins WHERE name=N'giveaid_notification') = 0
    ALTER LOGIN giveaid_notification WITH PASSWORD = '$(NOTIFICATION_DB_PASSWORD)';
GO
USE GiveAid_Notification;
IF DATABASE_PRINCIPAL_ID(N'giveaid_notification') IS NULL CREATE USER giveaid_notification FOR LOGIN giveaid_notification;
ALTER ROLE db_datareader ADD MEMBER giveaid_notification;
ALTER ROLE db_datawriter ADD MEMBER giveaid_notification;
GO
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

USE master;
IF DB_ID(N'GiveAid_Volunteer') IS NULL CREATE DATABASE GiveAid_Volunteer;
IF SUSER_ID(N'giveaid_volunteer') IS NULL CREATE LOGIN giveaid_volunteer WITH PASSWORD = '$(VOLUNTEER_DB_PASSWORD)', CHECK_POLICY = ON;
ELSE IF (SELECT PWDCOMPARE('$(VOLUNTEER_DB_PASSWORD)', password_hash) FROM sys.sql_logins WHERE name=N'giveaid_volunteer') = 0
    ALTER LOGIN giveaid_volunteer WITH PASSWORD = '$(VOLUNTEER_DB_PASSWORD)';
GO
USE GiveAid_Volunteer;
IF DATABASE_PRINCIPAL_ID(N'giveaid_volunteer') IS NULL CREATE USER giveaid_volunteer FOR LOGIN giveaid_volunteer;
ALTER ROLE db_datareader ADD MEMBER giveaid_volunteer;
ALTER ROLE db_datawriter ADD MEMBER giveaid_volunteer;
GO

USE master;
IF DB_ID(N'GiveAid_Donation') IS NULL CREATE DATABASE GiveAid_Donation;
IF SUSER_ID(N'giveaid_donation') IS NULL CREATE LOGIN giveaid_donation WITH PASSWORD = '$(DONATION_DB_PASSWORD)', CHECK_POLICY = ON;
ELSE IF (SELECT PWDCOMPARE('$(DONATION_DB_PASSWORD)', password_hash) FROM sys.sql_logins WHERE name=N'giveaid_donation') = 0
    ALTER LOGIN giveaid_donation WITH PASSWORD = '$(DONATION_DB_PASSWORD)';
GO
USE GiveAid_Donation;
IF DATABASE_PRINCIPAL_ID(N'giveaid_donation') IS NULL CREATE USER giveaid_donation FOR LOGIN giveaid_donation;
ALTER ROLE db_datareader ADD MEMBER giveaid_donation;
ALTER ROLE db_datawriter ADD MEMBER giveaid_donation;
GO
