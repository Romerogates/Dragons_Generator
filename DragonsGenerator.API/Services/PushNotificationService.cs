using System.Text.Json;
using DragonsGenerator.API.Persistence;
using Lib.Net.Http.WebPush;
using Lib.Net.Http.WebPush.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace DragonsGenerator.API.Services;

public class PushNotificationService(
    AppDbContext db,
    IOptions<VapidOptions> vapidOpt,
    ILogger<PushNotificationService> logger)
{
    private readonly VapidOptions _vapid = vapidOpt.Value;
    private readonly PushServiceClient _client = new();

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_vapid.PublicKey) && !string.IsNullOrWhiteSpace(_vapid.PrivateKey);

    public string? PublicKey => IsConfigured ? _vapid.PublicKey : null;

    public async Task NotifyUserAsync(
        Guid userId,
        string title,
        string body,
        string? url = null,
        CancellationToken ct = default)
    {
        if (!IsConfigured) return;

        var subs = await db.PushSubscriptions.AsNoTracking()
            .Where(s => s.UserId == userId)
            .ToListAsync(ct);
        if (subs.Count == 0) return;

        var payload = JsonSerializer.Serialize(new { title, body, url });
        var auth = new VapidAuthentication(_vapid.PublicKey, _vapid.PrivateKey)
        {
            Subject = _vapid.Subject,
        };

        foreach (var sub in subs)
        {
            try
            {
                var pushSub = new PushSubscription(sub.Endpoint, sub.P256dh, sub.Auth);
                await _client.RequestPushMessageDeliveryAsync(
                    pushSub,
                    new PushMessage(payload),
                    auth,
                    cancellationToken: ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Push failed for user {UserId}", userId);
                if (ex.Message.Contains("410") || ex.Message.Contains("404"))
                {
                    var stale = await db.PushSubscriptions.FirstOrDefaultAsync(s => s.Id == sub.Id, ct);
                    if (stale is not null)
                    {
                        db.PushSubscriptions.Remove(stale);
                        await db.SaveChangesAsync(ct);
                    }
                }
            }
        }
    }
}
