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
