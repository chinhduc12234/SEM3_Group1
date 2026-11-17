using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrganizationService.Data.Migrations
{
    /// <inheritdoc />
    public partial class UnlinkedPersonnel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Members_OrganizationId_UserId",
                table: "Members");

            migrationBuilder.AlterColumn<Guid>(
                name: "UserId",
                table: "Members",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AddColumn<Guid>(
                name: "PersonnelMemberId",
                table: "Invitations",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Members_OrganizationId_UserId",
                table: "Members",
                columns: new[] { "OrganizationId", "UserId" },
                unique: true,
                filter: "[UserId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Invitations_OrganizationId_PersonnelMemberId",
                table: "Invitations",
                columns: new[] { "OrganizationId", "PersonnelMemberId" },
                unique: true,
                filter: "[State] = 'PENDING' AND [PersonnelMemberId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF EXISTS (SELECT 1 FROM [Members] WHERE [UserId] IS NULL)
                    THROW 51000, 'Cannot roll back while personnel profiles without linked accounts exist.', 1;
                """);
            migrationBuilder.DropIndex(
                name: "IX_Members_OrganizationId_UserId",
                table: "Members");

            migrationBuilder.DropIndex(
                name: "IX_Invitations_OrganizationId_PersonnelMemberId",
                table: "Invitations");

            migrationBuilder.DropColumn(
                name: "PersonnelMemberId",
                table: "Invitations");

            migrationBuilder.AlterColumn<Guid>(
                name: "UserId",
                table: "Members",
                type: "uniqueidentifier",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Members_OrganizationId_UserId",
                table: "Members",
                columns: new[] { "OrganizationId", "UserId" },
                unique: true);
        }
    }
}
