using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Guide;

public record GuidePreferencesDto(string[] ReadNewsIds);

public record UpdateGuidePreferencesRequest(string[] ReadNewsIds);

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

        await Send.OkAsync(new GuidePreferencesDto(UserPreferencesHelper.GetReadNewsIds(user)), ct);
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

        var ids = UserPreferencesHelper.NormalizeReadNewsIds(req.ReadNewsIds, out var error);
        if (error is not null)
        {
            AddError(error);
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        UserPreferencesHelper.ApplyReadNewsIds(user, ids);
        await db.SaveChangesAsync(ct);
        await Send.OkAsync(new GuidePreferencesDto(ids), ct);
    }
}
