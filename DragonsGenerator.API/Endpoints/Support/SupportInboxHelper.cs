using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Support;

internal static class SupportInboxHelper
{
    public static async Task<int> CountWaitingOnStaffAsync(AppDbContext db, CancellationToken ct)
    {
        var tickets = await db.SupportTickets.AsNoTracking()
            .Where(t => t.Status != "closed")
            .Select(t => new { t.Id, t.Status })
            .ToListAsync(ct);
        if (tickets.Count == 0)
            return 0;

        var ids = tickets.Select(t => t.Id).ToList();
        var last = await LastFromStaffByTicketAsync(db, ids, ct);
        return tickets.Count(t =>
            SupportTicketRules.WaitingOnStaff(t.Status, last.GetValueOrDefault(t.Id)));
    }

    public static async Task<Dictionary<Guid, bool?>> LastFromStaffByTicketAsync(
        AppDbContext db,
        List<Guid> ticketIds,
        CancellationToken ct)
    {
        var result = new Dictionary<Guid, bool?>();
        if (ticketIds.Count == 0)
            return result;

        var msgs = await db.SupportTicketMessages.AsNoTracking()
            .Where(m => ticketIds.Contains(m.TicketId))
            .Select(m => new { m.TicketId, m.FromStaff, m.CreatedAt, m.Id })
            .ToListAsync(ct);
        foreach (var g in msgs.GroupBy(m => m.TicketId))
        {
            var last = g.OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.Id).First();
            result[g.Key] = last.FromStaff;
        }

        return result;
    }

    public static async Task<Dictionary<Guid, string>> StaffNamesAsync(
        AppDbContext db,
        IEnumerable<SupportTicket> tickets,
        CancellationToken ct)
    {
        var ids = tickets
            .Where(t => t.AssignedStaffUserId is not null)
            .Select(t => t.AssignedStaffUserId!.Value)
            .Distinct()
            .ToList();
        if (ids.Count == 0)
            return new Dictionary<Guid, string>();

        return await db.Users.AsNoTracking()
            .Where(u => ids.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName, ct);
    }
}

