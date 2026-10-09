using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Support;

public class ListMyTicketsEndpoint(AppDbContext db) : EndpointWithoutRequest<List<TicketDto>>
{
    public override void Configure() => Get("/support/tickets");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var list = await db.SupportTickets.AsNoTracking()
            .Where(t => t.UserId == userId)
            .ToListAsync(ct);
        var ids = list.Select(t => t.Id).ToList();
        var counts = ids.Count == 0
            ? new Dictionary<Guid, int>()
            : (await db.SupportTicketMessages.AsNoTracking()
                    .Where(m => ids.Contains(m.TicketId))
                    .GroupBy(m => m.TicketId)
                    .Select(g => new { g.Key, Count = g.Count() })
                    .ToListAsync(ct))
                .ToDictionary(x => x.Key, x => x.Count);

        await Send.OkAsync(
            list.OrderByDescending(t => t.UpdatedAt == default ? t.CreatedAt : t.UpdatedAt)
                .Select(t => SupportTicketMapping.ToDto(t, null, counts.GetValueOrDefault(t.Id)))
                .ToList(),
            ct
        );
    }
}
