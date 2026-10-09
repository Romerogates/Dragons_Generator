using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DragonsGenerator.API.Endpoints.Support;

public class GetTicketThreadEndpoint(AppDbContext db, IOptionsMonitor<SmtpOptions> smtp)
    : EndpointWithoutRequest<TicketThreadDto>
{
    public override void Configure() => Get("/support/tickets/{id}");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<Guid>("id");
        var ticket = await db.SupportTickets.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id, ct);
        if (ticket is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var isAdmin = AuthHelpers.IsAdmin(User);
        if (ticket.UserId != userId && !isAdmin)
        {
            await Send.ForbiddenAsync(ct);
            return;
        }

        var email = await db.Users.AsNoTracking()
            .Where(u => u.Id == ticket.UserId)
            .Select(u => u.Email)
            .FirstOrDefaultAsync(ct);
        var messages = (await db.SupportTicketMessages.AsNoTracking()
                .Where(m => m.TicketId == id)
                .ToListAsync(ct))
            .OrderBy(m => m.CreatedAt)
            .Select(m => new TicketMessageDto(
                m.Id,
                m.FromStaff,
                m.Body,
                m.CreatedAt,
                m.CharacterId,
                m.CharacterName,
                m.AttachmentOriginalName,
                m.CampaignId,
                m.CampaignName))
            .ToList();

        string? staffName = null;
        if (ticket.AssignedStaffUserId is Guid staffId)
        {
            staffName = await db.Users.AsNoTracking()
                .Where(u => u.Id == staffId)
                .Select(u => u.DisplayName)
                .FirstOrDefaultAsync(ct);
        }

        await Send.OkAsync(
            new TicketThreadDto(
                SupportTicketMapping.ToDto(ticket, email, messages.Count, staffName),
                messages,
                !smtp.CurrentValue.IsSink),
            ct);
    }
}
