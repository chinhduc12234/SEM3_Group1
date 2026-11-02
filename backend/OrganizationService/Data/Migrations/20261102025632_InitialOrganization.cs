using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrganizationService.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialOrganization : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Organizations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ApplicantUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Profile_LegalName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Profile_OrganizationType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Profile_RegistrationNumber = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Profile_RegistrationDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Profile_RegistrationAuthority = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Profile_FoundedDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Profile_TaxCode = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    Profile_Address = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    Profile_Province = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Profile_ContactEmail = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Profile_ContactPhone = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Profile_Website = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Profile_Mission = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    Profile_RepresentativeName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Profile_RepresentativeTitle = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Profile_RepresentativeBirthDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Profile_RepresentativeEmail = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Profile_RepresentativePhone = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Profile_IdentityType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Profile_IdentityIssuedDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Profile_IdentityIssuedBy = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    RegistrationKey = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    ProtectedIdentityNumber = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Consent = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    SubmittedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    Version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Organizations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Documents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrganizationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Size = table.Column<long>(type: "bigint", nullable: false),
                    ProtectedContent = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    UploadedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Documents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Documents_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Members",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrganizationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Role = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Members", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Members_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OrganizationReview",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrganizationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Action = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    At = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationReview", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrganizationReview_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Documents_OrganizationId_Kind",
                table: "Documents",
                columns: new[] { "OrganizationId", "Kind" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Members_OrganizationId_UserId",
                table: "Members",
                columns: new[] { "OrganizationId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationReview_OrganizationId",
                table: "OrganizationReview",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Organizations_ApplicantUserId_CreatedAt",
                table: "Organizations",
                columns: new[] { "ApplicantUserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Organizations_RegistrationKey",
                table: "Organizations",
                column: "RegistrationKey",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Documents");

            migrationBuilder.DropTable(
                name: "Members");

            migrationBuilder.DropTable(
                name: "OrganizationReview");

            migrationBuilder.DropTable(
                name: "Organizations");
        }
    }
}
