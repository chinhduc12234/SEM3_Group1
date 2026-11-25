using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CampaignService.Data.Migrations
{
    /// <inheritdoc />
    public partial class CampaignLaunchTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LaunchConfirmations",
                table: "Campaigns",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "StartedAt",
                table: "Campaigns",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "StartedBy",
                table: "Campaigns",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "StartedSubmissionId",
                table: "Campaigns",
                type: "uniqueidentifier",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LaunchConfirmations",
                table: "Campaigns");

            migrationBuilder.DropColumn(
                name: "StartedAt",
                table: "Campaigns");

            migrationBuilder.DropColumn(
                name: "StartedBy",
                table: "Campaigns");

            migrationBuilder.DropColumn(
                name: "StartedSubmissionId",
                table: "Campaigns");
        }
    }
}
