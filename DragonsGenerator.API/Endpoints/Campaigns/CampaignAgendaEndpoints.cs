using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;

public record AgendaEventDto(
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
    string? Location);

/// <summary>Agenda global : sessions + dates libres de toutes les campagnes actives de l’utilisateur.</summary>
public class GetMyAgendaEndpoint(AppDbContext db) : EndpointWithoutRequest<List<AgendaEventDto>>
{
    public override void Configure() => Get("/me/agenda");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var owned = await db.Campaigns.AsNoTracking()
            .Where(c => c.OwnerUserId == userId && c.ClosedAt == null)
            .Select(c => new { c.Id, c.Title, c.JsonData, IsOwner = true })
            .ToListAsync(ct);

        var joined = await db.CampaignMembers.AsNoTracking()
            .Where(m =>
                m.UserId == userId
                && m.Role == CampaignMemberRoles.Player
                && m.LeftAt == null
                && m.RemovedAt == null
                && m.Campaign.ClosedAt == null)
            .Select(m => new
            {
                Id = m.CampaignId,
                m.Campaign.Title,
                m.Campaign.JsonData,
                IsOwner = false,
            })
            .ToListAsync(ct);

        // Évite les doublons si un compte est à la fois owner (ne devrait pas) et member.
        var seen = new HashSet<Guid>();
        var events = new List<AgendaEventDto>();

        foreach (var row in owned.Concat(joined))
        {
            if (!seen.Add(row.Id)) continue;
            var extracted = CampaignJsonHelpers.ExtractAgendaEvents(
                row.JsonData,
                row.Id,
                row.Title,
                row.IsOwner);
            foreach (var e in extracted)
            {
                events.Add(new AgendaEventDto(
                    e.Id,
                    e.CampaignId,
                    e.CampaignTitle,
                    e.Source,
                    e.Title,
                    e.StartsAt,
                    e.EndsAt,
                    e.AllDay,
                    e.Kind,
                    e.Status,
                    e.Location));
            }
        }

        events.Sort((a, b) => a.StartsAt.CompareTo(b.StartsAt));
        await Send.OkAsync(events, ct);
    }
}
