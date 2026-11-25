using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VolunteerService.Data.Migrations
{
    /// <inheritdoc />
    public partial class VolunteerOfferConfirmation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AvailableDatesJson",
                table: "VolunteerRegistrations",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ConfirmBy",
                table: "VolunteerGroupAssignments",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ConfirmedAt",
                table: "VolunteerGroupAssignments",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_VolunteerGroupAssignments_Status_ConfirmBy",
                table: "VolunteerGroupAssignments",
                columns: new[] { "Status", "ConfirmBy" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_VolunteerGroupAssignments_Status_ConfirmBy",
                table: "VolunteerGroupAssignments");

            migrationBuilder.DropColumn(
                name: "AvailableDatesJson",
                table: "VolunteerRegistrations");

            migrationBuilder.DropColumn(
                name: "ConfirmBy",
                table: "VolunteerGroupAssignments");

            migrationBuilder.DropColumn(
                name: "ConfirmedAt",
                table: "VolunteerGroupAssignments");
        }
    }
}
