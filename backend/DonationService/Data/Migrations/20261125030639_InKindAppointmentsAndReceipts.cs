using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DonationService.Data.Migrations
{
    /// <inheritdoc />
    public partial class InKindAppointmentsAndReceipts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ExpiresAt",
                table: "InKindPledges",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.Sql("""
                EXEC(N'UPDATE [InKindPledges]
                SET [ExpiresAt] = DATEADD(day, 7, COALESCE([ReviewedAt], [CreatedAt]))
                WHERE [Status] = N''APPROVED'';');
                """);

            migrationBuilder.AddColumn<Guid>(
                name: "PointId",
                table: "InKindPledges",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ScheduledAt",
                table: "InKindPledges",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "InKindReceipts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RequestId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RequestHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    CampaignId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PointId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReceiverUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReceivedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InKindReceipts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "InKindReceiptLines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReceiptId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BudgetItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PledgeId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Quantity = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InKindReceiptLines", x => x.Id);
                    table.CheckConstraint("CK_InKindReceiptLines_Quantity", "[Quantity] > 0");
                    table.ForeignKey(
                        name: "FK_InKindReceiptLines_InKindPledges_PledgeId",
                        column: x => x.PledgeId,
                        principalTable: "InKindPledges",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InKindReceiptLines_InKindReceipts_ReceiptId",
                        column: x => x.ReceiptId,
                        principalTable: "InKindReceipts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_InKindPledges_CampaignId_PointId_Status_ScheduledAt",
                table: "InKindPledges",
                columns: new[] { "CampaignId", "PointId", "Status", "ScheduledAt" });

            migrationBuilder.CreateIndex(
                name: "IX_InKindReceiptLines_PledgeId",
                table: "InKindReceiptLines",
                column: "PledgeId");

            migrationBuilder.CreateIndex(
                name: "IX_InKindReceiptLines_ReceiptId",
                table: "InKindReceiptLines",
                column: "ReceiptId");

            migrationBuilder.CreateIndex(
                name: "IX_InKindReceipts_CampaignId_PointId_ReceivedAt",
                table: "InKindReceipts",
                columns: new[] { "CampaignId", "PointId", "ReceivedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_InKindReceipts_CampaignId_RequestId",
                table: "InKindReceipts",
                columns: new[] { "CampaignId", "RequestId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "InKindReceiptLines");

            migrationBuilder.DropTable(
                name: "InKindReceipts");

            migrationBuilder.DropIndex(
                name: "IX_InKindPledges_CampaignId_PointId_Status_ScheduledAt",
                table: "InKindPledges");

            migrationBuilder.DropColumn(
                name: "ExpiresAt",
                table: "InKindPledges");

            migrationBuilder.DropColumn(
                name: "PointId",
                table: "InKindPledges");

            migrationBuilder.DropColumn(
                name: "ScheduledAt",
                table: "InKindPledges");
        }
    }
}
