using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Support;

public class AdminListTicketsEndpoint(AppDbContext db) : EndpointWithoutRequest<List<TicketDto>>
{
    public override void Configure()
    {
        Get("/admin/support/tickets");
        Roles(AppRoles.Admin);
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        // Pas d'Include : SQLite + DateTimeOffset plante sur les ORDER BY générés par EF.
        var tickets = await db.SupportTickets.AsNoTracking().ToListAsync(ct);
        var userIds = tickets.Select(t => t.UserId).Distinct().ToList();
        var emails = await db.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.Email })
            .ToListAsync(ct);
        var emailById = emails.ToDictionary(x => x.Id, x => x.Email);
        var ids = tickets.Select(t => t.Id).ToList();
        var counts = ids.Count == 0
            ? new Dictionary<Guid, int>()
            : (await db.SupportTicketMessages.AsNoTracking()
                    .Where(m => ids.Contains(m.TicketId))
                    .GroupBy(m => m.TicketId)
                    .Select(g => new { g.Key, Count = g.Count() })
                    .ToListAsync(ct))
                .ToDictionary(x => x.Key, x => x.Count);

        var staffNames = await SupportInboxHelper.StaffNamesAsync(db, tickets, ct);
        await Send.OkAsync(
            tickets
                .OrderByDescending(t => t.UpdatedAt == default ? t.CreatedAt : t.UpdatedAt)
                .Select(t => SupportTicketMapping.ToDto(
                    t,
                    emailById.GetValueOrDefault(t.UserId),
                    counts.GetValueOrDefault(t.Id),
                    t.AssignedStaffUserId is { } sid ? staffNames.GetValueOrDefault(sid) : null))
                .ToList(),
            ct
        );
    }
}
