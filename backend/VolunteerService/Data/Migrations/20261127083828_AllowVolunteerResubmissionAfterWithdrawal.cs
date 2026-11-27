using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VolunteerService.Data.Migrations
{
    /// <inheritdoc />
    public partial class AllowVolunteerResubmissionAfterWithdrawal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_VolunteerRegistrations_UserId_CampaignId",
                table: "VolunteerRegistrations");

            migrationBuilder.CreateIndex(
                name: "IX_VolunteerRegistrations_UserId_CampaignId",
                table: "VolunteerRegistrations",
                columns: new[] { "UserId", "CampaignId" },
                unique: true,
                filter: "[Status] <> N'WITHDRAWN'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_VolunteerRegistrations_UserId_CampaignId",
                table: "VolunteerRegistrations");

            migrationBuilder.CreateIndex(
                name: "IX_VolunteerRegistrations_UserId_CampaignId",
                table: "VolunteerRegistrations",
                columns: new[] { "UserId", "CampaignId" },
                unique: true);
        }
    }
}
