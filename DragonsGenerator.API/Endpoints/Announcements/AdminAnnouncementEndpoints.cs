using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Announcements;

public class AdminListAnnouncementsEndpoint(AppDbContext db)
    : EndpointWithoutRequest<List<SiteAnnouncementDto>>
{
    public override void Configure()
    {
        Get("/admin/announcements");
        Roles(AppRoles.Admin);
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var all = await db.SiteAnnouncements.AsNoTracking().ToListAsync(ct);
        await Send.OkAsync(
            all.OrderByDescending(a => a.CreatedAt)
                .Take(50)
                .Select(a => SiteAnnouncementMapping.ToDto(a, now))
                .ToList(),
            ct);
    }
}

public class AdminCreateAnnouncementEndpoint(AppDbContext db)
    : Endpoint<CreateSiteAnnouncementRequest, SiteAnnouncementDto>
{
    public override void Configure()
    {
        Post("/admin/announcements");
        Roles(AppRoles.Admin);
    }

    public override async Task HandleAsync(CreateSiteAnnouncementRequest req, CancellationToken ct)
    {
        var message = (req.Message ?? "").Trim();
        if (message.Length < 3 || message.Length > SiteAnnouncementLimits.MessageMax)
        {
            AddError($"Le message doit faire entre 3 et {SiteAnnouncementLimits.MessageMax} caractères.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        var severity = string.IsNullOrWhiteSpace(req.Severity)
            ? SiteAnnouncementSeverities.Info
            : req.Severity.Trim().ToLowerInvariant();
        if (!SiteAnnouncementSeverities.IsValid(severity))
        {
            AddError("Type d’annonce inconnu (info, warning ou outage).");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        var days = req.DurationDays ?? SiteAnnouncementLimits.MinDays;
        if (days < SiteAnnouncementLimits.MinDays || days > SiteAnnouncementLimits.MaxDays)
        {
            AddError($"Durée entre {SiteAnnouncementLimits.MinDays} et {SiteAnnouncementLimits.MaxDays} jours.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        var title = (req.Title ?? "").Trim();
        if (title.Length > SiteAnnouncementLimits.TitleMax)
            title = title[..SiteAnnouncementLimits.TitleMax];
        if (title.Length == 0)
            title = SiteAnnouncementMapping.DefaultTitle(severity);

        var now = DateTimeOffset.UtcNow;
        var row = new SiteAnnouncement
        {
            Title = title,
            Message = message,
            Severity = severity,
            StartsAt = now,
            EndsAt = now.AddDays(days),
            CreatedByUserId = AuthHelpers.GetUserId(User),
            CreatedAt = now,
        };
        db.SiteAnnouncements.Add(row);
        await db.SaveChangesAsync(ct);

        await Send.OkAsync(SiteAnnouncementMapping.ToDto(row, now), ct);
    }
}

public class AdminEndAnnouncementEndpoint(AppDbContext db) : EndpointWithoutRequest<SiteAnnouncementDto>
{
    public override void Configure()
    {
        Post("/admin/announcements/{id}/end");
        Roles(AppRoles.Admin);
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var id = Route<Guid>("id");
        var row = await db.SiteAnnouncements.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (row is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var now = DateTimeOffset.UtcNow;
        if (row.EndsAt > now)
        {
            row.EndsAt = now;
            await db.SaveChangesAsync(ct);
        }

        await Send.OkAsync(SiteAnnouncementMapping.ToDto(row, now), ct);
    }
}

public class AdminDeleteAnnouncementEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure()
    {
        Delete("/admin/announcements/{id}");
        Roles(AppRoles.Admin);
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var id = Route<Guid>("id");
        var row = await db.SiteAnnouncements.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (row is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        db.SiteAnnouncements.Remove(row);
        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
