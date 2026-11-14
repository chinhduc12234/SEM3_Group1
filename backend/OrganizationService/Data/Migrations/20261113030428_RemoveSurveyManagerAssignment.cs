using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrganizationService.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveSurveyManagerAssignment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                UPDATE invitation
                SET RolesJson = cleaned.RolesJson,
                    State = CASE WHEN cleaned.RoleCount = 0 AND invitation.State = 'PENDING' THEN 'REVOKED' ELSE invitation.State END
                FROM Invitations invitation
                CROSS APPLY
                (
                    SELECT COUNT(*) AS RoleCount,
                        COALESCE(N'[' + STRING_AGG(N'""' + STRING_ESCAPE(role.[value], 'json') + N'""', N',') + N']', N'[]') AS RolesJson
                    FROM OPENJSON(invitation.RolesJson) role
                    WHERE role.[value] <> 'SURVEY_STAFF'
                ) cleaned
                WHERE EXISTS (SELECT 1 FROM OPENJSON(invitation.RolesJson) role WHERE role.[value] = 'SURVEY_STAFF');
            ");
            migrationBuilder.Sql(@"
                IF COL_LENGTH(N'Members', N'SurveyManagerUserId') IS NOT NULL
                    ALTER TABLE [Members] DROP COLUMN [SurveyManagerUserId];
                IF COL_LENGTH(N'Invitations', N'SurveyManagerUserId') IS NOT NULL
                    ALTER TABLE [Invitations] DROP COLUMN [SurveyManagerUserId];
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SurveyManagerUserId",
                table: "Members",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SurveyManagerUserId",
                table: "Invitations",
                type: "uniqueidentifier",
                nullable: true);
        }
    }
}
