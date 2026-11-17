using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CampaignService.Data.Migrations
{
    /// <inheritdoc />
    public partial class CampaignAssignmentsAndOperations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "OperationsConfirmedAt",
                table: "Campaigns",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OperationsConfirmedBy",
                table: "Campaigns",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OperationsPlan",
                table: "Campaigns",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AssignmentNotifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Payload = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    NextAttemptAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Attempts = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssignmentNotifications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CampaignAssignment",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CampaignId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MembershipId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Role = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    IsPrimary = table.Column<bool>(type: "bit", nullable: false),
                    AssignedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssignedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    RevokedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CampaignAssignment", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CampaignAssignment_Campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalTable: "Campaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AssignmentNotifications_NextAttemptAt",
                table: "AssignmentNotifications",
                column: "NextAttemptAt");

            migrationBuilder.CreateIndex(
                name: "IX_CampaignAssignment_CampaignId",
                table: "CampaignAssignment",
                column: "CampaignId");

            migrationBuilder.CreateIndex(
                name: "IX_CampaignAssignment_UserId_MembershipId_RevokedAt",
                table: "CampaignAssignment",
                columns: new[] { "UserId", "MembershipId", "RevokedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AssignmentNotifications");

            migrationBuilder.DropTable(
                name: "CampaignAssignment");

            migrationBuilder.DropColumn(
                name: "OperationsConfirmedAt",
                table: "Campaigns");

            migrationBuilder.DropColumn(
                name: "OperationsConfirmedBy",
                table: "Campaigns");

            migrationBuilder.DropColumn(
                name: "OperationsPlan",
                table: "Campaigns");
        }
    }
}
