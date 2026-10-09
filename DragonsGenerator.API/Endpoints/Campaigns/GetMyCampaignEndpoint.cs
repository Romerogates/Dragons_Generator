using System.Text.Json;
using System.Text.Json.Nodes;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;


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
        var supportInspect = CampaignAccess.IsSupportInspect(membership);
        var role = isOwner ? CampaignMemberRoles.Dm : membership!.Role;
        var isHistory = CampaignHistoryHelpers.IsHistoryView(campaign, membership);
        var membershipStatus = CampaignHistoryHelpers.ResolveMembershipStatus(campaign, membership, isOwner);

        JsonElement data;
        if (!isOwner && isHistory && !string.IsNullOrWhiteSpace(membership?.HistorySnapshotJson))
        {
            data = CampaignHistoryHelpers.ParseSnapshotOrEmpty(membership!.HistorySnapshotJson);
        }
        else if (isOwner || supportInspect)
        {
            data = doc.RootElement.Clone();
        }
        else
        {
            var libIds = CampaignJsonHelpers.CollectActiveLibraryDungeonIds(doc.RootElement);
            Dictionary<Guid, JsonObject>? libraryGeometries = null;
            if (libIds.Count > 0)
            {
                var ownerId = campaign.OwnerUserId;
                var rows = await db.Dungeons.AsNoTracking()
                    .Where(d => d.UserId == ownerId && libIds.Contains(d.Id))
                    .Select(d => new { d.Id, d.JsonData })
                    .ToListAsync(ct);
                libraryGeometries = new Dictionary<Guid, JsonObject>();
                foreach (var row in rows)
                {
                    try
                    {
                        var parsed = JsonNode.Parse(
                            string.IsNullOrWhiteSpace(row.JsonData) ? "{}" : row.JsonData) as JsonObject;
                        if (parsed is not null) libraryGeometries[row.Id] = parsed;
                    }
                    catch
                    {
                        /* ignore malformed library JSON */
                    }
                }
            }

            data = CampaignJsonHelpers.FilterForPlayerView(doc.RootElement, userId.Value, libraryGeometries);
        }

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

        var memberSource = isHistory && isOwner
            ? campaign.Members.AsEnumerable()
            : campaign.Members.Where(m =>
                m.Role != CampaignMemberRoles.Player || CampaignHistoryHelpers.IsActivePlayer(m));
        if (!isOwner && isHistory)
            memberSource = campaign.Members.Where(m => m.UserId == userId);

        var members = memberSource.Select(m => new CampaignMemberDto(
            m.Id, m.UserId, m.User.DisplayName, m.Role, m.ProposalStatus,
            m.ApprovedCharacterId, m.ApprovedCharacterName, m.ApprovedCharacterLevel,
            m.ProposedCharacterId, m.ProposedCharacterName, m.ProposedCharacterLevel,
            m.XpEarnedInCampaign)).ToList();

        await Send.OkAsync(new CampaignDetailDto(
            campaign.Id,
            campaign.Title,
            data,
            role,
            isOwner,
            campaign.UpdatedAt,
            members,
            !isHistory && membership?.ArchivedAt != null,
            campaign.ClosedAt != null,
            isHistory,
            membershipStatus,
            campaign.Members.Any(m => m.Role == CampaignMemberRoles.Player)), ct);
    }
}
