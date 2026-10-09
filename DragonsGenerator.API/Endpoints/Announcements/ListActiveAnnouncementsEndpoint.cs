using DragonsGenerator.API.Persistence;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Announcements;

/// <summary>Bannière site : public (incident visible même déconnecté).</summary>
public class ListActiveAnnouncementsEndpoint(AppDbContext db)
    : EndpointWithoutRequest<List<SiteAnnouncementDto>>
{
    public override void Configure()
    {
        Get("/announcements/active");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var active = await SiteAnnouncementMapping.LoadActiveAsync(db, now, ct);
        await Send.OkAsync(active.Select(a => SiteAnnouncementMapping.ToDto(a, now)).ToList(), ct);
    }
}
