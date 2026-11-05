using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrganizationService.Data.Migrations
{
    /// <inheritdoc />
    public partial class SurveyManagerAssignment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
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
            // Recover direct managers from invitations created before this relationship was introduced.
            migrationBuilder.Sql(@"UPDATE i SET SurveyManagerUserId = i.InvitedBy
                FROM Invitations i JOIN Members m ON m.OrganizationId = i.OrganizationId AND m.UserId = i.InvitedBy
                WHERE i.SurveyManagerUserId IS NULL AND m.IsActive = 1
                AND EXISTS (SELECT 1 FROM OrganizationMemberRole r WHERE r.MemberId = m.Id AND r.Role = 'CAMPAIGN_MANAGER')
                AND EXISTS (SELECT 1 FROM OPENJSON(i.RolesJson) WHERE [value] = 'SURVEY_STAFF');
                UPDATE m SET SurveyManagerUserId = lastInvite.SurveyManagerUserId
                FROM Members m CROSS APPLY (SELECT TOP (1) i.SurveyManagerUserId FROM Invitations i
                    WHERE i.OrganizationId = m.OrganizationId AND i.InvitedUserId = m.UserId AND i.State = 'ACCEPTED'
                    AND i.SurveyManagerUserId IS NOT NULL ORDER BY i.CreatedAt DESC) lastInvite
                WHERE m.SurveyManagerUserId IS NULL AND m.UserId <> lastInvite.SurveyManagerUserId
                AND EXISTS (SELECT 1 FROM OrganizationMemberRole r WHERE r.MemberId = m.Id AND r.Role = 'SURVEY_STAFF');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SurveyManagerUserId",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "SurveyManagerUserId",
                table: "Invitations");
        }
    }
}
