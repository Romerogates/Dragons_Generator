using System.Security.Claims;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DragonsGenerator.API.Endpoints.Auth;


public class ConfirmEmailEndpoint(AppDbContext db, IOptions<JwtOptions> jwt, IHostEnvironment env)
    : EndpointWithoutRequest
{
    public override void Configure()
    {
        Get("/auth/confirm-email");
        AllowAnonymous();
        Options(b => b.RequireRateLimiting(RateLimitPolicies.Auth));
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var token = Query<string>("token", isRequired: false);
        if (string.IsNullOrWhiteSpace(token))
        {
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.EmailConfirmToken == token, ct);
        if (user is null)
        {
            AddError("Lien de confirmation invalide ou expiré.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        user.EmailConfirmed = true;
        user.EmailConfirmToken = null;
        user.LastLoginAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        var jwtToken = AuthHelpers.CreateJwt(user, jwt.Value);
        AuthCookieHelper.SetAuthCookie(HttpContext.Response, jwtToken, jwt.Value, env.IsProduction());
        await Send.OkAsync(
            new AuthResponse(null, UserProfileHelper.ToUserDto(user)),
            ct
        );
    }
}
