using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace VolunteerService.Data;

public sealed class VolunteerRegistration
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid CampaignId { get; set; }
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
    public string PhoneNumber { get; set; } = "";
    public DateOnly? DateOfBirth { get; set; }
    public string? Occupation { get; set; }
    public string? HealthNote { get; set; }
    public string? Skills { get; set; }
    public string? Experience { get; set; }
    public string? Motivation { get; set; }
    public string? EmergencyContactName { get; set; }
    public string? EmergencyContactPhone { get; set; }
    public bool CommitsToAllDays { get; set; }
    public bool AgreedToTerms { get; set; }
    public DateTimeOffset? TermsAgreedAt { get; set; }
    public string Status { get; set; } = "SUBMITTED";
    public Guid? ReviewedBy { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }
    public string? ReviewNote { get; set; }
    public string? RejectionReason { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public List<RegistrationGroupPreference> GroupPreferences { get; set; } = [];
    public List<VolunteerGroupAssignment> GroupAssignments { get; set; } = [];
    public List<TaskAssignment> TaskAssignments { get; set; } = [];
    public List<VolunteerAttendance> Attendances { get; set; } = [];
}

// GroupId is a logical reference to a group in CampaignService's operations plan.
public sealed class RegistrationGroupPreference
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RegistrationId { get; set; }
    public Guid GroupId { get; set; }
    public short PreferenceRank { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

// GroupId and CampaignId are logical references owned by CampaignService.
public sealed class VolunteerGroupAssignment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RegistrationId { get; set; }
    public Guid CampaignId { get; set; }
    public Guid GroupId { get; set; }
    public Guid AssignedBy { get; set; }
    public DateTimeOffset AssignedAt { get; set; } = DateTimeOffset.UtcNow;
    public string Status { get; set; } = "ACTIVE";
}

// ActivityId and GroupId reference the authoritative schedule and groups in CampaignService.
public sealed class VolunteerTask
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CampaignId { get; set; }
    public Guid ActivityId { get; set; }
    public Guid GroupId { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public TimeOnly? StartTime { get; set; }
    public TimeOnly? EndTime { get; set; }
    public int RequiredVolunteers { get; set; }
    public string Priority { get; set; } = "MEDIUM";
    public string Status { get; set; } = "OPEN";
    public string? Note { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public List<TaskAssignment> Assignments { get; set; } = [];
}

public sealed class TaskAssignment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TaskId { get; set; }
    public Guid RegistrationId { get; set; }
    public Guid AssignedBy { get; set; }
    public DateTimeOffset AssignedAt { get; set; } = DateTimeOffset.UtcNow;
    public string Status { get; set; } = "ASSIGNED";
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public string? VolunteerNote { get; set; }
    public string? ManagerNote { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public VolunteerTask Task { get; set; } = null!;
    public VolunteerRegistration Registration { get; set; } = null!;
}

// ActivityId is a logical reference to an activity in CampaignService.
public sealed class VolunteerAttendance
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RegistrationId { get; set; }
    public Guid ActivityId { get; set; }
    public DateTimeOffset? CheckInAt { get; set; }
    public DateTimeOffset? CheckOutAt { get; set; }
    public string Status { get; set; } = "PRESENT";
    public string? Note { get; set; }
    public Guid MarkedBy { get; set; }
    public DateTimeOffset MarkedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class VolunteerDb(DbContextOptions<VolunteerDb> options) : DbContext(options)
{
    public DbSet<VolunteerRegistration> Registrations => Set<VolunteerRegistration>();
    public DbSet<RegistrationGroupPreference> RegistrationGroupPreferences => Set<RegistrationGroupPreference>();
    public DbSet<VolunteerGroupAssignment> GroupAssignments => Set<VolunteerGroupAssignment>();
    public DbSet<VolunteerTask> Tasks => Set<VolunteerTask>();
    public DbSet<TaskAssignment> TaskAssignments => Set<TaskAssignment>();
    public DbSet<VolunteerAttendance> Attendances => Set<VolunteerAttendance>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        var registration = b.Entity<VolunteerRegistration>();
        registration.ToTable("VolunteerRegistrations", t => t.HasCheckConstraint(
            "CK_VolunteerRegistrations_Status", "[Status] IN ('SUBMITTED','UNDER_REVIEW','APPROVED','WAITLISTED','REJECTED','WITHDRAWN')"));
        registration.Property(x => x.FullName).HasMaxLength(200);
        registration.Property(x => x.Email).HasMaxLength(320);
        registration.Property(x => x.PhoneNumber).HasMaxLength(30);
        registration.Property(x => x.Occupation).HasMaxLength(200);
        registration.Property(x => x.HealthNote).HasMaxLength(1000);
        registration.Property(x => x.Skills).HasMaxLength(2000);
        registration.Property(x => x.Experience).HasMaxLength(3000);
        registration.Property(x => x.Motivation).HasMaxLength(3000);
        registration.Property(x => x.EmergencyContactName).HasMaxLength(200);
        registration.Property(x => x.EmergencyContactPhone).HasMaxLength(30);
        registration.Property(x => x.Status).HasMaxLength(20);
        registration.Property(x => x.ReviewNote).HasMaxLength(2000);
        registration.Property(x => x.RejectionReason).HasMaxLength(2000);
        registration.HasIndex(x => new { x.UserId, x.CampaignId }).IsUnique();
        registration.HasIndex(x => new { x.CampaignId, x.Status, x.CreatedAt });

        var preference = b.Entity<RegistrationGroupPreference>();
        preference.ToTable("RegistrationGroupPreferences", t => t.HasCheckConstraint(
            "CK_RegistrationGroupPreferences_PreferenceRank", "[PreferenceRank] > 0"));
        preference.HasOne<VolunteerRegistration>().WithMany(x => x.GroupPreferences)
            .HasForeignKey(x => x.RegistrationId).OnDelete(DeleteBehavior.Restrict);
        preference.HasIndex(x => new { x.RegistrationId, x.GroupId }).IsUnique();
        preference.HasIndex(x => new { x.RegistrationId, x.PreferenceRank }).IsUnique();

        var groupAssignment = b.Entity<VolunteerGroupAssignment>();
        groupAssignment.ToTable("VolunteerGroupAssignments", t => t.HasCheckConstraint(
            "CK_VolunteerGroupAssignments_Status", "[Status] IN ('ACTIVE','REMOVED')"));
        groupAssignment.Property(x => x.Status).HasMaxLength(20);
        groupAssignment.HasOne<VolunteerRegistration>().WithMany(x => x.GroupAssignments)
            .HasForeignKey(x => x.RegistrationId).OnDelete(DeleteBehavior.Restrict);
        groupAssignment.HasIndex(x => new { x.RegistrationId, x.GroupId }).IsUnique();
        groupAssignment.HasIndex(x => new { x.CampaignId, x.GroupId, x.Status });

        var task = b.Entity<VolunteerTask>();
        task.ToTable("Tasks", t =>
        {
            t.HasCheckConstraint("CK_Tasks_RequiredVolunteers", "[RequiredVolunteers] > 0");
            t.HasCheckConstraint("CK_Tasks_Priority", "[Priority] IN ('LOW','MEDIUM','HIGH','URGENT')");
            t.HasCheckConstraint("CK_Tasks_Status", "[Status] IN ('DRAFT','OPEN','IN_PROGRESS','COMPLETED','CANCELLED')");
            t.HasCheckConstraint("CK_Tasks_TimeRange", "[StartTime] IS NULL OR [EndTime] IS NULL OR [StartTime] < [EndTime]");
        });
        task.Property(x => x.Name).HasMaxLength(255);
        task.Property(x => x.Description).HasMaxLength(4000);
        task.Property(x => x.Priority).HasMaxLength(20);
        task.Property(x => x.Status).HasMaxLength(20);
        task.Property(x => x.Note).HasMaxLength(2000);
        task.HasIndex(x => new { x.CampaignId, x.ActivityId, x.GroupId, x.Status });

        var taskAssignment = b.Entity<TaskAssignment>();
        taskAssignment.ToTable("TaskAssignments", t => t.HasCheckConstraint(
            "CK_TaskAssignments_Status", "[Status] IN ('ASSIGNED','ACCEPTED','DECLINED','IN_PROGRESS','COMPLETED','CANCELLED')"));
        taskAssignment.Property(x => x.Status).HasMaxLength(20);
        taskAssignment.Property(x => x.VolunteerNote).HasMaxLength(2000);
        taskAssignment.Property(x => x.ManagerNote).HasMaxLength(2000);
        taskAssignment.HasOne(x => x.Task).WithMany(x => x.Assignments)
            .HasForeignKey(x => x.TaskId).OnDelete(DeleteBehavior.Restrict);
        taskAssignment.HasOne(x => x.Registration).WithMany(x => x.TaskAssignments)
            .HasForeignKey(x => x.RegistrationId).OnDelete(DeleteBehavior.Restrict);
        taskAssignment.HasIndex(x => new { x.TaskId, x.RegistrationId }).IsUnique();
        taskAssignment.HasIndex(x => new { x.RegistrationId, x.Status });

        var attendance = b.Entity<VolunteerAttendance>();
        attendance.ToTable("Attendances", t =>
        {
            t.HasCheckConstraint("CK_Attendances_Status", "[Status] IN ('PRESENT','LATE','ABSENT','EXCUSED')");
            t.HasCheckConstraint("CK_Attendances_TimeRange", "[CheckInAt] IS NULL OR [CheckOutAt] IS NULL OR [CheckInAt] <= [CheckOutAt]");
        });
        attendance.Property(x => x.Status).HasMaxLength(20);
        attendance.Property(x => x.Note).HasMaxLength(2000);
        attendance.HasOne<VolunteerRegistration>().WithMany(x => x.Attendances)
            .HasForeignKey(x => x.RegistrationId).OnDelete(DeleteBehavior.Restrict);
        attendance.HasIndex(x => new { x.RegistrationId, x.ActivityId }).IsUnique();
        attendance.HasIndex(x => new { x.ActivityId, x.Status });
    }
}

public sealed class VolunteerDbFactory : IDesignTimeDbContextFactory<VolunteerDb>
{
    public VolunteerDb CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<VolunteerDb>()
        .UseSqlServer("Server=localhost;Database=GiveAid_Volunteer;Integrated Security=True;TrustServerCertificate=True").Options);
}
