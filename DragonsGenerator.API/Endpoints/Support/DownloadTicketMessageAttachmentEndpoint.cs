using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Support;

public class DownloadTicketMessageAttachmentEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Get("/support/tickets/{id}/messages/{messageId}/attachment");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var ticketId = Route<Guid>("id");
        var messageId = Route<Guid>("messageId");
        var ticket = await db.SupportTickets.AsNoTracking().FirstOrDefaultAsync(t => t.Id == ticketId, ct);
        var msg = await db.SupportTicketMessages.AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == messageId && m.TicketId == ticketId, ct);
        if (ticket is null || msg is null || string.IsNullOrWhiteSpace(msg.AttachmentStoredName))
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

        var dir = Path.Combine(AppContext.BaseDirectory, "data", "uploads", "tickets");
        var stored = Path.GetFileName(msg.AttachmentStoredName);
        var path = Path.Combine(dir, stored);
        if (!File.Exists(path))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        HttpContext.Response.ContentType = "application/octet-stream";
        HttpContext.Response.Headers.ContentDisposition =
            $"inline; filename=\"{Path.GetFileName(msg.AttachmentOriginalName ?? stored)}\"";
        await using var fs = File.OpenRead(path);
        await fs.CopyToAsync(HttpContext.Response.Body, ct);
    }
}
