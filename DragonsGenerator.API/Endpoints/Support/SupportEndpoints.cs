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
    DateTimeOffset UpdatedAt,
    string? UserEmail,
    string? AdminNotes,
    int MessageCount
);

public record TicketMessageDto(
    Guid Id,
    bool FromStaff,
    string Body,
    DateTimeOffset CreatedAt,
    Guid? CharacterId = null,
    string? CharacterName = null,
    string? AttachmentOriginalName = null
);

public record TicketThreadDto(TicketDto Ticket, List<TicketMessageDto> Messages);

public record PostTicketMessageRequest(string Body);

public class CreateTicketEndpoint(AppDbContext db, SupportDeskService desk, ILogger<CreateTicketEndpoint> logger)
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

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId.Value, ct);
        if (user is not null)
            await desk.NotifyNewTicketAsync(ticket, user.Email, ct);

        await Send.OkAsync(ToDto(ticket, user?.Email, 0), ct);
    }

    internal static TicketDto ToDto(SupportTicket t, string? email, int messageCount) =>
        new(
            t.Id,
            t.Subject,
            t.Message,
            t.Status,
            t.AttachmentOriginalName,
            t.AttachmentStoredName is null ? null : $"/support/tickets/{t.Id}/attachment",
            t.CharacterId,
            t.CharacterName,
            t.CreatedAt,
            t.UpdatedAt == default ? t.CreatedAt : t.UpdatedAt,
            email,
            t.AdminNotes,
            messageCount
        );
}

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
        var downloadName = SanitizeFileName(ticket.AttachmentOriginalName ?? stored);
        HttpContext.Response.ContentType = ContentTypeForExtension(ext);
        HttpContext.Response.Headers.ContentDisposition = $"inline; filename=\"{downloadName}\"";
        await using var fs = File.OpenRead(path);
        await fs.CopyToAsync(HttpContext.Response.Body, ct);
    }

    private static string ContentTypeForExtension(string ext) =>
        ext switch
        {
            ".pdf" => "application/pdf",
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            _ => "application/octet-stream",
        };

    private static string SanitizeFileName(string name)
    {
        var cleaned = string.Join(
            "_",
            name.Split(Path.GetInvalidFileNameChars(), StringSplitOptions.RemoveEmptyEntries)
        ).Trim();
        return string.IsNullOrWhiteSpace(cleaned) ? "piece-jointe" : cleaned;
    }
}

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
                .Select(t => CreateTicketEndpoint.ToDto(t, null, counts.GetValueOrDefault(t.Id)))
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
        var ids = tickets.Select(t => t.Id).ToList();
        var counts = ids.Count == 0
            ? new Dictionary<Guid, int>()
            : (await db.SupportTicketMessages.AsNoTracking()
                    .Where(m => ids.Contains(m.TicketId))
                    .GroupBy(m => m.TicketId)
                    .Select(g => new { g.Key, Count = g.Count() })
                    .ToListAsync(ct))
                .ToDictionary(x => x.Key, x => x.Count);

        await Send.OkAsync(
            tickets
                .OrderByDescending(t => t.UpdatedAt == default ? t.CreatedAt : t.UpdatedAt)
                .Select(t => CreateTicketEndpoint.ToDto(
                    t,
                    emailById.GetValueOrDefault(t.UserId),
                    counts.GetValueOrDefault(t.Id)))
                .ToList(),
            ct
        );
    }
}

public record UpdateTicketRequest(string? Status, string? AdminNotes);

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
        ticket.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        if (previous != "in_progress" && ticket.Status == "in_progress")
            await desk.NotifyTakenAsync(ticket, ticket.User.Email, ticket.User.DisplayName, ct);

        var count = await db.SupportTicketMessages.CountAsync(m => m.TicketId == ticket.Id, ct);
        await Send.OkAsync(CreateTicketEndpoint.ToDto(ticket, ticket.User.Email, count), ct);
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

public class GetTicketThreadEndpoint(AppDbContext db) : EndpointWithoutRequest<TicketThreadDto>
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
                m.AttachmentOriginalName))
            .ToList();

        await Send.OkAsync(
            new TicketThreadDto(CreateTicketEndpoint.ToDto(ticket, email, messages.Count), messages),
            ct);
    }
}

public class PostTicketMessageEndpoint(AppDbContext db, SupportDeskService desk, ILogger<PostTicketMessageEndpoint> logger)
    : Endpoint<PostTicketMessageRequest, TicketMessageDto>
{
    public override void Configure() => Post("/support/tickets/{id}/messages");

    public override async Task HandleAsync(PostTicketMessageRequest req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var body = HttpContext.Request.HasFormContentType
            ? HttpContext.Request.Form["body"].ToString()
            : (req.Body ?? "");
        body = body.Trim();
        if (body.Length < 2)
        {
            AddError("Message trop court.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        var id = Route<Guid>("id");
        var ticket = await db.SupportTickets.Include(t => t.User).FirstOrDefaultAsync(t => t.Id == id, ct);
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

        if (ticket.Status == "closed" && !isAdmin)
        {
            AddError("Ticket fermé.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        string? stored = null;
        string? original = null;
        if (HttpContext.Request.HasFormContentType)
        {
            var file = HttpContext.Request.Form.Files.FirstOrDefault();
            if (file is not null && file.Length > 0)
            {
                if (!TicketUpload.TrySave(file, logger, out stored, out original, out var fileError))
                {
                    AddError(fileError ?? "Fichier invalide.");
                    await Send.ErrorsAsync(cancellation: ct);
                    return;
                }
            }
        }

        Guid? characterId = null;
        string? characterName = null;
        var characterRaw = HttpContext.Request.HasFormContentType
            ? HttpContext.Request.Form["characterId"].ToString().Trim()
            : "";
        if (!string.IsNullOrWhiteSpace(characterRaw) && Guid.TryParse(characterRaw, out var parsedCharId))
        {
            var character = await db.Characters.AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == parsedCharId && c.UserId == ticket.UserId, ct);
            if (character is null)
            {
                AddError("Personnage invalide.");
                await Send.ErrorsAsync(cancellation: ct);
                return;
            }
            characterId = character.Id;
            characterName = character.Name;
        }

        var msg = new SupportTicketMessage
        {
            TicketId = ticket.Id,
            AuthorUserId = userId.Value,
            FromStaff = isAdmin,
            Body = body.Length > 8000 ? body[..8000] : body,
            CharacterId = characterId,
            CharacterName = characterName,
            AttachmentStoredName = stored,
            AttachmentOriginalName = original,
        };
        db.SupportTicketMessages.Add(msg);
        ticket.UpdatedAt = DateTimeOffset.UtcNow;
        if (isAdmin && ticket.Status == "open")
            ticket.Status = "in_progress";
        await db.SaveChangesAsync(ct);

        if (isAdmin)
            await desk.NotifyReplyAsync(ticket, ticket.User.Email, ticket.User.DisplayName, msg.Body, ct);
        else
            await desk.NotifyNewTicketAsync(ticket, ticket.User.Email, ct, msg.Body);

        await Send.OkAsync(
            new TicketMessageDto(
                msg.Id,
                msg.FromStaff,
                msg.Body,
                msg.CreatedAt,
                msg.CharacterId,
                msg.CharacterName,
                msg.AttachmentOriginalName),
            ct);
    }
}

internal static class TicketUpload
{
    public static bool TrySave(
        IFormFile file,
        ILogger logger,
        out string? stored,
        out string? original,
        out string? error)
    {
        stored = null;
        original = null;
        error = null;
        if (file.Length > 15 * 1024 * 1024)
        {
            error = "Fichier trop volumineux (max 15 Mo).";
            return false;
        }
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext is not (".pdf" or ".png" or ".jpg" or ".jpeg" or ".webp"))
        {
            error = "Formats acceptés : PDF, PNG, JPG, WEBP.";
            return false;
        }

        original = Path.GetFileName(file.FileName);
        stored = $"{Guid.NewGuid():N}{ext}";
        var dir = Path.Combine(AppContext.BaseDirectory, "data", "uploads", "tickets");
        Directory.CreateDirectory(dir);
        using var fs = File.Create(Path.Combine(dir, stored));
        file.CopyTo(fs);
        logger.LogInformation("Ticket attachment saved {File}", stored);
        return true;
    }
}
