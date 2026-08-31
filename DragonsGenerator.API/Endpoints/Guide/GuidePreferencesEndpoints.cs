using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Guide;

public record GuidePreferencesDto(string[] ReadNewsIds, string[] ReadSectionIds, string? Audience);

public record UpdateGuidePreferencesRequest(string[] ReadNewsIds, string[] ReadSectionIds, string? Audience);

public class GetGuidePreferencesEndpoint(AppDbContext db) : EndpointWithoutRequest<GuidePreferencesDto>
{
    public override void Configure() => Get("/me/guide-preferences");

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

        await Send.OkAsync(
            new GuidePreferencesDto(
                UserPreferencesHelper.GetReadNewsIds(user),
                UserPreferencesHelper.GetReadSectionIds(user),
                UserPreferencesHelper.GetGuideAudience(user)
            ),
            ct
        );
    }
}

public class UpdateGuidePreferencesEndpoint(AppDbContext db)
    : Endpoint<UpdateGuidePreferencesRequest, GuidePreferencesDto>
{
    public override void Configure() => Put("/me/guide-preferences");

    public override async Task HandleAsync(UpdateGuidePreferencesRequest req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var newsIds = UserPreferencesHelper.NormalizeReadNewsIds(req.ReadNewsIds, out var newsError);
        if (newsError is not null)
        {
            AddError(newsError);
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        var sectionIds = UserPreferencesHelper.NormalizeReadSectionIds(req.ReadSectionIds, out var sectionError);
        if (sectionError is not null)
        {
            AddError(sectionError);
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        var audience = UserPreferencesHelper.NormalizeGuideAudience(req.Audience, out var audError);
        if (audError is not null || (req.Audience is not null && audience is null))
        {
            AddError("Audience guide invalide.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        UserPreferencesHelper.ApplyGuidePreferences(user, newsIds, sectionIds, audience);
        await db.SaveChangesAsync(ct);
        await Send.OkAsync(new GuidePreferencesDto(newsIds, sectionIds, audience), ct);
    }
}
