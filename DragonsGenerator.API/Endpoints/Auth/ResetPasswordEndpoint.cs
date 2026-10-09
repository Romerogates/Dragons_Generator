using System.Security.Claims;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DragonsGenerator.API.Endpoints.Auth;


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
