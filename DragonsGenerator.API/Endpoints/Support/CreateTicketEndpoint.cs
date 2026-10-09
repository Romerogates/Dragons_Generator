using DragonsGenerator.API.Endpoints.Campaigns;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Support;

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

        Guid? campaignId = null;
        string? campaignName = null;
        var campaignRaw = form["campaignId"].ToString().Trim();
        if (!string.IsNullOrWhiteSpace(campaignRaw) && Guid.TryParse(campaignRaw, out var parsedCampId))
        {
            var (cid, cname, campError) = await CampaignAccess.ResolveAttachableAsync(
                db, userId.Value, parsedCampId, ct);
            if (campError is not null)
            {
                AddError(campError);
                await Send.ErrorsAsync(cancellation: ct);
                return;
            }
            campaignId = cid;
            campaignName = cname;
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
            CampaignId = campaignId,
            CampaignName = campaignName,
            Category = SupportTicketRules.NormalizeCategory(form["category"].ToString()),
        };
        db.SupportTickets.Add(ticket);
        await db.SaveChangesAsync(ct);

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId.Value, ct);
        if (user is not null)
            await desk.NotifyNewTicketAsync(ticket, user.Email, ct);

        await Send.OkAsync(SupportTicketMapping.ToDto(ticket, user?.Email, 0), ct);
    }
}
