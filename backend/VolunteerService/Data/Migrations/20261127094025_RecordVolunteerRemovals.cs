using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VolunteerService.Data.Migrations
{
    /// <inheritdoc />
    public partial class RecordVolunteerRemovals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "RemovedByCoordinatorAt",
                table: "VolunteerRegistrations",
                type: "datetimeoffset",
                nullable: true);

            // Recover coordinator removals made before we recorded a dedicated timestamp.
            migrationBuilder.Sql("""
                UPDATE [VolunteerRegistrations]
                SET [RemovedByCoordinatorAt] = [ReviewedAt]
                WHERE [Status] = N'WITHDRAWN' AND [ReviewedBy] IS NOT NULL AND [ReviewedAt] IS NOT NULL
                    AND [ReviewNote] = N'Điều phối viên đã xóa hồ sơ tình nguyện khỏi chiến dịch.';

                INSERT INTO [VolunteerNotificationOutbox]
                    ([Id], [RegistrationId], [Payload], [CreatedAt], [NextAttemptAt], [Attempts])
                SELECT r.[Id], r.[Id],
                    (SELECT r.[Id] AS [EventId], r.[CampaignId], r.[Id] AS [RegistrationId], r.[FullName] AS [VolunteerName],
                        r.[RemovedByCoordinatorAt] AS [SubmittedAt], r.[UserId] AS [RecipientUserId], N'REMOVED' AS [Outcome]
                     FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
                    r.[RemovedByCoordinatorAt], SYSUTCDATETIME(), 0
                FROM [VolunteerRegistrations] r
                WHERE r.[RemovedByCoordinatorAt] IS NOT NULL
                    AND NOT EXISTS (SELECT 1 FROM [VolunteerNotificationOutbox] o WHERE o.[Id] = r.[Id]);
                """);

            migrationBuilder.CreateIndex(
                name: "IX_VolunteerRegistrations_UserId_RemovedByCoordinatorAt",
                table: "VolunteerRegistrations",
                columns: new[] { "UserId", "RemovedByCoordinatorAt" },
                filter: "[RemovedByCoordinatorAt] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_VolunteerRegistrations_UserId_RemovedByCoordinatorAt",
                table: "VolunteerRegistrations");

            migrationBuilder.DropColumn(
                name: "RemovedByCoordinatorAt",
                table: "VolunteerRegistrations");
        }
    }
}
