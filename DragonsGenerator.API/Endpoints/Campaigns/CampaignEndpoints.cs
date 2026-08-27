using System.Text.Json;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;

public record CampaignSummaryDto(Guid Id, string Title, string Role, DateTimeOffset UpdatedAt, int PlayerCount);
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
    List<CampaignMemberDto> Members);
public record UpsertCampaignRequest(string? Title, JsonElement Data);
public record CampaignInviteDto(Guid Id, Guid CampaignId, string CampaignTitle, string InvitedByName, DateTimeOffset CreatedAt);
public record SendCampaignInviteBody(Guid UserId);
public record ProposeCharacterBody(Guid CharacterId);
public record AwardXpBody(Guid MemberId, int Xp);

static file class CampaignAccess
{
    public static async Task<(CampaignRecord? Campaign, CampaignMember? Membership, bool IsOwner)> LoadAsync(
        AppDbContext db, Guid campaignId, Guid userId, CancellationToken ct)
    {
        var campaign = await db.Campaigns
            .Include(c => c.Members).ThenInclude(m => m.User)
            .FirstOrDefaultAsync(c => c.Id == campaignId, ct);
        if (campaign is null) return (null, null, false);

        var isOwner = campaign.OwnerUserId == userId;
        var membership = campaign.Members.FirstOrDefault(m => m.UserId == userId);
        return (campaign, membership, isOwner);
    }

    public static bool CanView(bool isOwner, CampaignMember? membership) =>
        isOwner || membership is not null;

    public static bool CanEdit(bool isOwner, CampaignMember? membership) =>
        isOwner || membership?.Role == CampaignMemberRoles.Dm;
}

public class ListMyCampaignsEndpoint(AppDbContext db) : EndpointWithoutRequest<List<CampaignSummaryDto>>
{
    public override void Configure() => Get("/me/campaigns");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var owned = await db.Campaigns.AsNoTracking()
            .Where(c => c.OwnerUserId == userId)
            .Select(c => new CampaignSummaryDto(
                c.Id, c.Title, CampaignMemberRoles.Dm, c.UpdatedAt,
                c.Members.Count(m => m.Role == CampaignMemberRoles.Player)))
            .ToListAsync(ct);

        var joined = await db.CampaignMembers.AsNoTracking()
            .Where(m => m.UserId == userId && m.Role == CampaignMemberRoles.Player)
            .Include(m => m.Campaign).ThenInclude(c => c.Members)
            .Select(m => new CampaignSummaryDto(
                m.CampaignId,
                m.Campaign.Title,
                CampaignMemberRoles.Player,
                m.Campaign.UpdatedAt,
                m.Campaign.Members.Count(x => x.Role == CampaignMemberRoles.Player)))
            .ToListAsync(ct);

        var all = owned.Concat(joined).OrderByDescending(c => c.UpdatedAt).ToList();
        await Send.OkAsync(all, ct);
    }
}

public class GetMyCampaignEndpoint(AppDbContext db) : EndpointWithoutRequest<CampaignDetailDto>
{
    public override void Configure() => Get("/me/campaigns/{id}");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<Guid>("id");
        var (campaign, membership, isOwner) = await CampaignAccess.LoadAsync(db, id, userId.Value, ct);
        if (campaign is null || !CampaignAccess.CanView(isOwner, membership))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(campaign.JsonData) ? "{}" : campaign.JsonData);
        var role = isOwner ? CampaignMemberRoles.Dm : membership!.Role;

        var members = campaign.Members.Select(m => new CampaignMemberDto(
            m.Id, m.UserId, m.User.DisplayName, m.Role, m.ProposalStatus,
            m.ApprovedCharacterId, m.ApprovedCharacterName, m.ApprovedCharacterLevel,
            m.ProposedCharacterId, m.ProposedCharacterName, m.ProposedCharacterLevel,
            m.XpEarnedInCampaign)).ToList();

        await Send.OkAsync(new CampaignDetailDto(
            campaign.Id, campaign.Title, doc.RootElement.Clone(), role, isOwner, campaign.UpdatedAt, members), ct);
    }
}

public class CreateCampaignEndpoint(AppDbContext db) : Endpoint<UpsertCampaignRequest, CampaignSummaryDto>
{
    public override void Configure() => Post("/me/campaigns");

    public override async Task HandleAsync(UpsertCampaignRequest req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var json = req.Data.ValueKind == JsonValueKind.Undefined ? "{}" : req.Data.GetRawText();
        var title = string.IsNullOrWhiteSpace(req.Title) ? "Nouvelle campagne" : req.Title.Trim();

        var campaign = new CampaignRecord
        {
            OwnerUserId = userId.Value,
            Title = title,
            JsonData = json,
        };
        campaign.Members.Add(new CampaignMember
        {
            UserId = userId.Value,
            Role = CampaignMemberRoles.Dm,
            ProposalStatus = CharacterProposalStatuses.None,
        });

        db.Campaigns.Add(campaign);
        await db.SaveChangesAsync(ct);

        HttpContext.Response.StatusCode = StatusCodes.Status201Created;
        await Send.OkAsync(new CampaignSummaryDto(campaign.Id, campaign.Title, CampaignMemberRoles.Dm, campaign.UpdatedAt, 0), ct);
    }
}

public class UpdateCampaignEndpoint(AppDbContext db) : Endpoint<UpsertCampaignRequest, CampaignSummaryDto>
{
    public override void Configure() => Put("/me/campaigns/{id}");

    public override async Task HandleAsync(UpsertCampaignRequest req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<Guid>("id");
        var (campaign, membership, isOwner) = await CampaignAccess.LoadAsync(db, id, userId.Value, ct);
        if (campaign is null || !CampaignAccess.CanEdit(isOwner, membership))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (!string.IsNullOrWhiteSpace(req.Title))
            campaign.Title = req.Title.Trim();
        if (req.Data.ValueKind != JsonValueKind.Undefined)
            campaign.JsonData = req.Data.GetRawText();
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        var playerCount = campaign.Members.Count(m => m.Role == CampaignMemberRoles.Player);
        await Send.OkAsync(new CampaignSummaryDto(campaign.Id, campaign.Title, CampaignMemberRoles.Dm, campaign.UpdatedAt, playerCount), ct);
    }
}

public class DeleteCampaignEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Delete("/me/campaigns/{id}");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<Guid>("id");
        var campaign = await db.Campaigns.FirstOrDefaultAsync(c => c.Id == id && c.OwnerUserId == userId, ct);
        if (campaign is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        db.Campaigns.Remove(campaign);
        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}

public class ListCampaignInvitesEndpoint(AppDbContext db) : EndpointWithoutRequest<List<CampaignInviteDto>>
{
    public override void Configure() => Get("/me/campaign-invites");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var rows = await (
            from i in db.CampaignInvites.AsNoTracking()
            join c in db.Campaigns.AsNoTracking() on i.CampaignId equals c.Id
            join u in db.Users.AsNoTracking() on i.InvitedByUserId equals u.Id
            where i.InvitedUserId == userId && i.Status == CampaignInviteStatuses.Pending
            select new { i.Id, i.CampaignId, CampaignTitle = c.Title, InvitedByName = u.DisplayName, i.CreatedAt }
        ).ToListAsync(ct);

        var invites = rows
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new CampaignInviteDto(x.Id, x.CampaignId, x.CampaignTitle, x.InvitedByName, x.CreatedAt))
            .ToList();

        await Send.OkAsync(invites, ct);
    }
}

public class SendCampaignInviteEndpoint(AppDbContext db) : Endpoint<SendCampaignInviteBody>
{
    public override void Configure() => Post("/me/campaigns/{id}/invites");

    public override async Task HandleAsync(SendCampaignInviteBody req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var campaignId = Route<Guid>("id");
        var campaign = await db.Campaigns.FirstOrDefaultAsync(c => c.Id == campaignId && c.OwnerUserId == userId, ct);
        if (campaign is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var areFriends = await db.Friendships.AnyAsync(f =>
            f.Status == FriendStatuses.Accepted &&
            ((f.RequesterId == userId && f.AddresseeId == req.UserId) ||
             (f.RequesterId == req.UserId && f.AddresseeId == userId)), ct);
        if (!areFriends)
        {
            AddError("Vous ne pouvez inviter que vos amis.");
            await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
            return;
        }

        var alreadyMember = await db.CampaignMembers.AnyAsync(
            m => m.CampaignId == campaignId && m.UserId == req.UserId, ct);
        if (alreadyMember)
        {
            AddError("Ce joueur fait déjà partie de la campagne.");
            await Send.ErrorsAsync(StatusCodes.Status409Conflict, ct);
            return;
        }

        var pending = await db.CampaignInvites.FirstOrDefaultAsync(
            i => i.CampaignId == campaignId && i.InvitedUserId == req.UserId && i.Status == CampaignInviteStatuses.Pending, ct);
        if (pending is not null)
        {
            AddError("Une invitation est déjà en attente.");
            await Send.ErrorsAsync(StatusCodes.Status409Conflict, ct);
            return;
        }

        db.CampaignInvites.Add(new CampaignInvite
        {
            CampaignId = campaignId,
            InvitedUserId = req.UserId,
            InvitedByUserId = userId.Value,
        });
        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}

public class AcceptCampaignInviteEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Post("/me/campaign-invites/{id}/accept");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<Guid>("id");
        var invite = await db.CampaignInvites
            .Include(i => i.Campaign)
            .FirstOrDefaultAsync(i => i.Id == id && i.InvitedUserId == userId && i.Status == CampaignInviteStatuses.Pending, ct);
        if (invite is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        invite.Status = CampaignInviteStatuses.Accepted;
        db.CampaignMembers.Add(new CampaignMember
        {
            CampaignId = invite.CampaignId,
            UserId = userId.Value,
            Role = CampaignMemberRoles.Player,
            ProposalStatus = CharacterProposalStatuses.None,
        });
        invite.Campaign.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}

public class DeclineCampaignInviteEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Post("/me/campaign-invites/{id}/decline");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<Guid>("id");
        var invite = await db.CampaignInvites.FirstOrDefaultAsync(
            i => i.Id == id && i.InvitedUserId == userId && i.Status == CampaignInviteStatuses.Pending, ct);
        if (invite is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        invite.Status = CampaignInviteStatuses.Declined;
        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}

public class ProposeCharacterEndpoint(AppDbContext db) : Endpoint<ProposeCharacterBody>
{
    public override void Configure() => Post("/me/campaigns/{id}/propose-character");

    public override async Task HandleAsync(ProposeCharacterBody req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var campaignId = Route<Guid>("id");
        var member = await db.CampaignMembers
            .Include(m => m.Campaign)
            .FirstOrDefaultAsync(m => m.CampaignId == campaignId && m.UserId == userId && m.Role == CampaignMemberRoles.Player, ct);
        if (member is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var character = await db.Characters.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == req.CharacterId && c.UserId == userId, ct);
        if (character is null)
        {
            AddError("Personnage introuvable.");
            await Send.ErrorsAsync(StatusCodes.Status404NotFound, ct);
            return;
        }

        int? level = null;
        try
        {
            using var doc = JsonDocument.Parse(character.JsonData);
            if (doc.RootElement.TryGetProperty("level", out var lvl) && lvl.TryGetInt32(out var l))
                level = l;
        }
        catch { /* ignore */ }

        member.ProposedCharacterId = character.Id;
        member.ProposedCharacterName = character.Name;
        member.ProposedCharacterLevel = level;
        member.ProposalStatus = CharacterProposalStatuses.Pending;
        member.Campaign.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}

public class ApproveCharacterProposalEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Post("/me/campaigns/{id}/members/{memberId}/approve");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var campaignId = Route<Guid>("id");
        var memberId = Route<Guid>("memberId");
        var campaign = await db.Campaigns
            .Include(c => c.Members)
            .FirstOrDefaultAsync(c => c.Id == campaignId && c.OwnerUserId == userId, ct);
        if (campaign is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var member = campaign.Members.FirstOrDefault(m => m.Id == memberId);
        if (member is null || member.ProposalStatus != CharacterProposalStatuses.Pending)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        member.ApprovedCharacterId = member.ProposedCharacterId;
        member.ApprovedCharacterName = member.ProposedCharacterName;
        member.ApprovedCharacterLevel = member.ProposedCharacterLevel;
        member.ProposalStatus = CharacterProposalStatuses.Approved;
        member.ProposedCharacterId = null;
        member.ProposedCharacterName = null;
        member.ProposedCharacterLevel = null;
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}

public class RejectCharacterProposalEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Post("/me/campaigns/{id}/members/{memberId}/reject");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var campaignId = Route<Guid>("id");
        var memberId = Route<Guid>("memberId");
        var campaign = await db.Campaigns
            .Include(c => c.Members)
            .FirstOrDefaultAsync(c => c.Id == campaignId && c.OwnerUserId == userId, ct);
        if (campaign is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var member = campaign.Members.FirstOrDefault(m => m.Id == memberId);
        if (member is null || member.ProposalStatus != CharacterProposalStatuses.Pending)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        member.ProposalStatus = CharacterProposalStatuses.Rejected;
        member.ProposedCharacterId = null;
        member.ProposedCharacterName = null;
        member.ProposedCharacterLevel = null;
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}

public class AwardCampaignXpEndpoint(AppDbContext db) : Endpoint<AwardXpBody>
{
    public override void Configure() => Post("/me/campaigns/{id}/award-xp");

    public override async Task HandleAsync(AwardXpBody req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        if (req.Xp <= 0)
        {
            AddError("XP invalide.");
            await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
            return;
        }

        var campaignId = Route<Guid>("id");
        var (campaign, membership, isOwner) = await CampaignAccess.LoadAsync(db, campaignId, userId.Value, ct);
        if (campaign is null || !CampaignAccess.CanEdit(isOwner, membership))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var member = campaign.Members.FirstOrDefault(m => m.Id == req.MemberId);
        if (member is null || member.Role != CampaignMemberRoles.Player)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        member.XpEarnedInCampaign += req.Xp;
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await Send.OkAsync(new { member.XpEarnedInCampaign }, ct);
    }
}
