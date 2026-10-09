using System.Security.Claims;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DragonsGenerator.API.Endpoints.Auth;


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
