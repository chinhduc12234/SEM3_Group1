using CampaignService.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
namespace CampaignService.Data.Migrations;

[DbContext(typeof(CampaignDb))]
[Migration("20261108150000_CampaignMediaStoragePath")]
public sealed class CampaignMediaStoragePath : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.AddColumn<string>(name: "StoragePath", table: "Media", type: "nvarchar(200)", maxLength: 200, nullable: true);
    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropColumn(name: "StoragePath", table: "Media");
}
