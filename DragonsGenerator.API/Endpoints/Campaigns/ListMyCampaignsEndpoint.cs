using System.Text.Json;
using System.Text.Json.Nodes;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;


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
                c.ClosedAt,
                PlayerCount = c.Members.Count(m =>
                    m.Role == CampaignMemberRoles.Player && m.LeftAt == null && m.RemovedAt == null),
                HasPlayerHistory = c.Members.Any(m => m.Role == CampaignMemberRoles.Player),
                IsArchived = c.Members.Any(m => m.UserId == userId && m.ArchivedAt != null && m.LeftAt == null && m.RemovedAt == null),
            })
            .ToListAsync(ct);

        var owned = ownedRows
            .Select(c =>
            {
                var isClosed = c.ClosedAt != null;
                return new CampaignSummaryDto(
                    c.Id,
                    c.Title,
                    CampaignMemberRoles.Dm,
                    c.UpdatedAt,
                    c.PlayerCount,
                    CampaignJsonHelpers.RegionNameFromJson(c.JsonData),
                    c.IsArchived && !isClosed,
                    isClosed,
                    isClosed,
                    isClosed ? CampaignMembershipStatuses.Closed : CampaignMembershipStatuses.Active,
                    c.HasPlayerHistory);
            })
            .ToList();

        var joinedRows = await db.CampaignMembers.AsNoTracking()
            .Where(m =>
                m.UserId == userId
                && (m.Role == CampaignMemberRoles.Player || m.Role == CampaignMemberRoles.Spectator))
            .Select(m => new
            {
                m.CampaignId,
                m.Campaign.Title,
                m.Campaign.UpdatedAt,
                m.Campaign.JsonData,
                m.Campaign.ClosedAt,
                m.ArchivedAt,
                m.LeftAt,
                m.RemovedAt,
                m.Role,
                PlayerCount = m.Campaign.Members.Count(x =>
                    x.Role == CampaignMemberRoles.Player && x.LeftAt == null && x.RemovedAt == null),
                HasPlayerHistory = m.Campaign.Members.Any(x => x.Role == CampaignMemberRoles.Player),
            })
            .ToListAsync(ct);

        var joined = joinedRows
            .Select(m =>
            {
                var isClosed = m.ClosedAt != null;
                var isHistory = isClosed || m.LeftAt != null || m.RemovedAt != null;
                var status = isClosed
                    ? CampaignMembershipStatuses.Closed
                    : m.RemovedAt != null
                        ? CampaignMembershipStatuses.Removed
                        : m.LeftAt != null
                            ? CampaignMembershipStatuses.Left
                            : CampaignMembershipStatuses.Active;
                return new CampaignSummaryDto(
                    m.CampaignId,
                    m.Title,
                    m.Role,
                    m.UpdatedAt,
                    m.PlayerCount,
                    CampaignJsonHelpers.RegionNameFromJson(m.JsonData),
                    !isHistory && m.ArchivedAt != null,
                    isClosed,
                    isHistory,
                    status,
                    m.HasPlayerHistory);
            })
            .ToList();

        var all = owned.Concat(joined).OrderByDescending(c => c.UpdatedAt).ToList();
        await Send.OkAsync(all, ct);
    }
}
