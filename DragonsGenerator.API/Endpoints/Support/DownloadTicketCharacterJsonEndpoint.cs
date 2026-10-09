using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Support;

public class DownloadTicketCharacterJsonEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Get("/support/tickets/{id}/character-json");

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
        if (ticket is null || ticket.CharacterId is null)
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
            .FirstOrDefaultAsync(c => c.Id == ticket.CharacterId && c.UserId == ticket.UserId, ct);
        if (character is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var json = string.IsNullOrWhiteSpace(character.JsonData) ? "{}" : character.JsonData;
        var fileName = TicketFileNames.Sanitize(character.Name, "personnage") + ".json";
        var bytes = System.Text.Encoding.UTF8.GetBytes(json);

        HttpContext.Response.ContentType = "application/json; charset=utf-8";
        HttpContext.Response.Headers.ContentDisposition = $"attachment; filename=\"{fileName}\"";
        await HttpContext.Response.Body.WriteAsync(bytes, ct);
    }
}
