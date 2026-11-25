using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DonationService.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialDonation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Donations",
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
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    PaymentMethod = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Reference = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    ConfirmedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Donations", x => x.Id);
                    table.CheckConstraint("CK_Donations_Amount", "[Amount] > 0");
                });

            migrationBuilder.CreateTable(
                name: "NotificationOutbox",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Payload = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    NextAttemptAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Attempts = table.Column<int>(type: "int", nullable: false),
                    DeliveredAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    LastErrorCode = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationOutbox", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Donations_CampaignId_Status_BudgetItemId",
                table: "Donations",
                columns: new[] { "CampaignId", "Status", "BudgetItemId" });

            migrationBuilder.CreateIndex(
                name: "IX_Donations_DonorUserId_CreatedAt",
                table: "Donations",
                columns: new[] { "DonorUserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Donations_Reference",
                table: "Donations",
                column: "Reference",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_NotificationOutbox_NextAttemptAt",
                table: "NotificationOutbox",
                column: "NextAttemptAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Donations");

            migrationBuilder.DropTable(
                name: "NotificationOutbox");
        }
    }
}
