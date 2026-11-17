using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CampaignService.Data.Migrations
{
    /// <inheritdoc />
    public partial class CampaignConceptDrafts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SubmittedSnapshot",
                table: "Reviews",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AlterColumn<DateOnly>(
                name: "StartDate",
                table: "Campaigns",
                type: "date",
                nullable: true,
                oldClrType: typeof(DateOnly),
                oldType: "date");

            migrationBuilder.AlterColumn<DateOnly>(
                name: "EndDate",
                table: "Campaigns",
                type: "date",
                nullable: true,
                oldClrType: typeof(DateOnly),
                oldType: "date");

            migrationBuilder.AddColumn<string>(
                name: "ConceptDetails",
                table: "Campaigns",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ParentCampaignId",
                table: "Campaigns",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Campaigns_ParentCampaignId",
                table: "Campaigns",
                column: "ParentCampaignId");

            migrationBuilder.AddForeignKey(
                name: "FK_Campaigns_Campaigns_ParentCampaignId",
                table: "Campaigns",
                column: "ParentCampaignId",
                principalTable: "Campaigns",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Campaigns_Campaigns_ParentCampaignId",
                table: "Campaigns");

            migrationBuilder.DropIndex(
                name: "IX_Campaigns_ParentCampaignId",
                table: "Campaigns");

            migrationBuilder.DropColumn(
                name: "SubmittedSnapshot",
                table: "Reviews");

            migrationBuilder.DropColumn(
                name: "ConceptDetails",
                table: "Campaigns");

            migrationBuilder.DropColumn(
                name: "ParentCampaignId",
                table: "Campaigns");

            migrationBuilder.AlterColumn<DateOnly>(
                name: "StartDate",
                table: "Campaigns",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1),
                oldClrType: typeof(DateOnly),
                oldType: "date",
                oldNullable: true);

            migrationBuilder.AlterColumn<DateOnly>(
                name: "EndDate",
                table: "Campaigns",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1),
                oldClrType: typeof(DateOnly),
                oldType: "date",
                oldNullable: true);
        }
    }
}
