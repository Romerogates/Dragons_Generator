using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Support;

public record TicketDto(
    Guid Id,
    string Subject,
    string Message,
    string Status,
    string? AttachmentOriginalName,
    string? AttachmentUrl,
    Guid? CharacterId,
    string? CharacterName,
    DateTimeOffset CreatedAt,
    string? UserEmail,
    string? AdminNotes
);

public class CreateTicketEndpoint(AppDbContext db, ILogger<CreateTicketEndpoint> logger)
    : EndpointWithoutRequest<TicketDto>
{
    public override void Configure()
    {
        Post("/support/tickets");
        AllowFileUploads();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var form = HttpContext.Request.Form;
        var subject = form["subject"].ToString().Trim();
        var message = form["message"].ToString().Trim();
        if (subject.Length < 3 || message.Length < 5)
        {
            AddError("Sujet et message requis.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        string? stored = null;
        string? original = null;
        var file = HttpContext.Request.Form.Files.FirstOrDefault();
        if (file is not null && file.Length > 0)
        {
            if (file.Length > 15 * 1024 * 1024)
            {
                AddError("Fichier trop volumineux (max 15 Mo).");
                await Send.ErrorsAsync(cancellation: ct);
                return;
            }
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (ext is not (".pdf" or ".png" or ".jpg" or ".jpeg" or ".webp"))
            {
                AddError("Formats acceptés : PDF, PNG, JPG, WEBP.");
                await Send.ErrorsAsync(cancellation: ct);
                return;
            }

            original = Path.GetFileName(file.FileName);
            stored = $"{Guid.NewGuid():N}{ext}";
            var dir = Path.Combine(AppContext.BaseDirectory, "data", "uploads", "tickets");
            Directory.CreateDirectory(dir);
            var path = Path.Combine(dir, stored);
            await using var fs = File.Create(path);
            await file.CopyToAsync(fs, ct);
            logger.LogInformation("Ticket attachment saved {File}", stored);
        }

        Guid? characterId = null;
        string? characterName = null;
        var characterRaw = form["characterId"].ToString().Trim();
        if (!string.IsNullOrWhiteSpace(characterRaw) && Guid.TryParse(characterRaw, out var parsedCharId))
        {
            var character = await db.Characters.AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == parsedCharId && c.UserId == userId.Value, ct);
            if (character is null)
            {
                AddError("Personnage invalide.");
                await Send.ErrorsAsync(cancellation: ct);
                return;
            }
            characterId = character.Id;
            characterName = character.Name;
        }

        var ticket = new SupportTicket
        {
            UserId = userId.Value,
            Subject = subject,
            Message = message,
            AttachmentStoredName = stored,
            AttachmentOriginalName = original,
            CharacterId = characterId,
            CharacterName = characterName,
        };
        db.SupportTickets.Add(ticket);
        await db.SaveChangesAsync(ct);

        await Send.OkAsync(ToDto(ticket, null), ct);
    }

    internal static TicketDto ToDto(SupportTicket t, string? email) =>
        new(
            t.Id,
            t.Subject,
            t.Message,
            t.Status,
            t.AttachmentOriginalName,
            t.AttachmentStoredName is null ? null : $"/uploads/tickets/{t.AttachmentStoredName}",
            t.CharacterId,
            t.CharacterName,
            t.CreatedAt,
            email,
            t.AdminNotes
        );
}

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

        await Send.OkAsync(
            list.OrderByDescending(t => t.CreatedAt)
                .Select(t => CreateTicketEndpoint.ToDto(t, null))
                .ToList(),
            ct
        );
    }
}

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

        await Send.OkAsync(
            tickets
                .OrderByDescending(t => t.CreatedAt)
                .Select(t => CreateTicketEndpoint.ToDto(t, emailById.GetValueOrDefault(t.UserId)))
                .ToList(),
            ct
        );
    }
}

public record UpdateTicketRequest(string? Status, string? AdminNotes);

public class AdminUpdateTicketEndpoint(AppDbContext db) : Endpoint<UpdateTicketRequest, TicketDto>
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
        if (!string.IsNullOrWhiteSpace(req.Status))
            ticket.Status = req.Status.Trim();
        if (req.AdminNotes is not null)
            ticket.AdminNotes = req.AdminNotes;
        await db.SaveChangesAsync(ct);
        await Send.OkAsync(CreateTicketEndpoint.ToDto(ticket, ticket.User.Email), ct);
    }
}

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
        var fileName = SanitizeFileName(character.Name) + ".json";
        var bytes = System.Text.Encoding.UTF8.GetBytes(json);

        HttpContext.Response.ContentType = "application/json; charset=utf-8";
        HttpContext.Response.Headers.ContentDisposition = $"attachment; filename=\"{fileName}\"";
        await HttpContext.Response.Body.WriteAsync(bytes, ct);
    }

    private static string SanitizeFileName(string name)
    {
        var cleaned = string.Join(
            "_",
            (name ?? "personnage").Split(Path.GetInvalidFileNameChars(), StringSplitOptions.RemoveEmptyEntries)
        ).Trim();
        return string.IsNullOrWhiteSpace(cleaned) ? "personnage" : cleaned;
    }
}
