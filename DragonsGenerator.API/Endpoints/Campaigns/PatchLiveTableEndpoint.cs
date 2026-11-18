using System.Text.Json;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;

public class PatchLiveTableRequest
{
    public string SessionId { get; set; } = "";
    public JsonElement TablePawns { get; set; }
    public List<LiveTableCombatantPosition>? CombatantPositions { get; set; }
    public string? ActiveMapId { get; set; }
    public bool ClearActiveMapId { get; set; }
}

public class PatchLiveTableEndpoint(AppDbContext db, CampaignLivePublisher live)
    : Endpoint<PatchLiveTableRequest, CampaignSummaryDto>
{
    public override void Configure() => Patch("/me/campaigns/{id}/live-table");

    public override async Task HandleAsync(PatchLiveTableRequest req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<Guid>("id");
        string? lastError = null;
        for (var attempt = 0; attempt < 3; attempt++)
        {
            var (campaign, membership, isOwner) = await CampaignAccess.LoadAsync(db, id, userId.Value, ct);
            if (campaign is null || !CampaignAccess.CanPatchLiveTable(isOwner, membership, campaign))
            {
                await Send.NotFoundAsync(ct);
                return;
            }

            var restrictToActor = !CampaignAccess.CanEdit(isOwner, membership, campaign);
            var hydrated = CampaignLiveTableStore.Hydrate(campaign.JsonData, campaign.LiveTableJson);
            var newJson = CampaignJsonHelpers.TryPatchLiveTable(
                hydrated,
                (req.SessionId ?? "").Trim(),
                req.TablePawns,
                req.CombatantPositions,
                req.ActiveMapId,
                req.ClearActiveMapId,
                restrictToActor ? userId.Value.ToString() : null,
                restrictToActor,
                out var error);

            if (newJson is null)
            {
                lastError = error;
                break;
            }

            CampaignLiveTableStore.Write(campaign, newJson);
            campaign.UpdatedAt = DateTimeOffset.UtcNow;
            try
            {
                await db.SaveChangesAsync(ct);
                await live.NotifyAsync(campaign.Id, campaign.UpdatedAt, CampaignLiveReasons.Campaign, ct);

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
                return;
            }
            catch (DbUpdateConcurrencyException)
            {
                foreach (var entry in db.ChangeTracker.Entries())
                    await entry.ReloadAsync(ct);
            }
        }

        AddError(lastError ?? "Impossible de mettre à jour la table (concurrence).");
        await Send.ErrorsAsync(StatusCodes.Status409Conflict, ct);
    }
}
