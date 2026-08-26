namespace DragonsGenerator.API.Persistence;

public static class AppRoles
{
    public const string User = "User";
    public const string Admin = "Admin";
}

public class AppUser
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Email { get; set; }
    public required string PasswordHash { get; set; }
    public string DisplayName { get; set; } = "";
    public string Role { get; set; } = AppRoles.User;
    public bool EmailConfirmed { get; set; }
    public string? EmailConfirmToken { get; set; }
    public string? PasswordResetToken { get; set; }
    public DateTimeOffset? PasswordResetExpires { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? LastLoginAt { get; set; }

    public List<CharacterRecord> Characters { get; set; } = [];
    public List<SupportTicket> SupportTickets { get; set; } = [];
}

public class CharacterRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public AppUser User { get; set; } = null!;
    public string Name { get; set; } = "";
    /// <summary>JSON complet du personnage (fiche).</summary>
    public string JsonData { get; set; } = "{}";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class SupportTicket
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public AppUser User { get; set; } = null!;
    public required string Subject { get; set; }
    public required string Message { get; set; }
    public string? AttachmentStoredName { get; set; }
    public string? AttachmentOriginalName { get; set; }
    public string Status { get; set; } = "open"; // open | in_progress | closed
    public string? AdminNotes { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
