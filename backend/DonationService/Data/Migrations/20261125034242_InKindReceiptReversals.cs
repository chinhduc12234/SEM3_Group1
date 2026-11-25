using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DonationService.Data.Migrations
{
    /// <inheritdoc />
    public partial class InKindReceiptReversals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ReversalReason",
                table: "InKindReceipts",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ReversesReceiptId",
                table: "InKindReceipts",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_InKindReceipts_ReversesReceiptId",
                table: "InKindReceipts",
                column: "ReversesReceiptId",
                unique: true,
                filter: "[ReversesReceiptId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_InKindReceipts_ReversesReceiptId",
                table: "InKindReceipts");

            migrationBuilder.DropColumn(
                name: "ReversalReason",
                table: "InKindReceipts");

            migrationBuilder.DropColumn(
                name: "ReversesReceiptId",
                table: "InKindReceipts");
        }
    }
}
