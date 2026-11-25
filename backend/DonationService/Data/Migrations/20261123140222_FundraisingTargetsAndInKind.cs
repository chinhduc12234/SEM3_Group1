using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DonationService.Data.Migrations
{
    /// <inheritdoc />
    public partial class FundraisingTargetsAndInKind : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Route",
                table: "NotificationOutbox",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "internal/notifications/donation-confirmed");

            migrationBuilder.CreateTable(
                name: "FundraisingClosures",
                columns: table => new
                {
                    CampaignId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ClosedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FundraisingClosures", x => x.CampaignId);
                });

            migrationBuilder.CreateTable(
                name: "InKindPledges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CampaignId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BudgetItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DonorUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DonorName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    DonorEmail = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    CampaignTitle = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    TargetName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Quantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ReceivedQuantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Unit = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ReviewedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ReviewedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InKindPledges", x => x.Id);
                    table.CheckConstraint("CK_InKindPledges_Quantity", "[Quantity] > 0 AND [ReceivedQuantity] >= 0 AND [ReceivedQuantity] <= [Quantity]");
                });

            migrationBuilder.CreateIndex(
                name: "IX_InKindPledges_CampaignId_BudgetItemId_Status",
                table: "InKindPledges",
                columns: new[] { "CampaignId", "BudgetItemId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_InKindPledges_DonorUserId_CreatedAt",
                table: "InKindPledges",
                columns: new[] { "DonorUserId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FundraisingClosures");

            migrationBuilder.DropTable(
                name: "InKindPledges");

            migrationBuilder.DropColumn(
                name: "Route",
                table: "NotificationOutbox");
        }
    }
}
