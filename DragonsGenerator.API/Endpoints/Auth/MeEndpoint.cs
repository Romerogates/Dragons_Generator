using System.Security.Claims;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DragonsGenerator.API.Endpoints.Auth;


public class MeEndpoint(AppDbContext db) : EndpointWithoutRequest<UserDto>
{
    public override void Configure()
    {
        Get("/auth/me");
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var id = AuthHelpers.GetUserId(User);
        if (id is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }
        await Send.OkAsync(
            UserProfileHelper.ToUserDto(user),
            ct
        );
    }
}
