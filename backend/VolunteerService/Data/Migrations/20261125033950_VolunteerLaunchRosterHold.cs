using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VolunteerService.Data.Migrations
{
    /// <inheritdoc />
    public partial class VolunteerLaunchRosterHold : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LaunchRosterHolds",
                columns: table => new
                {
                    CampaignId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Token = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LaunchRosterHolds", x => x.CampaignId);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LaunchRosterHolds");
        }
    }
}
