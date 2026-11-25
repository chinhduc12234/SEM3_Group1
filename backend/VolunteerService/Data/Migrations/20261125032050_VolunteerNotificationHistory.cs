using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VolunteerService.Data.Migrations
{
    /// <inheritdoc />
    public partial class VolunteerNotificationHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_VolunteerNotificationOutbox_RegistrationId",
                table: "VolunteerNotificationOutbox");

            migrationBuilder.CreateIndex(
                name: "IX_VolunteerNotificationOutbox_RegistrationId",
                table: "VolunteerNotificationOutbox",
                column: "RegistrationId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_VolunteerNotificationOutbox_RegistrationId",
                table: "VolunteerNotificationOutbox");

            migrationBuilder.CreateIndex(
                name: "IX_VolunteerNotificationOutbox_RegistrationId",
                table: "VolunteerNotificationOutbox",
                column: "RegistrationId",
                unique: true);
        }
    }
}
