using DragonsGenerator.API.Endpoints.Campaigns;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DragonsGenerator.API.Endpoints.Support;

public class PostTicketMessageEndpoint(
    AppDbContext db,
    SupportDeskService desk,
    IOptionsMonitor<SmtpOptions> smtp,
    ILogger<PostTicketMessageEndpoint> logger)
    : EndpointWithoutRequest<TicketMessageDto>
{
    public override void Configure()
    {
        Post("/support/tickets/{id}/messages");
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

        string body;
        Guid? jsonCharacterId = null;
        Guid? jsonCampaignId = null;
        if (HttpContext.Request.HasFormContentType)
        {
            body = HttpContext.Request.Form["body"].ToString();
        }
        else
        {
            var req = await HttpContext.Request.ReadFromJsonAsync<PostTicketMessageRequest>(ct);
            body = req?.Body ?? "";
            jsonCharacterId = req?.CharacterId;
            jsonCampaignId = req?.CampaignId;
        }
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
        var parsedCharId = Guid.Empty;
        var hasChar = !string.IsNullOrWhiteSpace(characterRaw) && Guid.TryParse(characterRaw, out parsedCharId);
        if (!hasChar && jsonCharacterId is Guid jsonChar)
        {
            parsedCharId = jsonChar;
            hasChar = true;
        }
        if (hasChar)
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

        Guid? campaignId = null;
        string? campaignName = null;
        var campaignRaw = HttpContext.Request.HasFormContentType
            ? HttpContext.Request.Form["campaignId"].ToString().Trim()
            : "";
        var parsedCampId = Guid.Empty;
        var hasCamp = !string.IsNullOrWhiteSpace(campaignRaw) && Guid.TryParse(campaignRaw, out parsedCampId);
        if (!hasCamp && jsonCampaignId is Guid jsonCamp)
        {
            parsedCampId = jsonCamp;
            hasCamp = true;
        }
        if (hasCamp)
        {
            var attachUserId = isAdmin ? ticket.UserId : userId.Value;
            var (cid, cname, campError) = await CampaignAccess.ResolveAttachableAsync(
                db, attachUserId, parsedCampId, ct);
            if (campError is not null)
            {
                AddError(campError);
                await Send.ErrorsAsync(cancellation: ct);
                return;
            }
            campaignId = cid;
            campaignName = cname;
        }

        var msg = new SupportTicketMessage
        {
            TicketId = ticket.Id,
            AuthorUserId = userId.Value,
            FromStaff = isAdmin,
            Body = body.Length > 8000 ? body[..8000] : body,
            CharacterId = characterId,
            CharacterName = characterName,
            CampaignId = campaignId,
            CampaignName = campaignName,
            AttachmentStoredName = stored,
            AttachmentOriginalName = original,
        };
        db.SupportTicketMessages.Add(msg);
        ticket.UpdatedAt = DateTimeOffset.UtcNow;
        if (isAdmin && ticket.Status == "open")
            ticket.Status = "in_progress";
        await db.SaveChangesAsync(ct);

        var notifyEmail = true;
        if (HttpContext.Request.HasFormContentType)
        {
            var raw = HttpContext.Request.Form["notifyEmail"].ToString().Trim();
            if (raw.Equals("false", StringComparison.OrdinalIgnoreCase) || raw == "0")
                notifyEmail = false;
        }

        var emailSent = true;
        if (isAdmin && notifyEmail)
        {
            if (smtp.CurrentValue.IsSink)
            {
                emailSent = false;
                logger.LogError("SMTP reply skipped: Smtp__Host is a log sink (ticket {TicketId})", ticket.Id);
            }
            else
            {
                try
                {
                    await desk.NotifyReplyAsync(ticket, ticket.User.Email, ticket.User.DisplayName, msg.Body, ct);
                }
                catch (Exception ex)
                {
                    emailSent = false;
                    logger.LogError(ex, "SMTP reply failed for ticket {TicketId}", ticket.Id);
                }
            }
        }
        else if (!isAdmin)
            await desk.NotifyNewTicketAsync(ticket, ticket.User.Email, ct, msg.Body);

        await Send.OkAsync(
            new TicketMessageDto(
                msg.Id,
                msg.FromStaff,
                msg.Body,
                msg.CreatedAt,
                msg.CharacterId,
                msg.CharacterName,
                msg.AttachmentOriginalName,
                msg.CampaignId,
                msg.CampaignName,
                emailSent),
            ct);
    }
}
