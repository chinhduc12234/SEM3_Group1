using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrganizationService.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPersonnelProfiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PersonnelName",
                table: "Members",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PersonnelPhone",
                table: "Members",
                type: "nvarchar(26)",
                maxLength: 26,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProtectedPersonnelIdentity",
                table: "Members",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProtectedPersonnelPhoto",
                table: "Members",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PersonnelName",
                table: "Invitations",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PersonnelPhone",
                table: "Invitations",
                type: "nvarchar(26)",
                maxLength: 26,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProtectedPersonnelIdentity",
                table: "Invitations",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProtectedPersonnelPhoto",
                table: "Invitations",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PersonnelName",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "PersonnelPhone",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "ProtectedPersonnelIdentity",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "ProtectedPersonnelPhoto",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "PersonnelName",
                table: "Invitations");

            migrationBuilder.DropColumn(
                name: "PersonnelPhone",
                table: "Invitations");

            migrationBuilder.DropColumn(
                name: "ProtectedPersonnelIdentity",
                table: "Invitations");

            migrationBuilder.DropColumn(
                name: "ProtectedPersonnelPhoto",
                table: "Invitations");
        }
    }
}
