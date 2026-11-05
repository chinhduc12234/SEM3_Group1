using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CampaignService.Data.Migrations
{
    /// <inheritdoc />
    public partial class SurveyReports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SurveyReports",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrganizationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StaffId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ManagerId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Title = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    Province = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Ward = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    AddressDetail = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Severity = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    AffectedHouseholds = table.Column<int>(type: "int", nullable: true),
                    Description = table.Column<string>(type: "nvarchar(max)", maxLength: 10000, nullable: false),
                    ProposedSupport = table.Column<string>(type: "nvarchar(max)", maxLength: 5000, nullable: false),
                    SurveyedAt = table.Column<DateOnly>(type: "date", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    ReviewNote = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    ReviewedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ReviewedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    SubmittedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    Version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyReports", x => x.Id);
                    table.CheckConstraint("CK_SurveyReports_Households", "[AffectedHouseholds] IS NULL OR [AffectedHouseholds] >= 0");
                });

            migrationBuilder.CreateTable(
                name: "SurveyNotifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReportId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RecipientId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Message = table.Column<string>(type: "nvarchar(2300)", maxLength: 2300, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    ReadAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyNotifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SurveyNotifications_SurveyReports_ReportId",
                        column: x => x.ReportId,
                        principalTable: "SurveyReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SurveyReportEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReportId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ActorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Action = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyReportEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SurveyReportEvents_SurveyReports_ReportId",
                        column: x => x.ReportId,
                        principalTable: "SurveyReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SurveyReportImages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReportId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FileReference = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    Content = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    UploadedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyReportImages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SurveyReportImages_SurveyReports_ReportId",
                        column: x => x.ReportId,
                        principalTable: "SurveyReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SurveyNotifications_RecipientId_ReadAt",
                table: "SurveyNotifications",
                columns: new[] { "RecipientId", "ReadAt" });

            migrationBuilder.CreateIndex(
                name: "IX_SurveyNotifications_ReportId",
                table: "SurveyNotifications",
                column: "ReportId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyReportEvents_ReportId",
                table: "SurveyReportEvents",
                column: "ReportId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyReportImages_ReportId",
                table: "SurveyReportImages",
                column: "ReportId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyReports_OrganizationId_ManagerId_IsDeleted_Status",
                table: "SurveyReports",
                columns: new[] { "OrganizationId", "ManagerId", "IsDeleted", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_SurveyReports_OrganizationId_StaffId_IsDeleted_Status",
                table: "SurveyReports",
                columns: new[] { "OrganizationId", "StaffId", "IsDeleted", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SurveyNotifications");

            migrationBuilder.DropTable(
                name: "SurveyReportEvents");

            migrationBuilder.DropTable(
                name: "SurveyReportImages");

            migrationBuilder.DropTable(
                name: "SurveyReports");
        }
    }
}
