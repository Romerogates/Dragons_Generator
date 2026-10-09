using System.Security.Claims;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DragonsGenerator.API.Endpoints.Auth;


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
