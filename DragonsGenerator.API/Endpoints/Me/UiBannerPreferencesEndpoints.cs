using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Me;

public record UiBannerPreferencesDto(bool HideAllBanners, string[] DismissedBannerIds);

public record UpdateUiBannerPreferencesRequest(bool HideAllBanners, string[]? DismissedBannerIds);

public class GetUiBannerPreferencesEndpoint(AppDbContext db) : EndpointWithoutRequest<UiBannerPreferencesDto>
{
    public override void Configure() => Get("/me/ui-banner-preferences");

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
            new UiBannerPreferencesDto(
                UserPreferencesHelper.GetHideAllBanners(user),
                UserPreferencesHelper.GetDismissedBannerIds(user)
            ),
            ct
        );
    }
}

public class UpdateUiBannerPreferencesEndpoint(AppDbContext db)
    : Endpoint<UpdateUiBannerPreferencesRequest, UiBannerPreferencesDto>
{
    public override void Configure() => Put("/me/ui-banner-preferences");

    public override async Task HandleAsync(UpdateUiBannerPreferencesRequest req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var dismissed = UserPreferencesHelper.NormalizeDismissedBannerIds(
            req.DismissedBannerIds,
            out var dismissError
        );
        if (dismissError is not null)
        {
            AddError(dismissError);
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        UserPreferencesHelper.ApplyUiBannerPreferences(user, req.HideAllBanners, dismissed);
        await db.SaveChangesAsync(ct);
        await Send.OkAsync(new UiBannerPreferencesDto(req.HideAllBanners, dismissed), ct);
    }
}
