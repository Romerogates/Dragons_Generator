using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Support;

public class AdminUpdateTicketEndpoint(AppDbContext db, SupportDeskService desk)
    : Endpoint<UpdateTicketRequest, TicketDto>
{
    public override void Configure()
    {
        Patch("/admin/support/tickets/{id}");
        Roles(AppRoles.Admin);
    }

    public override async Task HandleAsync(UpdateTicketRequest req, CancellationToken ct)
    {
        var id = Route<Guid>("id");
        var ticket = await db.SupportTickets.Include(t => t.User).FirstOrDefaultAsync(t => t.Id == id, ct);
        if (ticket is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }
        var previous = ticket.Status;
        if (!string.IsNullOrWhiteSpace(req.Status))
            ticket.Status = req.Status.Trim();
        if (req.AdminNotes is not null)
            ticket.AdminNotes = req.AdminNotes;
        if (ticket.Status == "in_progress")
        {
            var staffId = AuthHelpers.GetUserId(User);
            if (staffId is not null)
                ticket.AssignedStaffUserId = staffId;
        }
        ticket.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        if (previous != "in_progress" && ticket.Status == "in_progress")
            await desk.NotifyTakenAsync(ticket, ticket.User.Email, ticket.User.DisplayName, ct);

        var count = await db.SupportTicketMessages.CountAsync(m => m.TicketId == ticket.Id, ct);
        await Send.OkAsync(SupportTicketMapping.ToDto(ticket, ticket.User.Email, count), ct);
    }
}
