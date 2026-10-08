using System.Security.Cryptography;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DragonsGenerator.API.Endpoints.Auth;

public record AuthProvidersResponse(string? GoogleClientId);

public record GoogleLoginRequest(string IdToken, bool AcceptTerms = false, string? DisplayName = null);

public class AuthProvidersEndpoint(GoogleIdTokenValidator google) : EndpointWithoutRequest<AuthProvidersResponse>
{
    public override void Configure()
    {
        Get("/auth/providers");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct) =>
        await Send.OkAsync(new AuthProvidersResponse(google.ClientId), ct);
}

public class GoogleLoginEndpoint(
    AppDbContext db,
    GoogleIdTokenValidator google,
    IOptions<JwtOptions> jwt,
    IHostEnvironment env
) : Endpoint<GoogleLoginRequest, AuthResponse>
{
    public override void Configure()
    {
        Post("/auth/google");
        AllowAnonymous();
        Options(b => b.RequireRateLimiting(RateLimitPolicies.Auth));
    }

    public override async Task HandleAsync(GoogleLoginRequest req, CancellationToken ct)
    {
        if (!google.IsConfigured)
        {
            AddError("Connexion Google non configurée (Google__ClientId).");
            await Send.ErrorsAsync(StatusCodes.Status503ServiceUnavailable, ct);
            return;
        }

        var profile = await google.ValidateAsync(req.IdToken ?? "", ct);
        if (profile is null)
        {
            AddError("Jeton Google invalide.");
            await Send.ErrorsAsync(StatusCodes.Status401Unauthorized, ct);
            return;
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.GoogleSubject == profile.Subject, ct)
            ?? await db.Users.FirstOrDefaultAsync(u => u.Email == profile.Email, ct);

        if (user is null)
        {
            if (!req.AcceptTerms)
            {
                AddError("google_register_required");
                await Send.ErrorsAsync(StatusCodes.Status403Forbidden, ct);
                return;
            }

            var display = (req.DisplayName ?? "").Trim();
            if (display.Length == 0)
            {
                AddError("Choisissez un pseudo (pas de mot de passe avec Google).");
                await Send.ErrorsAsync(cancellation: ct);
                return;
            }
            if (!AuthHelpers.TryNormalizeDisplayName(display, out var normalized, out var nameError))
            {
                AddError(nameError ?? "Pseudo invalide.");
                await Send.ErrorsAsync(cancellation: ct);
                return;
            }

            if (await AuthHelpers.IsDisplayNameTakenAsync(db, normalized, null, ct))
                normalized = $"{normalized[..Math.Min(normalized.Length, 52)]}-{RandomNumberGenerator.GetInt32(1000, 9999)}";

            user = new AppUser
            {
                Email = profile.Email,
                PasswordHash = AuthHelpers.HashPassword(Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))),
                DisplayName = normalized,
                EmailConfirmed = true,
                GoogleSubject = profile.Subject,
                AcceptedTermsAt = DateTimeOffset.UtcNow,
                LastLoginAt = DateTimeOffset.UtcNow,
            };
            db.Users.Add(user);
        }
        else
        {
            user.GoogleSubject ??= profile.Subject;
            if (!user.EmailConfirmed)
                user.EmailConfirmed = true;
            user.LastLoginAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        var token = AuthHelpers.CreateJwt(user, jwt.Value);
        AuthCookieHelper.SetAuthCookie(HttpContext.Response, token, jwt.Value, env.IsProduction());
        await Send.OkAsync(new AuthResponse(null, UserProfileHelper.ToUserDto(user)), ct);
    }
}
