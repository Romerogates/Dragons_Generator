using System.Security.Claims;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DragonsGenerator.API.Endpoints.Auth;


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
                AuthEmailTemplates.PasswordReset(user.DisplayName, link),
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
