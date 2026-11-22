using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VolunteerService.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialVolunteer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Tasks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CampaignId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ActivityId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GroupId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time", nullable: true),
                    EndTime = table.Column<TimeOnly>(type: "time", nullable: true),
                    RequiredVolunteers = table.Column<int>(type: "int", nullable: false),
                    Priority = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tasks", x => x.Id);
                    table.CheckConstraint("CK_Tasks_Priority", "[Priority] IN ('LOW','MEDIUM','HIGH','URGENT')");
                    table.CheckConstraint("CK_Tasks_RequiredVolunteers", "[RequiredVolunteers] > 0");
                    table.CheckConstraint("CK_Tasks_Status", "[Status] IN ('DRAFT','OPEN','IN_PROGRESS','COMPLETED','CANCELLED')");
                    table.CheckConstraint("CK_Tasks_TimeRange", "[StartTime] IS NULL OR [EndTime] IS NULL OR [StartTime] < [EndTime]");
                });

            migrationBuilder.CreateTable(
                name: "VolunteerRegistrations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CampaignId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    PhoneNumber = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    DateOfBirth = table.Column<DateOnly>(type: "date", nullable: true),
                    Occupation = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    HealthNote = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Skills = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Experience = table.Column<string>(type: "nvarchar(3000)", maxLength: 3000, nullable: true),
                    Motivation = table.Column<string>(type: "nvarchar(3000)", maxLength: 3000, nullable: true),
                    EmergencyContactName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    EmergencyContactPhone = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    CommitsToAllDays = table.Column<bool>(type: "bit", nullable: false),
                    AgreedToTerms = table.Column<bool>(type: "bit", nullable: false),
                    TermsAgreedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ReviewedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ReviewedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RejectionReason = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VolunteerRegistrations", x => x.Id);
                    table.CheckConstraint("CK_VolunteerRegistrations_Status", "[Status] IN ('SUBMITTED','UNDER_REVIEW','APPROVED','WAITLISTED','REJECTED','WITHDRAWN')");
                });

            migrationBuilder.CreateTable(
                name: "Attendances",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RegistrationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ActivityId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CheckInAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CheckOutAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    MarkedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MarkedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Attendances", x => x.Id);
                    table.CheckConstraint("CK_Attendances_Status", "[Status] IN ('PRESENT','LATE','ABSENT','EXCUSED')");
                    table.CheckConstraint("CK_Attendances_TimeRange", "[CheckInAt] IS NULL OR [CheckOutAt] IS NULL OR [CheckInAt] <= [CheckOutAt]");
                    table.ForeignKey(
                        name: "FK_Attendances_VolunteerRegistrations_RegistrationId",
                        column: x => x.RegistrationId,
                        principalTable: "VolunteerRegistrations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RegistrationGroupPreferences",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RegistrationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GroupId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PreferenceRank = table.Column<short>(type: "smallint", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RegistrationGroupPreferences", x => x.Id);
                    table.CheckConstraint("CK_RegistrationGroupPreferences_PreferenceRank", "[PreferenceRank] > 0");
                    table.ForeignKey(
                        name: "FK_RegistrationGroupPreferences_VolunteerRegistrations_RegistrationId",
                        column: x => x.RegistrationId,
                        principalTable: "VolunteerRegistrations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TaskAssignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TaskId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RegistrationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssignedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssignedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    StartedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CompletedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    VolunteerNote = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    ManagerNote = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskAssignments", x => x.Id);
                    table.CheckConstraint("CK_TaskAssignments_Status", "[Status] IN ('ASSIGNED','ACCEPTED','DECLINED','IN_PROGRESS','COMPLETED','CANCELLED')");
                    table.ForeignKey(
                        name: "FK_TaskAssignments_Tasks_TaskId",
                        column: x => x.TaskId,
                        principalTable: "Tasks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TaskAssignments_VolunteerRegistrations_RegistrationId",
                        column: x => x.RegistrationId,
                        principalTable: "VolunteerRegistrations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "VolunteerGroupAssignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RegistrationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CampaignId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GroupId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssignedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssignedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VolunteerGroupAssignments", x => x.Id);
                    table.CheckConstraint("CK_VolunteerGroupAssignments_Status", "[Status] IN ('ACTIVE','REMOVED')");
                    table.ForeignKey(
                        name: "FK_VolunteerGroupAssignments_VolunteerRegistrations_RegistrationId",
                        column: x => x.RegistrationId,
                        principalTable: "VolunteerRegistrations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Attendances_ActivityId_Status",
                table: "Attendances",
                columns: new[] { "ActivityId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Attendances_RegistrationId_ActivityId",
                table: "Attendances",
                columns: new[] { "RegistrationId", "ActivityId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RegistrationGroupPreferences_RegistrationId_GroupId",
                table: "RegistrationGroupPreferences",
                columns: new[] { "RegistrationId", "GroupId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RegistrationGroupPreferences_RegistrationId_PreferenceRank",
                table: "RegistrationGroupPreferences",
                columns: new[] { "RegistrationId", "PreferenceRank" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TaskAssignments_RegistrationId_Status",
                table: "TaskAssignments",
                columns: new[] { "RegistrationId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_TaskAssignments_TaskId_RegistrationId",
                table: "TaskAssignments",
                columns: new[] { "TaskId", "RegistrationId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tasks_CampaignId_ActivityId_GroupId_Status",
                table: "Tasks",
                columns: new[] { "CampaignId", "ActivityId", "GroupId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_VolunteerGroupAssignments_CampaignId_GroupId_Status",
                table: "VolunteerGroupAssignments",
                columns: new[] { "CampaignId", "GroupId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_VolunteerGroupAssignments_RegistrationId_GroupId",
                table: "VolunteerGroupAssignments",
                columns: new[] { "RegistrationId", "GroupId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VolunteerRegistrations_CampaignId_Status_CreatedAt",
                table: "VolunteerRegistrations",
                columns: new[] { "CampaignId", "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_VolunteerRegistrations_UserId_CampaignId",
                table: "VolunteerRegistrations",
                columns: new[] { "UserId", "CampaignId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Attendances");

            migrationBuilder.DropTable(
                name: "RegistrationGroupPreferences");

            migrationBuilder.DropTable(
                name: "TaskAssignments");

            migrationBuilder.DropTable(
                name: "VolunteerGroupAssignments");

            migrationBuilder.DropTable(
                name: "Tasks");

            migrationBuilder.DropTable(
                name: "VolunteerRegistrations");
        }
    }
}
