using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CampaignService.Data.Migrations
{
    /// <inheritdoc />
    public partial class CampaignAdditionalSubmissionDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AdditionalDetails",
                table: "Campaigns",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AdditionalDetails",
                table: "Campaigns");
        }
    }
}
