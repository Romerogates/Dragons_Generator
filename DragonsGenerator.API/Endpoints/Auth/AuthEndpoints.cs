using System.Security.Claims;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DragonsGenerator.API.Endpoints.Auth;

public record RegisterRequest(string Email, string Password, string? DisplayName);
public record LoginRequest(string Email, string Password);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Token, string NewPassword);
public record AuthResponse(string Token, UserDto User);
public record UserDto(Guid Id, string Email, string DisplayName, string Role, bool EmailConfirmed);

public class RegisterEndpoint(
    AppDbContext db,
    IEmailSender email,
    IOptions<AppUrlOptions> appUrl,
    ILogger<RegisterEndpoint> logger
) : Endpoint<RegisterRequest, object>
{
    public override void Configure()
    {
        Post("/auth/register");
        AllowAnonymous();
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
        if (await db.Users.AnyAsync(u => u.Email == emailAddr, ct))
        {
            AddError("Un compte existe déjà avec cet email.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        var token = AuthHelpers.NewToken();
        var user = new AppUser
        {
            Email = emailAddr,
            DisplayName = string.IsNullOrWhiteSpace(req.DisplayName)
                ? emailAddr.Split('@')[0]
                : req.DisplayName.Trim(),
            PasswordHash = AuthHelpers.HashPassword(req.Password),
            Role = AppRoles.User,
            EmailConfirmed = false,
            EmailConfirmToken = token,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        var link = $"{appUrl.Value.PublicWebUrl.TrimEnd('/')}/confirm-email?token={Uri.EscapeDataString(token)}";
        try
        {
            await email.SendAsync(
                user.Email,
                "Confirmez votre compte — Dragons Generator",
                $"""
                <h2>Bienvenue {user.DisplayName} !</h2>
                <p>Confirmez votre adresse email pour activer votre compte :</p>
                <p><a href="{link}">Confirmer mon compte</a></p>
                <p>Ou copiez ce lien :<br/><code>{link}</code></p>
                """,
                ct
            );
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Email de confirmation non envoyé");
        }

        await Send.OkAsync(
            new
            {
                message = "Compte créé. Vérifiez votre boîte mail pour confirmer l'adresse.",
                email = user.Email,
            },
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

public class LoginEndpoint(AppDbContext db, IOptions<JwtOptions> jwt) : Endpoint<LoginRequest, AuthResponse>
{
    public override void Configure()
    {
        Post("/auth/login");
        AllowAnonymous();
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
            AddError("Confirmez d'abord votre email (lien reçu à l'inscription).");
            await Send.ErrorsAsync(StatusCodes.Status403Forbidden, ct);
            return;
        }

        user.LastLoginAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        var token = AuthHelpers.CreateJwt(user, jwt.Value);
        await Send.OkAsync(
            new AuthResponse(
                token,
                new UserDto(user.Id, user.Email, user.DisplayName, user.Role, user.EmailConfirmed)
            ),
            ct
        );
    }
}

public class ForgotPasswordEndpoint(
    AppDbContext db,
    IEmailSender email,
    IOptions<AppUrlOptions> appUrl,
    ILogger<ForgotPasswordEndpoint> logger
) : Endpoint<ForgotPasswordRequest>
{
    public override void Configure()
    {
        Post("/auth/forgot-password");
        AllowAnonymous();
    }

    public override async Task HandleAsync(ForgotPasswordRequest req, CancellationToken ct)
    {
        // Réponse uniforme pour ne pas révéler si l'email existe
        var ok = new { message = "Si un compte existe, un email de réinitialisation a été envoyé." };
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

        var link =
            $"{appUrl.Value.PublicWebUrl.TrimEnd('/')}/reset-password?token={Uri.EscapeDataString(user.PasswordResetToken)}";
        try
        {
            await email.SendAsync(
                user.Email,
                "Réinitialisation du mot de passe — Dragons Generator",
                $"""
                <h2>Réinitialisation</h2>
                <p>Cliquez pour choisir un nouveau mot de passe (valable 2 h) :</p>
                <p><a href="{link}">Réinitialiser mon mot de passe</a></p>
                """,
                ct
            );
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Email reset non envoyé");
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
    }

    public override async Task HandleAsync(ResetPasswordRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.NewPassword) || req.NewPassword.Length < 8)
        {
            AddError("Mot de passe : 8 caractères minimum.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        var user = await db.Users.FirstOrDefaultAsync(
            u => u.PasswordResetToken == req.Token && u.PasswordResetExpires > DateTimeOffset.UtcNow,
            ct
        );
        if (user is null)
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
            new UserDto(user.Id, user.Email, user.DisplayName, user.Role, user.EmailConfirmed),
            ct
        );
    }
}
