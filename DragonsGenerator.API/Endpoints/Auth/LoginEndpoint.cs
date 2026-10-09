using System.Security.Claims;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DragonsGenerator.API.Endpoints.Auth;


public class LoginEndpoint(AppDbContext db, IOptions<JwtOptions> jwt, IHostEnvironment env)
    : Endpoint<LoginRequest, AuthResponse>
{
    public override void Configure()
    {
        Post("/auth/login");
        AllowAnonymous();
        Options(b => b.RequireRateLimiting(RateLimitPolicies.Auth));
    }

    public override async Task HandleAsync(LoginRequest req, CancellationToken ct)
    {
        var email = (req.Email ?? "").Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
        if (user is null || !AuthHelpers.VerifyPassword(req.Password ?? "", user.PasswordHash))
        {
            AddError("Email ou mot de passe incorrect.");
            await Send.ErrorsAsync(StatusCodes.Status401Unauthorized, ct);
            return;
        }
        if (!user.EmailConfirmed)
        {
            AddError("email_not_confirmed");
            await Send.ErrorsAsync(StatusCodes.Status403Forbidden, ct);
            return;
        }
        if (user.Disabled)
        {
            AddError("account_disabled");
            await Send.ErrorsAsync(StatusCodes.Status403Forbidden, ct);
            return;
        }

        user.LastLoginAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        var token = AuthHelpers.CreateJwt(user, jwt.Value);
        AuthCookieHelper.SetAuthCookie(HttpContext.Response, token, jwt.Value, env.IsProduction());
        await Send.OkAsync(
            new AuthResponse(
                null,
                UserProfileHelper.ToUserDto(user)
            ),
            ct
        );
    }
}
