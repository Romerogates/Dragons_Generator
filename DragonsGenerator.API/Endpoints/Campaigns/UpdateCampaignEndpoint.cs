using System.Text.Json;
using System.Text.Json.Nodes;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;


public class UpdateCampaignEndpoint(AppDbContext db, PushNotificationService push, CampaignLivePublisher live)
    : Endpoint<UpsertCampaignRequest, CampaignSummaryDto>
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
        if (campaign is null || !CampaignAccess.CanEdit(isOwner, membership, campaign))
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

                var combatEnded = CampaignJsonHelpers.AnalyzeCombatEnded(campaign.JsonData, newJson);
                if (combatEnded.Changed)
                {
                    await CampaignActivityService.LogAsync(
                        db, campaign.Id, userId.Value, CampaignActivityKinds.CombatEnded,
                        new
                        {
                            message = combatEnded.Message,
                            label = combatEnded.Label,
                            round = combatEnded.Round,
                            sessionId = combatEnded.SessionId,
                            historyId = combatEnded.HistoryId,
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

        await live.NotifyAsync(
            campaign.Id,
            campaign.UpdatedAt,
            initiativeChange is not null ? CampaignLiveReasons.Initiative : CampaignLiveReasons.Campaign,
            ct);

        var playerCount = campaign.Members.Count(CampaignHistoryHelpers.IsActivePlayer);
        var isArchived = campaign.Members.Any(m =>
            m.UserId == userId.Value && m.ArchivedAt != null && m.LeftAt == null && m.RemovedAt == null);
        var isClosed = campaign.ClosedAt != null;
        await Send.OkAsync(new CampaignSummaryDto(
            campaign.Id,
            campaign.Title,
            CampaignMemberRoles.Dm,
            campaign.UpdatedAt,
            playerCount,
            CampaignJsonHelpers.RegionNameFromJson(campaign.JsonData),
            isArchived && !isClosed,
            isClosed,
            isClosed,
            isClosed ? CampaignMembershipStatuses.Closed : CampaignMembershipStatuses.Active), ct);
    }
}
