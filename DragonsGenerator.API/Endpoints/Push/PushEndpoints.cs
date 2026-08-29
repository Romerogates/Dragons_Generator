using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DragonsGenerator.API.Endpoints.Push;

public record PushConfigDto(string? PublicKey);
public record RegisterPushBody(string Endpoint, string P256dh, string Auth);

public class GetPushConfigEndpoint(IOptions<VapidOptions> vapid) : EndpointWithoutRequest<PushConfigDto>
{
    public override void Configure()
    {
        Get("/push/config");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var key = string.IsNullOrWhiteSpace(vapid.Value.PublicKey) ? null : vapid.Value.PublicKey.Trim();
        await Send.OkAsync(new PushConfigDto(key), ct);
    }
}

public class RegisterPushSubscriptionEndpoint(AppDbContext db) : Endpoint<RegisterPushBody>
{
    public override void Configure() => Post("/me/push-subscriptions");

    public override async Task HandleAsync(RegisterPushBody req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var endpoint = (req.Endpoint ?? "").Trim();
        var p256dh = (req.P256dh ?? "").Trim();
        var auth = (req.Auth ?? "").Trim();
        if (endpoint.Length < 8 || p256dh.Length < 8 || auth.Length < 8)
        {
            AddError("Abonnement push invalide.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        var existing = await db.PushSubscriptions.FirstOrDefaultAsync(
            s => s.UserId == userId && s.Endpoint == endpoint, ct);
        if (existing is null)
        {
            db.PushSubscriptions.Add(new PushSubscription
            {
                UserId = userId.Value,
                Endpoint = endpoint,
                P256dh = p256dh,
                Auth = auth,
            });
        }
        else
        {
            existing.P256dh = p256dh;
            existing.Auth = auth;
        }

        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}

public class DeletePushSubscriptionEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Delete("/me/push-subscriptions");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var endpoint = (Query<string>("endpoint", false) ?? "").Trim();
        if (string.IsNullOrEmpty(endpoint))
        {
            AddError("Endpoint requis.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        var sub = await db.PushSubscriptions.FirstOrDefaultAsync(
            s => s.UserId == userId && s.Endpoint == endpoint, ct);
        if (sub is not null)
        {
            db.PushSubscriptions.Remove(sub);
            await db.SaveChangesAsync(ct);
        }

        await Send.NoContentAsync(ct);
    }
}
