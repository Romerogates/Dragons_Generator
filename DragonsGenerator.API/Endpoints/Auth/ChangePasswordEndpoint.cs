using System.Security.Claims;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DragonsGenerator.API.Endpoints.Auth;


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

        var googleAccount = !string.IsNullOrWhiteSpace(user.GoogleSubject);
        var current = req.CurrentPassword ?? "";
        var skipCurrent = googleAccount && string.IsNullOrWhiteSpace(current);
        if (!skipCurrent && !AuthHelpers.VerifyPassword(current, user.PasswordHash))
        {
            AddError("Mot de passe actuel incorrect.");
            await Send.ErrorsAsync(StatusCodes.Status401Unauthorized, ct);
            return;
        }

        user.PasswordHash = AuthHelpers.HashPassword(req.NewPassword);
        await db.SaveChangesAsync(ct);
        var message = skipCurrent
            ? "Mot de passe enregistré. Vous pouvez aussi vous connecter avec votre email."
            : "Mot de passe mis à jour.";
        await Send.OkAsync(new { message }, ct);
    }
}
