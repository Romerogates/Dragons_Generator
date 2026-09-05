using System.Text.Json;
using System.Text.Json.Nodes;
using DragonsGenerator.API.Endpoints.Characters;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;

public record CampaignSummaryDto(
    Guid Id,
    string Title,
    string Role,
    DateTimeOffset UpdatedAt,
    int PlayerCount,
    string? RegionName);
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

        var ownedRows = await db.Campaigns.AsNoTracking()
            .Where(c => c.OwnerUserId == userId)
            .Select(c => new
            {
                c.Id,
                c.Title,
                c.UpdatedAt,
                c.JsonData,
                PlayerCount = c.Members.Count(m => m.Role == CampaignMemberRoles.Player),
            })
            .ToListAsync(ct);

        var owned = ownedRows
            .Select(c => new CampaignSummaryDto(
                c.Id,
                c.Title,
                CampaignMemberRoles.Dm,
                c.UpdatedAt,
                c.PlayerCount,
                CampaignJsonHelpers.RegionNameFromJson(c.JsonData)))
            .ToList();

        var joinedRows = await db.CampaignMembers.AsNoTracking()
            .Where(m => m.UserId == userId && m.Role == CampaignMemberRoles.Player)
            .Select(m => new
            {
                m.CampaignId,
                m.Campaign.Title,
                m.Campaign.UpdatedAt,
                m.Campaign.JsonData,
                PlayerCount = m.Campaign.Members.Count(x => x.Role == CampaignMemberRoles.Player),
            })
            .ToListAsync(ct);

        var joined = joinedRows
            .Select(m => new CampaignSummaryDto(
                m.CampaignId,
                m.Title,
                CampaignMemberRoles.Player,
                m.UpdatedAt,
                m.PlayerCount,
                CampaignJsonHelpers.RegionNameFromJson(m.JsonData)))
            .ToList();

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
        var data = isOwner
            ? doc.RootElement.Clone()
            : CampaignJsonHelpers.FilterForPlayerView(doc.RootElement, userId.Value);

        var membersNeedingLevel = campaign.Members
            .Where(m =>
                (m.ApprovedCharacterId is not null && m.ApprovedCharacterLevel is null)
                || (m.ProposedCharacterId is not null && m.ProposedCharacterLevel is null))
            .ToList();
        if (membersNeedingLevel.Count > 0)
        {
            var charIds = membersNeedingLevel
                .SelectMany(m => new Guid?[] { m.ApprovedCharacterId, m.ProposedCharacterId })
                .Where(id => id is not null)
                .Select(id => id!.Value)
                .Distinct()
                .ToList();
            var chars = await db.Characters.AsNoTracking()
                .Where(c => charIds.Contains(c.Id))
                .Select(c => new { c.Id, c.JsonData })
                .ToListAsync(ct);
            var levelById = chars.ToDictionary(
                c => c.Id,
                c => CampaignJsonHelpers.LevelFromCharacterJson(c.JsonData));

            var dirty = false;
            foreach (var m in membersNeedingLevel)
            {
                if (m.ApprovedCharacterId is Guid aid
                    && m.ApprovedCharacterLevel is null
                    && levelById.TryGetValue(aid, out var aLvl)
                    && aLvl is not null)
                {
                    m.ApprovedCharacterLevel = aLvl;
                    dirty = true;
                }
                if (m.ProposedCharacterId is Guid pid
                    && m.ProposedCharacterLevel is null
                    && levelById.TryGetValue(pid, out var pLvl)
                    && pLvl is not null)
                {
                    m.ProposedCharacterLevel = pLvl;
                    dirty = true;
                }
            }
            if (dirty)
                await db.SaveChangesAsync(ct);
        }

        var members = campaign.Members.Select(m => new CampaignMemberDto(
            m.Id, m.UserId, m.User.DisplayName, m.Role, m.ProposalStatus,
            m.ApprovedCharacterId, m.ApprovedCharacterName, m.ApprovedCharacterLevel,
            m.ProposedCharacterId, m.ProposedCharacterName, m.ProposedCharacterLevel,
            m.XpEarnedInCampaign)).ToList();

        await Send.OkAsync(new CampaignDetailDto(
            campaign.Id, campaign.Title, data, role, isOwner, campaign.UpdatedAt, members), ct);
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
        await Send.OkAsync(new CampaignSummaryDto(
            campaign.Id,
            campaign.Title,
            CampaignMemberRoles.Dm,
            campaign.UpdatedAt,
            0,
            CampaignJsonHelpers.RegionNameFromJson(json)), ct);
    }
}

public class UpdateCampaignEndpoint(AppDbContext db, PushNotificationService push) : Endpoint<UpsertCampaignRequest, CampaignSummaryDto>
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

        SessionChangeInfo? sessionChange = null;
        HandoutChangeInfo? handoutChange = null;
        InitiativeCollectionChangeInfo? initiativeChange = null;
        if (!string.IsNullOrWhiteSpace(req.Title))
            campaign.Title = req.Title.Trim();
        if (req.Data.ValueKind != JsonValueKind.Undefined)
        {
            var merged = CampaignJsonHelpers.StripDmOnlyFieldsFromUpdate(req.Data, campaign.JsonData, isOwner);
            var incomingRaw = merged.GetRawText();
            var newJson = CampaignJsonHelpers.MergeLiveCombatIntoIncoming(incomingRaw, campaign.JsonData);
            if (isOwner)
            {
                var change = CampaignJsonHelpers.AnalyzeSessionChanges(campaign.JsonData, newJson);
                if (change.Changed)
                {
                    sessionChange = change;
                    var kind = change.IsNewSession
                        ? CampaignActivityKinds.SessionScheduled
                        : CampaignActivityKinds.SessionUpdated;
                    await CampaignActivityService.LogAsync(
                        db, campaign.Id, userId.Value, kind,
                        new
                        {
                            message = change.Message,
                            title = change.Title,
                            scheduledAt = change.ScheduledAt,
                            location = change.Location,
                        }, ct);
                }

                var handout = CampaignJsonHelpers.AnalyzeHandoutChanges(campaign.JsonData, newJson);
                if (handout.Changed)
                {
                    handoutChange = handout;
                    await CampaignActivityService.LogAsync(
                        db, campaign.Id, userId.Value, CampaignActivityKinds.HandoutPublished,
                        new
                        {
                            message = handout.Message,
                            title = handout.Title,
                            handoutId = handout.HandoutId,
                            count = handout.Count,
                        }, ct);
                }

                var initiative = CampaignJsonHelpers.AnalyzeInitiativeCollectionOpened(campaign.JsonData, newJson);
                if (initiative.Changed)
                {
                    initiativeChange = initiative;
                    await CampaignActivityService.LogAsync(
                        db, campaign.Id, userId.Value, CampaignActivityKinds.InitiativeCollectionOpened,
                        new
                        {
                            message = initiative.Message,
                            code = initiative.Code,
                            label = initiative.Label,
                        }, ct);
                }
            }
            campaign.JsonData = newJson;
        }
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        for (var attempt = 0; ; attempt++)
        {
            try
            {
                await db.SaveChangesAsync(ct);
                break;
            }
            catch (DbUpdateConcurrencyException) when (attempt < 2)
            {
                foreach (var entry in db.ChangeTracker.Entries())
                    await entry.ReloadAsync(ct);
                if (req.Data.ValueKind != JsonValueKind.Undefined)
                {
                    var incomingRaw = req.Data.GetRawText();
                    var replay = CampaignJsonHelpers.StripDmOnlyFieldsFromUpdate(req.Data, campaign.JsonData, isOwner);
                    campaign.JsonData = CampaignJsonHelpers.MergeLiveCombatIntoIncoming(
                        replay.GetRawText(), campaign.JsonData);
                }
                campaign.UpdatedAt = DateTimeOffset.UtcNow;
            }
        }

        if (sessionChange is not null)
        {
            var url = $"/campaigns/{campaign.Id}";
            var pushTitle = sessionChange.IsNewSession ? "Session planifiée" : "Session mise à jour";
            var playerIds = campaign.Members
                .Where(m => m.Role == CampaignMemberRoles.Player)
                .Select(m => m.UserId)
                .Distinct()
                .ToList();
            foreach (var playerId in playerIds)
            {
                await push.NotifyUserAsync(playerId, pushTitle, sessionChange.Message, url, ct);
            }
        }

        if (handoutChange is not null)
        {
            var url = string.IsNullOrWhiteSpace(handoutChange.HandoutId)
                ? $"/campaigns/{campaign.Id}?tab=handouts"
                : $"/campaigns/{campaign.Id}?tab=handouts&handout={handoutChange.HandoutId}";
            var playerIds = campaign.Members
                .Where(m => m.Role == CampaignMemberRoles.Player)
                .Select(m => m.UserId)
                .Distinct()
                .ToList();
            foreach (var playerId in playerIds)
            {
                await push.NotifyUserAsync(
                    playerId,
                    "Nouveau document",
                    handoutChange.Message,
                    url,
                    ct);
            }
        }

        if (initiativeChange is not null)
        {
            var code = initiativeChange.Code ?? "";
            var url = $"/campaigns/{campaign.Id}/init?code={Uri.EscapeDataString(code)}";
            var playerIds = campaign.Members
                .Where(m => m.Role == CampaignMemberRoles.Player)
                .Select(m => m.UserId)
                .Distinct()
                .ToList();
            foreach (var playerId in playerIds)
            {
                await push.NotifyUserAsync(
                    playerId,
                    "Initiative — saisir votre jet",
                    initiativeChange.Message,
                    url,
                    ct);
            }
        }

        var playerCount = campaign.Members.Count(m => m.Role == CampaignMemberRoles.Player);
        await Send.OkAsync(new CampaignSummaryDto(
            campaign.Id,
            campaign.Title,
            CampaignMemberRoles.Dm,
            campaign.UpdatedAt,
            playerCount,
            CampaignJsonHelpers.RegionNameFromJson(campaign.JsonData)), ct);
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

public class SendCampaignInviteEndpoint(AppDbContext db, PushNotificationService push) : Endpoint<SendCampaignInviteBody>
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

        var inviter = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId, ct);
        await CampaignActivityService.LogAsync(
            db, campaignId, userId.Value, CampaignActivityKinds.InviteSent,
            new { userId = req.UserId, campaignTitle = campaign.Title }, ct);
        await push.NotifyUserAsync(
            req.UserId,
            "Invitation campagne",
            $"{inviter.DisplayName} vous invite à « {campaign.Title} »",
            "/friends",
            ct);

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

        var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId, ct);
        await CampaignActivityService.LogAsync(
            db, invite.CampaignId, userId.Value, CampaignActivityKinds.InviteAccepted,
            new { displayName = user.DisplayName, campaignTitle = invite.Campaign.Title }, ct);

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

public class ProposeCharacterEndpoint(AppDbContext db, PushNotificationService push) : Endpoint<ProposeCharacterBody>
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

        var level = CampaignJsonHelpers.LevelFromCharacterJson(character.JsonData);

        member.ProposedCharacterId = character.Id;
        member.ProposedCharacterName = character.Name;
        member.ProposedCharacterLevel = level;
        member.ProposalStatus = CharacterProposalStatuses.Pending;
        member.Campaign.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        var proposer = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId, ct);
        var message = $"{proposer.DisplayName} propose {character.Name} dans « {member.Campaign.Title} »";
        await CampaignActivityService.LogAsync(
            db,
            campaignId,
            userId.Value,
            CampaignActivityKinds.CharacterProposed,
            new
            {
                characterId = character.Id,
                characterName = character.Name,
                level,
                displayName = proposer.DisplayName,
                memberUserId = userId.Value,
                message,
            },
            ct);
        await push.NotifyUserAsync(
            member.Campaign.OwnerUserId,
            "Personnage à valider",
            message,
            $"/campaigns/{campaignId}?tab=players",
            ct);

        await Send.NoContentAsync(ct);
    }
}

public class ApproveCharacterProposalEndpoint(AppDbContext db, PushNotificationService push) : EndpointWithoutRequest
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

        var characterId = member.ProposedCharacterId;
        var characterName = member.ProposedCharacterName ?? "votre personnage";
        var playerUserId = member.UserId;

        member.ApprovedCharacterId = member.ProposedCharacterId;
        member.ApprovedCharacterName = member.ProposedCharacterName;
        member.ApprovedCharacterLevel = member.ProposedCharacterLevel;
        member.ProposalStatus = CharacterProposalStatuses.Approved;
        member.ProposedCharacterId = null;
        member.ProposedCharacterName = null;
        member.ProposedCharacterLevel = null;
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        var player = await db.Users.AsNoTracking().FirstAsync(u => u.Id == playerUserId, ct);
        var message = $"{characterName} est accepté dans « {campaign.Title} »";
        await CampaignActivityService.LogAsync(
            db,
            campaignId,
            userId.Value,
            CampaignActivityKinds.CharacterApproved,
            new
            {
                characterId,
                characterName,
                displayName = player.DisplayName,
                memberUserId = playerUserId,
                message,
            },
            ct);
        await push.NotifyUserAsync(
            playerUserId,
            "Personnage approuvé",
            message,
            $"/campaigns/{campaignId}",
            ct);

        await Send.NoContentAsync(ct);
    }
}

public class RejectCharacterProposalEndpoint(AppDbContext db, PushNotificationService push) : EndpointWithoutRequest
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

        var characterId = member.ProposedCharacterId;
        var characterName = member.ProposedCharacterName ?? "votre personnage";
        var playerUserId = member.UserId;

        member.ProposalStatus = CharacterProposalStatuses.Rejected;
        member.ProposedCharacterId = null;
        member.ProposedCharacterName = null;
        member.ProposedCharacterLevel = null;
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        var player = await db.Users.AsNoTracking().FirstAsync(u => u.Id == playerUserId, ct);
        var message = $"{characterName} a été refusé dans « {campaign.Title} » — proposez-en un autre";
        await CampaignActivityService.LogAsync(
            db,
            campaignId,
            userId.Value,
            CampaignActivityKinds.CharacterRejected,
            new
            {
                characterId,
                characterName,
                displayName = player.DisplayName,
                memberUserId = playerUserId,
                message,
            },
            ct);
        await push.NotifyUserAsync(
            playerUserId,
            "Personnage refusé",
            message,
            $"/campaigns/{campaignId}?tab=players",
            ct);

        await Send.NoContentAsync(ct);
    }
}

public class RequestCharacterPickEndpoint(AppDbContext db, PushNotificationService push) : EndpointWithoutRequest
{
    public override void Configure() => Post("/me/campaigns/{id}/members/{memberId}/request-character");

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
            .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(c => c.Id == campaignId && c.OwnerUserId == userId, ct);
        if (campaign is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var member = campaign.Members.FirstOrDefault(m => m.Id == memberId);
        if (member is null
            || member.Role != CampaignMemberRoles.Player
            || member.ApprovedCharacterId is not null
            || member.ProposalStatus == CharacterProposalStatuses.Pending)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var playerUserId = member.UserId;
        var displayName = member.User?.DisplayName ?? "Joueur";
        var message =
            $"Le MJ de « {campaign.Title} » vous invite à choisir un personnage existant ou à en créer un pour la table.";
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        await CampaignActivityService.LogAsync(
            db,
            campaignId,
            userId.Value,
            CampaignActivityKinds.CharacterPickRequested,
            new
            {
                displayName,
                memberUserId = playerUserId,
                campaignTitle = campaign.Title,
                message,
            },
            ct);
        await push.NotifyUserAsync(
            playerUserId,
            "Choisissez votre personnage",
            message,
            $"/campaigns/{campaignId}?tab=players",
            ct);

        await Send.NoContentAsync(ct);
    }
}

public class RemoveCampaignMemberEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Delete("/me/campaigns/{id}/members/{memberId}");

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
            .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(c => c.Id == campaignId && c.OwnerUserId == userId, ct);
        if (campaign is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var member = campaign.Members.FirstOrDefault(m => m.Id == memberId);
        if (member is null || member.Role != CampaignMemberRoles.Player)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var displayName = member.User?.DisplayName ?? "Joueur";
        var removedUserId = member.UserId;

        var data = CampaignPregenHelpers.ParseDataObject(campaign.JsonData);
        if (data["pregenCharacters"] is JsonArray pregenArr)
        {
            var userIdStr = removedUserId.ToString();
            foreach (var node in pregenArr)
            {
                if (node is not JsonObject obj) continue;
                if (obj["assignedUserId"]?.GetValue<string>() != userIdStr) continue;
                obj.Remove("assignedUserId");
                obj.Remove("assignedDisplayName");
                obj["status"] = "ready";
            }

            campaign.JsonData = data.ToJsonString();
        }

        db.CampaignMembers.Remove(member);
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        await CampaignActivityService.LogAsync(
            db,
            campaignId,
            userId.Value,
            CampaignActivityKinds.MemberRemoved,
            new { displayName, userId = removedUserId },
            ct);

        await Send.NoContentAsync(ct);
    }
}

public class LeaveCampaignEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Delete("/me/campaigns/{id}/leave");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var campaignId = Route<Guid>("id");
        var campaign = await db.Campaigns
            .Include(c => c.Members)
            .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(c => c.Id == campaignId, ct);
        if (campaign is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (campaign.OwnerUserId == userId)
        {
            AddError("Le MJ ne peut pas quitter sa propre campagne. Supprimez-la si besoin.");
            await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
            return;
        }

        var member = campaign.Members.FirstOrDefault(
            m => m.UserId == userId && m.Role == CampaignMemberRoles.Player);
        if (member is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var displayName = member.User?.DisplayName ?? "Joueur";

        var data = CampaignPregenHelpers.ParseDataObject(campaign.JsonData);
        if (data["pregenCharacters"] is JsonArray pregenArr)
        {
            var userIdStr = userId.Value.ToString();
            foreach (var node in pregenArr)
            {
                if (node is not JsonObject obj) continue;
                if (obj["assignedUserId"]?.GetValue<string>() != userIdStr) continue;
                obj.Remove("assignedUserId");
                obj.Remove("assignedDisplayName");
                obj["status"] = "ready";
            }

            campaign.JsonData = data.ToJsonString();
        }

        db.CampaignMembers.Remove(member);
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        await CampaignActivityService.LogAsync(
            db,
            campaignId,
            userId.Value,
            CampaignActivityKinds.MemberLeft,
            new { displayName, userId = userId.Value },
            ct);

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

public record AssignPregenBody(Guid UserId, string DisplayName);

static file class CampaignPregenHelpers
{
    public static JsonObject ParseDataObject(string json)
    {
        try
        {
            return JsonNode.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json)?.AsObject()
                   ?? new JsonObject();
        }
        catch
        {
            return new JsonObject();
        }
    }

    public static JsonObject? FindPregen(JsonObject data, Guid pregenId)
    {
        if (data["pregenCharacters"] is not JsonArray arr) return null;
        foreach (var node in arr)
        {
            if (node is not JsonObject obj) continue;
            if (obj["id"]?.GetValue<string>() is { } idStr
                && Guid.TryParse(idStr, out var id)
                && id == pregenId)
                return obj;
        }
        return null;
    }
}

public class AssignCampaignPregenEndpoint(AppDbContext db) : Endpoint<AssignPregenBody>
{
    public override void Configure() => Post("/me/campaigns/{id}/pregens/{pregenId}/assign");

    public override async Task HandleAsync(AssignPregenBody req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var campaignId = Route<Guid>("id");
        var pregenId = Route<Guid>("pregenId");
        var (campaign, membership, isOwner) = await CampaignAccess.LoadAsync(db, campaignId, userId.Value, ct);
        if (campaign is null || !CampaignAccess.CanEdit(isOwner, membership))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var data = CampaignPregenHelpers.ParseDataObject(campaign.JsonData);
        var pregen = CampaignPregenHelpers.FindPregen(data, pregenId);
        if (pregen is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        pregen["assignedUserId"] = req.UserId.ToString();
        pregen["assignedDisplayName"] = req.DisplayName.Trim();
        pregen["status"] = "assigned";

        campaign.JsonData = data.ToJsonString();
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}

public class ClaimCampaignPregenEndpoint(AppDbContext db) : EndpointWithoutRequest<CharacterSummaryDto>
{
    public override void Configure() => Post("/me/campaigns/{id}/pregens/{pregenId}/claim");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var campaignId = Route<Guid>("id");
        var pregenId = Route<Guid>("pregenId");
        var (campaign, membership, isOwner) = await CampaignAccess.LoadAsync(db, campaignId, userId.Value, ct);
        if (campaign is null || !CampaignAccess.CanView(isOwner, membership))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var data = CampaignPregenHelpers.ParseDataObject(campaign.JsonData);
        var pregen = CampaignPregenHelpers.FindPregen(data, pregenId);
        if (pregen is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (pregen["assignedUserId"]?.GetValue<string>() != userId.Value.ToString())
        {
            AddError("Ce personnage ne vous est pas assigné.");
            await Send.ErrorsAsync(StatusCodes.Status403Forbidden, ct);
            return;
        }

        if (pregen["status"]?.GetValue<string>() == "claimed")
        {
            AddError("Personnage déjà revendiqué.");
            await Send.ErrorsAsync(StatusCodes.Status409Conflict, ct);
            return;
        }

        if (!Guid.TryParse(pregen["characterId"]?.GetValue<string>(), out var sourceCharacterId))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var source = await db.Characters.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == sourceCharacterId && c.UserId == campaign.OwnerUserId, ct);
        if (source is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var copyName = pregen["characterName"]?.GetValue<string>()?.Trim() ?? source.Name;
        var copy = new CharacterRecord
        {
            UserId = userId.Value,
            Name = copyName,
            JsonData = source.JsonData,
        };
        db.Characters.Add(copy);

        pregen["status"] = "claimed";
        campaign.JsonData = data.ToJsonString();
        campaign.UpdatedAt = DateTimeOffset.UtcNow;

        var member = campaign.Members.FirstOrDefault(m => m.UserId == userId && m.Role == CampaignMemberRoles.Player);
        if (member is not null)
        {
            var level = CampaignJsonHelpers.LevelFromCharacterJson(source.JsonData);

            member.ApprovedCharacterId = copy.Id;
            member.ApprovedCharacterName = copyName;
            member.ApprovedCharacterLevel = level;
            member.ProposalStatus = CharacterProposalStatuses.Approved;
            member.ProposedCharacterId = null;
            member.ProposedCharacterName = null;
            member.ProposedCharacterLevel = null;
        }

        await db.SaveChangesAsync(ct);
        HttpContext.Response.StatusCode = StatusCodes.Status201Created;
        await Send.OkAsync(new CharacterSummaryDto(copy.Id, copy.Name, copy.UpdatedAt), ct);
    }
}

public class GetCampaignPregenCharacterEndpoint(AppDbContext db) : EndpointWithoutRequest<CharacterDto>
{
    public override void Configure() => Get("/me/campaigns/{id}/pregens/{pregenId}/character");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var campaignId = Route<Guid>("id");
        var pregenId = Route<Guid>("pregenId");
        var (campaign, membership, isOwner) = await CampaignAccess.LoadAsync(db, campaignId, userId.Value, ct);
        if (campaign is null || !CampaignAccess.CanView(isOwner, membership))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var data = CampaignPregenHelpers.ParseDataObject(campaign.JsonData);
        var pregen = CampaignPregenHelpers.FindPregen(data, pregenId);
        if (pregen is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (!isOwner)
        {
            if (pregen["assignedUserId"]?.GetValue<string>() != userId.Value.ToString())
            {
                AddError("Ce personnage ne vous est pas assigné.");
                await Send.ErrorsAsync(StatusCodes.Status403Forbidden, ct);
                return;
            }

            if (pregen["status"]?.GetValue<string>() != "assigned")
            {
                AddError("Ce personnage n'est plus disponible en prévisualisation.");
                await Send.ErrorsAsync(StatusCodes.Status409Conflict, ct);
                return;
            }
        }

        if (!Guid.TryParse(pregen["characterId"]?.GetValue<string>(), out var sourceCharacterId))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var source = await db.Characters.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == sourceCharacterId && c.UserId == campaign.OwnerUserId, ct);
        if (source is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var displayName = pregen["characterName"]?.GetValue<string>()?.Trim() ?? source.Name;
        using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(source.JsonData) ? "{}" : source.JsonData);
        await Send.OkAsync(new CharacterDto(source.Id, displayName, doc.RootElement.Clone(), source.UpdatedAt), ct);
    }
}

public class GetCampaignMemberCharacterEndpoint(AppDbContext db) : EndpointWithoutRequest<CharacterDto>
{
    public override void Configure() => Get("/me/campaigns/{id}/members/{memberId}/character");

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
        var scope = (Query<string>("scope", false) ?? "approved").Trim().ToLowerInvariant();

        var (campaign, membership, isOwner) = await CampaignAccess.LoadAsync(db, campaignId, userId.Value, ct);
        if (campaign is null || !CampaignAccess.CanView(isOwner, membership))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var member = campaign.Members.FirstOrDefault(m => m.Id == memberId);
        if (member is null || member.Role != CampaignMemberRoles.Player)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // MJ : fiches proposées + approuvées. Joueurs : fiches approuvées des joueurs de la table uniquement.
        if (!isOwner && scope == "proposed")
        {
            await Send.ForbiddenAsync(ct);
            return;
        }

        Guid? characterId;
        string? displayName;

        if (scope == "proposed")
        {
            if (member.ProposalStatus != CharacterProposalStatuses.Pending || member.ProposedCharacterId is null)
            {
                await Send.NotFoundAsync(ct);
                return;
            }

            characterId = member.ProposedCharacterId;
            displayName = member.ProposedCharacterName;
        }
        else
        {
            if (member.ApprovedCharacterId is null)
            {
                await Send.NotFoundAsync(ct);
                return;
            }

            characterId = member.ApprovedCharacterId;
            displayName = member.ApprovedCharacterName;
        }

        var character = await db.Characters.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == characterId, ct);
        if (character is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var name = displayName?.Trim() ?? character.Name;
        using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(character.JsonData) ? "{}" : character.JsonData);
        await Send.OkAsync(new CharacterDto(character.Id, name, doc.RootElement.Clone(), character.UpdatedAt), ct);
    }
}
