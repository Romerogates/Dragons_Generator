using DragonsGenerator.API.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Announcements;

public record SiteAnnouncementDto(
    Guid Id,
    string Title,
    string Message,
    string Severity,
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt,
    DateTimeOffset CreatedAt,
    bool Active
);

public record CreateSiteAnnouncementRequest(
    string? Title,
    string? Message,
    string? Severity,
    int? DurationDays
);

public static class SiteAnnouncementMapping
{
    public static SiteAnnouncementDto ToDto(SiteAnnouncement a, DateTimeOffset now) =>
        new(a.Id, a.Title, a.Message, a.Severity, a.StartsAt, a.EndsAt, a.CreatedAt, a.IsActiveAt(now));

    public static string DefaultTitle(string severity) => severity switch
    {
        SiteAnnouncementSeverities.Outage => "Incident en cours",
        SiteAnnouncementSeverities.Warning => "Attention",
        _ => "Information",
    };

    /// <summary>Incidents d’abord, puis les plus récentes. SQLite ne compare pas les DateTimeOffset en SQL.</summary>
    public static async Task<List<SiteAnnouncement>> LoadActiveAsync(
        AppDbContext db,
        DateTimeOffset now,
        CancellationToken ct)
    {
        var all = await db.SiteAnnouncements.AsNoTracking().ToListAsync(ct);
        return all
            .Where(a => a.IsActiveAt(now))
            .OrderBy(a => SeverityRank(a.Severity))
            .ThenByDescending(a => a.StartsAt)
            .ToList();
    }

    private static int SeverityRank(string severity) => severity switch
    {
        SiteAnnouncementSeverities.Outage => 0,
        SiteAnnouncementSeverities.Warning => 1,
        _ => 2,
    };
}
