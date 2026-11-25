using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DonationService.Data.Migrations
{
    /// <inheritdoc />
    public partial class SandboxDonationLifecycle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "PublishDonorName",
                table: "Donations",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "RequestId",
                table: "Donations",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Donations_DonorUserId_CampaignId_RequestId",
                table: "Donations",
                columns: new[] { "DonorUserId", "CampaignId", "RequestId" },
                unique: true,
                filter: "[RequestId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Donations_DonorUserId_CampaignId_RequestId",
                table: "Donations");

            migrationBuilder.DropColumn(
                name: "PublishDonorName",
                table: "Donations");

            migrationBuilder.DropColumn(
                name: "RequestId",
                table: "Donations");
        }
    }
}
