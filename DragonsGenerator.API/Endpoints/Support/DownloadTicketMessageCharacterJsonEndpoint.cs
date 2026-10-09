using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Support;

public class DownloadTicketMessageCharacterJsonEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Get("/support/tickets/{id}/messages/{messageId}/character-json");

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
        if (ticket is null || msg?.CharacterId is null)
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

        var character = await db.Characters.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == msg.CharacterId && c.UserId == ticket.UserId, ct);
        if (character is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var bytes = System.Text.Encoding.UTF8.GetBytes(
            string.IsNullOrWhiteSpace(character.JsonData) ? "{}" : character.JsonData);
        HttpContext.Response.ContentType = "application/json; charset=utf-8";
        HttpContext.Response.Headers.ContentDisposition = "attachment; filename=\"personnage.json\"";
        await HttpContext.Response.Body.WriteAsync(bytes, ct);
    }
}
