using System.Text.Json;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Gdpr;

public record DeleteAccountRequest(string CurrentPassword);

public class ExportMyDataEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Get("/me/export");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var characters = await db.Characters
            .AsNoTracking()
            .Where(c => c.UserId == userId)
            .Select(c => new
            {
                c.Id,
                c.Name,
                data = c.JsonData,
                c.CreatedAt,
                c.UpdatedAt,
            })
            .ToListAsync(ct);

        var ownedCampaigns = await db.Campaigns
            .AsNoTracking()
            .Where(c => c.OwnerUserId == userId)
            .Select(c => new
            {
                c.Id,
                c.Title,
                data = c.JsonData,
                c.CreatedAt,
                c.UpdatedAt,
            })
            .ToListAsync(ct);

        var memberships = await db.CampaignMembers
            .AsNoTracking()
            .Where(m => m.UserId == userId)
            .Select(m => new
            {
                m.Id,
                m.CampaignId,
                campaignTitle = m.Campaign.Title,
                m.Role,
                m.ApprovedCharacterId,
                m.ApprovedCharacterName,
                m.ApprovedCharacterLevel,
                m.ProposedCharacterId,
                m.ProposedCharacterName,
                m.ProposedCharacterLevel,
                m.ProposalStatus,
                m.XpEarnedInCampaign,
                m.JoinedAt,
            })
            .ToListAsync(ct);

        var friendships = await db.Friendships
            .AsNoTracking()
            .Where(f => f.RequesterId == userId || f.AddresseeId == userId)
            .Select(f => new
            {
                f.Id,
                f.RequesterId,
                f.AddresseeId,
                f.Status,
                f.CreatedAt,
            })
            .ToListAsync(ct);

        var campaignInvites = await db.CampaignInvites
            .AsNoTracking()
            .Where(i => i.InvitedUserId == userId)
            .Select(i => new
            {
                i.Id,
                i.CampaignId,
                campaignTitle = i.Campaign.Title,
                i.InvitedByUserId,
                i.Status,
                i.CreatedAt,
            })
            .ToListAsync(ct);

        var supportTickets = await db.SupportTickets
            .AsNoTracking()
            .Where(t => t.UserId == userId)
            .Select(t => new
            {
                t.Id,
                t.Subject,
                t.Message,
                t.Status,
                t.AttachmentOriginalName,
                t.CharacterId,
                t.CharacterName,
                t.AdminNotes,
                t.CreatedAt,
            })
            .ToListAsync(ct);

        var payload = new
        {
            exportedAt = DateTimeOffset.UtcNow,
            privacyPolicyUrl = "https://dragons-generator.top/legal/privacy",
            user = new
            {
                user.Id,
                user.Email,
                user.DisplayName,
                user.Role,
                user.EmailConfirmed,
                user.Bio,
                user.AvatarEmoji,
                user.AccentColor,
                user.CreatedAt,
                user.LastLoginAt,
            user.AcceptedTermsAt,
            guidePreferences = UserPreferencesHelper.GetGuidePreferencesExport(user),
        },
            characters,
            ownedCampaigns,
            campaignMemberships = memberships,
            friendships,
            campaignInvitesReceived = campaignInvites,
            supportTickets,
            localDeviceNote =
                "Les brouillons et caches stockés uniquement dans le navigateur (localStorage) ne sont pas inclus dans cet export serveur.",
        };

        var json = JsonSerializer.Serialize(
            payload,
            new JsonSerializerOptions { WriteIndented = true }
        );
        var fileName = $"dragons-generator-export-{DateTime.UtcNow:yyyyMMdd}.json";
        HttpContext.Response.Headers.ContentDisposition = $"attachment; filename=\"{fileName}\"";
        HttpContext.Response.ContentType = "application/json; charset=utf-8";
        await HttpContext.Response.WriteAsync(json, ct);
    }
}

public class DeleteAccountEndpoint(AppDbContext db, IHostEnvironment env, ILogger<DeleteAccountEndpoint> logger)
    : Endpoint<DeleteAccountRequest>
{
    public override void Configure() => Delete("/auth/me");

    public override async Task HandleAsync(DeleteAccountRequest req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        if (!AuthHelpers.VerifyPassword(req.CurrentPassword ?? "", user.PasswordHash))
        {
            AddError("Mot de passe incorrect.");
            await Send.ErrorsAsync(StatusCodes.Status401Unauthorized, ct);
            return;
        }

        if (user.Role == AppRoles.Admin)
        {
            var adminCount = await db.Users.CountAsync(u => u.Role == AppRoles.Admin, ct);
            if (adminCount <= 1)
            {
                AddError("Impossible de supprimer le dernier compte administrateur.");
                await Send.ErrorsAsync(cancellation: ct);
                return;
            }
        }

        var tickets = await db.SupportTickets
            .Where(t => t.UserId == userId)
            .ToListAsync(ct);
        UserDataCleanup.DeleteTicketAttachments(tickets, logger);

        db.Users.Remove(user);
        await db.SaveChangesAsync(ct);
        AuthCookieHelper.ClearAuthCookie(HttpContext.Response, env.IsProduction());
        await Send.NoContentAsync(ct);
    }
}

internal static class UserDataCleanup
{
    internal static void DeleteTicketAttachments(
        IEnumerable<SupportTicket> tickets,
        ILogger logger
    )
    {
        var dir = Path.Combine(AppContext.BaseDirectory, "data", "uploads", "tickets");
        foreach (var ticket in tickets)
        {
            if (string.IsNullOrWhiteSpace(ticket.AttachmentStoredName))
                continue;
            var stored = Path.GetFileName(ticket.AttachmentStoredName);
            var path = Path.Combine(dir, stored);
            try
            {
                if (File.Exists(path))
                    File.Delete(path);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Impossible de supprimer la pièce jointe {File}", stored);
            }
        }
    }
}
