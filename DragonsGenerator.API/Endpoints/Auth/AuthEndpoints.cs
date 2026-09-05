using System.Security.Claims;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DragonsGenerator.API.Endpoints.Auth;

public record RegisterRequest(
    string Email,
    string Password,
    string? DisplayName,
    string? WebUrl,
    bool AcceptTerms = false
);
public record LoginRequest(string Email, string Password);
public record ForgotPasswordRequest(string Email, string? WebUrl);
public record ResendConfirmationRequest(string Email, string? WebUrl);
public record ResetPasswordRequest(string Token, string NewPassword);
public record UpdateProfileRequest(string DisplayName, string? Bio, string? AvatarEmoji, string? AccentColor);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public record AuthResponse(string? Token, UserDto User);

internal static class AuthEmailHelper
{
    internal static async Task<(bool Sent, string Link)> SendConfirmationAsync(
        AppUser user,
        string? webUrl,
        AppUrlOptions appUrl,
        IEmailSender email,
        ILogger logger,
        bool allowRequestWebUrl,
        CancellationToken ct
    )
    {
        user.EmailConfirmToken = AuthHelpers.NewToken();
        var webBase = AuthHelpers.ResolveWebUrl(webUrl, appUrl.PublicWebUrl, allowRequestWebUrl);
        var link = $"{webBase}/confirm-email?token={Uri.EscapeDataString(user.EmailConfirmToken)}";
        try
        {
            await email.SendAsync(
                user.Email,
                "Confirmez votre compte — Dragons Generator",
                $"""
                <h2>Bonjour {user.DisplayName} !</h2>
                <p>Confirmez votre adresse email pour activer votre compte :</p>
                <p><a href="{link}">Confirmer mon compte</a></p>
                <p>Ou copiez ce lien :<br/><code>{link}</code></p>
                """,
                ct
            );
            return (true, link);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Email de confirmation non envoyé à {Email}", user.Email);
            return (false, link);
        }
    }

    internal static Dictionary<string, object?> BuildConfirmationResponse(
        AppUser user,
        bool emailSent,
        string link,
        string message,
        IHostEnvironment env,
        bool resent = false
    )
    {
        var response = new Dictionary<string, object?>
        {
            ["message"] = message,
            ["email"] = user.Email,
            ["emailSent"] = emailSent,
            ["resent"] = resent,
        };
        if (env.IsDevelopment())
        {
            response["confirmLink"] = link;
        }
        return response;
    }
}

public class RegisterEndpoint(
    AppDbContext db,
    IEmailSender email,
    IOptions<AppUrlOptions> appUrl,
    IHostEnvironment env,
    ILogger<RegisterEndpoint> logger
) : Endpoint<RegisterRequest, object>
{
    public override void Configure()
    {
        Post("/auth/register");
        AllowAnonymous();
        Options(b => b.RequireRateLimiting(RateLimitPolicies.Auth));
    }

    public override async Task HandleAsync(RegisterRequest req, CancellationToken ct)
    {
        var emailAddr = (req.Email ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(emailAddr) || !emailAddr.Contains('@'))
        {
            AddError("Email invalide.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }
        if (string.IsNullOrWhiteSpace(req.Password) || req.Password.Length < 8)
        {
            AddError("Mot de passe : 8 caractères minimum.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }
        if (!AuthHelpers.TryNormalizeDisplayName(req.DisplayName, out var displayName, out var nameError))
        {
            AddError(nameError!);
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }
        if (!req.AcceptTerms)
        {
            AddError("Vous devez accepter les conditions d'utilisation et la politique de confidentialité.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        var existing = await db.Users.FirstOrDefaultAsync(u => u.Email == emailAddr, ct);
        if (existing is not null)
        {
            if (existing.EmailConfirmed)
            {
                AddError("Un compte existe déjà. Connectez-vous ou utilisez « Mot de passe oublié ».");
                await Send.ErrorsAsync(cancellation: ct);
                return;
            }

            if (!AuthHelpers.VerifyPassword(req.Password, existing.PasswordHash))
            {
                AddError(
                    "Un compte non confirmé existe déjà avec cet email. Mot de passe incorrect — ou renvoyez la confirmation."
                );
                await Send.ErrorsAsync(cancellation: ct);
                return;
            }

            if (!string.IsNullOrWhiteSpace(req.DisplayName))
            {
                if (!AuthHelpers.TryNormalizeDisplayName(req.DisplayName, out var newName, out var renameError))
                {
                    AddError(renameError!);
                    await Send.ErrorsAsync(cancellation: ct);
                    return;
                }
                if (
                    !string.Equals(existing.DisplayName, newName, StringComparison.OrdinalIgnoreCase)
                    && await AuthHelpers.IsDisplayNameTakenAsync(db, newName, existing.Id, ct)
                )
                {
                    AddError("Ce pseudo est déjà pris.");
                    await Send.ErrorsAsync(cancellation: ct);
                    return;
                }
                existing.DisplayName = newName;
            }

            existing.AcceptedTermsAt = DateTimeOffset.UtcNow;

            var (emailSent, link) = await AuthEmailHelper.SendConfirmationAsync(
                existing,
                req.WebUrl,
                appUrl.Value,
                email,
                logger,
                env.IsDevelopment(),
                ct
            );
            await db.SaveChangesAsync(ct);

            await Send.OkAsync(
                AuthEmailHelper.BuildConfirmationResponse(
                    existing,
                    emailSent,
                    link,
                    emailSent
                        ? "Compte déjà créé. Un nouveau lien de confirmation a été envoyé."
                        : "Compte déjà créé. Utilisez le lien ci-dessous pour confirmer.",
                    env,
                    resent: true
                ),
                ct
            );
            return;
        }

        if (await AuthHelpers.IsDisplayNameTakenAsync(db, displayName, null, ct))
        {
            AddError("Ce pseudo est déjà pris.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        var user = new AppUser
        {
            Email = emailAddr,
            DisplayName = displayName,
            AccentColor = "violet",
            PasswordHash = AuthHelpers.HashPassword(req.Password),
            Role = AppRoles.User,
            EmailConfirmed = false,
            AcceptedTermsAt = DateTimeOffset.UtcNow,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        var (sent, confirmLink) = await AuthEmailHelper.SendConfirmationAsync(
            user,
            req.WebUrl,
            appUrl.Value,
            email,
            logger,
            env.IsDevelopment(),
            ct
        );
        await db.SaveChangesAsync(ct);

        await Send.OkAsync(
            AuthEmailHelper.BuildConfirmationResponse(
                user,
                sent,
                confirmLink,
                sent
                    ? "Compte créé. Vérifiez votre boîte mail pour confirmer l'adresse."
                    : "Compte créé, mais l'email n'a pas pu être envoyé. Utilisez le lien ci-dessous.",
                env
            ),
            ct
        );
    }
}

public class ConfirmEmailEndpoint(AppDbContext db) : EndpointWithoutRequest
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
        await db.SaveChangesAsync(ct);
        await Send.OkAsync(new { message = "Email confirmé. Vous pouvez vous connecter." }, ct);
    }
}

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

public class LogoutEndpoint(IHostEnvironment env) : EndpointWithoutRequest
{
    public override void Configure()
    {
        Post("/auth/logout");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        AuthCookieHelper.ClearAuthCookie(HttpContext.Response, env.IsProduction());
        await Send.NoContentAsync(ct);
    }
}

public class ForgotPasswordEndpoint(
    AppDbContext db,
    IEmailSender email,
    IOptions<AppUrlOptions> appUrl,
    IHostEnvironment env,
    ILogger<ForgotPasswordEndpoint> logger
) : Endpoint<ForgotPasswordRequest>
{
    public override void Configure()
    {
        Post("/auth/forgot-password");
        AllowAnonymous();
        Options(b => b.RequireRateLimiting(RateLimitPolicies.Auth));
    }

    public override async Task HandleAsync(ForgotPasswordRequest req, CancellationToken ct)
    {
        // Réponse uniforme pour ne pas révéler si l'email existe
        var ok = new Dictionary<string, object?>
        {
            ["message"] = "Si un compte existe, un email de réinitialisation a été envoyé.",
        };
        var emailAddr = (req.Email ?? "").Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == emailAddr, ct);
        if (user is null)
        {
            await Send.OkAsync(ok, ct);
            return;
        }

        user.PasswordResetToken = AuthHelpers.NewToken();
        user.PasswordResetExpires = DateTimeOffset.UtcNow.AddHours(2);
        await db.SaveChangesAsync(ct);

        var webBase = AuthHelpers.ResolveWebUrl(
            req.WebUrl,
            appUrl.Value.PublicWebUrl,
            env.IsDevelopment()
        );
        var link =
            $"{webBase}/reset-password?token={Uri.EscapeDataString(user.PasswordResetToken)}";
        try
        {
            await email.SendAsync(
                user.Email,
                "Réinitialisation du mot de passe — Dragons Generator",
                $"""
                <h2>Réinitialisation</h2>
                <p>Cliquez pour choisir un nouveau mot de passe (valable 2 h) :</p>
                <p><a href="{link}">Réinitialiser mon mot de passe</a></p>
                <p>Ou copiez ce lien :<br/><code>{link}</code></p>
                """,
                ct
            );
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "ForgotPassword : email reset non envoyé (réponse HTTP toujours 200 pour ne pas énumérer les comptes)");
        }

        if (env.IsDevelopment())
        {
            ok["resetLink"] = link;
        }

        await Send.OkAsync(ok, ct);
    }
}

public class ResetPasswordEndpoint(AppDbContext db) : Endpoint<ResetPasswordRequest>
{
    public override void Configure()
    {
        Post("/auth/reset-password");
        AllowAnonymous();
        Options(b => b.RequireRateLimiting(RateLimitPolicies.Auth));
    }

    public override async Task HandleAsync(ResetPasswordRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.NewPassword) || req.NewPassword.Length < 8)
        {
            AddError("Mot de passe : 8 caractères minimum.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        var token = (req.Token ?? "").Trim();
        if (token.Contains(' '))
            token = token.Replace(' ', '+');

        var user = await db.Users.FirstOrDefaultAsync(u => u.PasswordResetToken == token, ct);
        if (user is null || user.PasswordResetExpires is null || user.PasswordResetExpires <= DateTimeOffset.UtcNow)
        {
            AddError("Lien invalide ou expiré.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        user.PasswordHash = AuthHelpers.HashPassword(req.NewPassword);
        user.PasswordResetToken = null;
        user.PasswordResetExpires = null;
        user.EmailConfirmed = true;
        await db.SaveChangesAsync(ct);
        await Send.OkAsync(new { message = "Mot de passe mis à jour. Vous pouvez vous connecter." }, ct);
    }
}

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

public class ResendConfirmationEndpoint(
    AppDbContext db,
    IEmailSender email,
    IOptions<AppUrlOptions> appUrl,
    IHostEnvironment env,
    ILogger<ResendConfirmationEndpoint> logger
) : Endpoint<ResendConfirmationRequest, object>
{
    public override void Configure()
    {
        Post("/auth/resend-confirmation");
        AllowAnonymous();
        Options(b => b.RequireRateLimiting(RateLimitPolicies.Auth));
    }

    public override async Task HandleAsync(ResendConfirmationRequest req, CancellationToken ct)
    {
        var emailAddr = (req.Email ?? "").Trim().ToLowerInvariant();
        var generic = new Dictionary<string, object?>
        {
            ["message"] = "Si un compte non confirmé existe, un email a été renvoyé.",
        };

        if (string.IsNullOrWhiteSpace(emailAddr) || !emailAddr.Contains('@'))
        {
            await Send.OkAsync(generic, ct);
            return;
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == emailAddr, ct);
        if (user is null || user.EmailConfirmed)
        {
            await Send.OkAsync(generic, ct);
            return;
        }

        var (sent, link) = await AuthEmailHelper.SendConfirmationAsync(
            user,
            req.WebUrl,
            appUrl.Value,
            email,
            logger,
            env.IsDevelopment(),
            ct
        );
        await db.SaveChangesAsync(ct);

        var response = AuthEmailHelper.BuildConfirmationResponse(
            user,
            sent,
            link,
            sent ? "Un nouveau lien de confirmation a été envoyé." : "Utilisez le lien ci-dessous.",
            env,
            resent: true
        );
        await Send.OkAsync(response, ct);
    }
}

public class UpdateProfileEndpoint(AppDbContext db) : Endpoint<UpdateProfileRequest, UserDto>
{
    public override void Configure()
    {
        Patch("/auth/me");
    }

    public override async Task HandleAsync(UpdateProfileRequest req, CancellationToken ct)
    {
        var id = AuthHelpers.GetUserId(User);
        if (id is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var name = (req.DisplayName ?? "").Trim();
        if (!AuthHelpers.TryNormalizeDisplayName(name, out var normalized, out var nameError))
        {
            AddError(nameError!);
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        if (
            !string.Equals(user.DisplayName, normalized, StringComparison.OrdinalIgnoreCase)
            && await AuthHelpers.IsDisplayNameTakenAsync(db, normalized, user.Id, ct)
        )
        {
            AddError("Ce pseudo est déjà pris.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        user.DisplayName = normalized;

        if (!UserProfileHelper.TryNormalizeBio(req.Bio, out var bio, out var bioError))
        {
            AddError(bioError!);
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        if (!UserProfileHelper.TryNormalizeAvatarEmoji(req.AvatarEmoji, out var avatar, out var avatarError))
        {
            AddError(avatarError!);
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        user.Bio = bio;
        user.AvatarEmoji = avatar;
        user.AccentColor = UserProfileHelper.NormalizeAccentColor(req.AccentColor);

        await db.SaveChangesAsync(ct);
        await Send.OkAsync(UserProfileHelper.ToUserDto(user), ct);
    }
}

public class ChangePasswordEndpoint(AppDbContext db) : Endpoint<ChangePasswordRequest>
{
    public override void Configure()
    {
        Post("/auth/change-password");
    }

    public override async Task HandleAsync(ChangePasswordRequest req, CancellationToken ct)
    {
        var id = AuthHelpers.GetUserId(User);
        if (id is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        if (string.IsNullOrWhiteSpace(req.NewPassword) || req.NewPassword.Length < 8)
        {
            AddError("Nouveau mot de passe : 8 caractères minimum.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        if (!AuthHelpers.VerifyPassword(req.CurrentPassword ?? "", user.PasswordHash))
        {
            AddError("Mot de passe actuel incorrect.");
            await Send.ErrorsAsync(StatusCodes.Status401Unauthorized, ct);
            return;
        }

        user.PasswordHash = AuthHelpers.HashPassword(req.NewPassword);
        await db.SaveChangesAsync(ct);
        await Send.OkAsync(new { message = "Mot de passe mis à jour." }, ct);
    }
}
