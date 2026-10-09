using System.Text.Json;
using DragonsGenerator.API.Services;

namespace DragonsGenerator.API.Endpoints.Campaigns;

public record CampaignSummaryDto(
    Guid Id,
    string Title,
    string Role,
    DateTimeOffset UpdatedAt,
    int PlayerCount,
    string? RegionName,
    bool IsArchived = false,
    bool IsClosed = false,
    bool IsHistory = false,
    string MembershipStatus = CampaignMembershipStatuses.Active,
    bool HasPlayerHistory = false);
public record CampaignMemberDto(
    Guid Id,
    Guid UserId,
    string DisplayName,
    string Role,
    string ProposalStatus,
    Guid? ApprovedCharacterId,
    string? ApprovedCharacterName,
    int? ApprovedCharacterLevel,
    Guid? ProposedCharacterId,
    string? ProposedCharacterName,
    int? ProposedCharacterLevel,
    int XpEarnedInCampaign);
public record CampaignDetailDto(
    Guid Id,
    string Title,
    JsonElement Data,
    string Role,
    bool IsOwner,
    DateTimeOffset UpdatedAt,
    List<CampaignMemberDto> Members,
    bool IsArchived = false,
    bool IsClosed = false,
    bool IsHistory = false,
    string MembershipStatus = CampaignMembershipStatuses.Active,
    bool HasPlayerHistory = false);
public record UpsertCampaignRequest(string? Title, JsonElement Data);
public record CampaignInviteDto(Guid Id, Guid CampaignId, string CampaignTitle, string InvitedByName, DateTimeOffset CreatedAt);
public record SendCampaignInviteBody(Guid UserId);
public record ProposeCharacterBody(Guid CharacterId);
public record AwardXpBody(Guid MemberId, int Xp);

public record SetCampaignArchivedRequest(bool Archived);

public record CampaignPendingInviteDto(Guid Id, Guid UserId, string DisplayName, DateTimeOffset CreatedAt);

public record AssignPregenBody(Guid UserId, string DisplayName);

