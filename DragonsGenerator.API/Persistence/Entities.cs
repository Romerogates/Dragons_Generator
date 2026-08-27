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
    public List<CampaignRecord> OwnedCampaigns { get; set; } = [];
    public List<CampaignMember> CampaignMemberships { get; set; } = [];
    public List<Friendship> FriendshipsRequested { get; set; } = [];
    public List<Friendship> FriendshipsReceived { get; set; } = [];
    public List<CampaignInvite> CampaignInvitesReceived { get; set; } = [];
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
    public Guid? CharacterId { get; set; }
    public string? CharacterName { get; set; }
    public string Status { get; set; } = "open"; // open | in_progress | closed
    public string? AdminNotes { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public static class FriendStatuses
{
    public const string Pending = "pending";
    public const string Accepted = "accepted";
    public const string Declined = "declined";
}

public class Friendship
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RequesterId { get; set; }
    public AppUser Requester { get; set; } = null!;
    public Guid AddresseeId { get; set; }
    public AppUser Addressee { get; set; } = null!;
    public string Status { get; set; } = FriendStatuses.Pending;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class CampaignRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OwnerUserId { get; set; }
    public AppUser Owner { get; set; } = null!;
    public string Title { get; set; } = "";
    /// <summary>JSON: setting, adventure, creatures, encounters, notes, tone, partyLevel...</summary>
    public string JsonData { get; set; } = "{}";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public List<CampaignMember> Members { get; set; } = [];
    public List<CampaignInvite> Invites { get; set; } = [];
}

public static class CampaignMemberRoles
{
    public const string Dm = "dm";
    public const string Player = "player";
}

public static class CharacterProposalStatuses
{
    public const string None = "none";
    public const string Pending = "pending";
    public const string Approved = "approved";
    public const string Rejected = "rejected";
}

public class CampaignMember
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CampaignId { get; set; }
    public CampaignRecord Campaign { get; set; } = null!;
    public Guid UserId { get; set; }
    public AppUser User { get; set; } = null!;
    public string Role { get; set; } = CampaignMemberRoles.Player;
    public Guid? ApprovedCharacterId { get; set; }
    public string? ApprovedCharacterName { get; set; }
    public int? ApprovedCharacterLevel { get; set; }
    public Guid? ProposedCharacterId { get; set; }
    public string? ProposedCharacterName { get; set; }
    public int? ProposedCharacterLevel { get; set; }
    public string ProposalStatus { get; set; } = CharacterProposalStatuses.None;
    public int XpEarnedInCampaign { get; set; }
    public DateTimeOffset JoinedAt { get; set; } = DateTimeOffset.UtcNow;
}

public static class CampaignInviteStatuses
{
    public const string Pending = "pending";
    public const string Accepted = "accepted";
    public const string Declined = "declined";
}

public class CampaignInvite
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CampaignId { get; set; }
    public CampaignRecord Campaign { get; set; } = null!;
    public Guid InvitedUserId { get; set; }
    public AppUser InvitedUser { get; set; } = null!;
    public Guid InvitedByUserId { get; set; }
    public string Status { get; set; } = CampaignInviteStatuses.Pending;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
