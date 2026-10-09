namespace DragonsGenerator.API.Services;

public static partial class CampaignJsonHelpers
{
}

public sealed record SessionChangeInfo(
    bool Changed,
    bool IsNewSession,
    string? Title,
    string? ScheduledAt,
    string? Location,
    string Message)
{
    public static SessionChangeInfo None { get; } = new(false, false, null, null, null, "");
}

public sealed record HandoutChangeInfo(
    bool Changed,
    string? Title,
    string? HandoutId,
    int Count,
    string Message)
{
    public static HandoutChangeInfo None { get; } = new(false, null, null, 0, "");
}

public sealed record InitiativeCollectionChangeInfo(
    bool Changed,
    string? Code,
    string? Label,
    string Message)
{
    public static InitiativeCollectionChangeInfo None { get; } = new(false, null, null, "");
}

public sealed record CombatEndedChangeInfo(
    bool Changed,
    string? SessionId,
    string? HistoryId,
    string? Label,
    int? Round,
    string Message)
{
    public static CombatEndedChangeInfo None { get; } = new(false, null, null, null, null, "");
}

public sealed record InitiativeBoardInfo(
    bool Open,
    string Code,
    string? Label,
    IReadOnlyList<InitiativeCombatantInfo> Combatants);

public sealed record InitiativeCombatantInfo(
    string Id,
    string Name,
    string Kind,
    int InitiativeBonus,
    bool HasRoll,
    string? MemberUserId);

public sealed record PlannedSessionInfo(
    string Id,
    string Title,
    DateTimeOffset ScheduledAt,
    string? Location);

/// <summary>Événement d’agenda agrégé (sessions + dates libres) pour une campagne.</summary>
public sealed record CampaignAgendaEventInfo(
    string Id,
    Guid CampaignId,
    string CampaignTitle,
    string Source,
    string Title,
    DateTimeOffset StartsAt,
    DateTimeOffset? EndsAt,
    bool AllDay,
    string? Kind,
    string? Status,
    string? Location,
    int RsvpYes = 0,
    int RsvpNo = 0,
    int RsvpMaybe = 0);
