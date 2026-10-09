using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Support;

public class DownloadTicketAttachmentEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Get("/support/tickets/{id}/attachment");

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
        if (ticket is null || string.IsNullOrWhiteSpace(ticket.AttachmentStoredName))
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
        var stored = Path.GetFileName(ticket.AttachmentStoredName);
        var path = Path.Combine(dir, stored);
        if (!File.Exists(path))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var ext = Path.GetExtension(stored).ToLowerInvariant();
        var downloadName = TicketFileNames.Sanitize(ticket.AttachmentOriginalName ?? stored);
        HttpContext.Response.ContentType = TicketFileNames.ContentTypeForExtension(ext);
        HttpContext.Response.Headers.ContentDisposition = $"inline; filename=\"{downloadName}\"";
        await using var fs = File.OpenRead(path);
        await fs.CopyToAsync(HttpContext.Response.Body, ct);
    }
}
