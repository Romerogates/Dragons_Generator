using DragonsGenerator.API.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Services;

/// <summary>Rappels push 24 h et 1 h avant les sessions planifiées.</summary>
public sealed class SessionReminderWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<SessionReminderWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(45), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessRemindersAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Session reminder pass failed");
            }

            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
        }
    }

    private async Task ProcessRemindersAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var push = scope.ServiceProvider.GetRequiredService<PushNotificationService>();
        if (!push.IsConfigured) return;

        var now = DateTimeOffset.UtcNow;
        var campaigns = await db.Campaigns.AsNoTracking()
            .Include(c => c.Members)
            .ToListAsync(ct);

        var pendingLogs = new List<SessionReminderLog>();

        foreach (var campaign in campaigns)
        {
            var sessions = CampaignJsonHelpers.ListUpcomingPlannedSessions(campaign.JsonData, now);
            if (sessions.Count == 0) continue;

            var memberIds = campaign.Members.Select(m => m.UserId).Distinct().ToList();
            if (!memberIds.Contains(campaign.OwnerUserId))
                memberIds.Add(campaign.OwnerUserId);

            foreach (var session in sessions)
            {
                foreach (var kind in new[] { SessionReminderRules.Kind24Hours, SessionReminderRules.Kind1Hour })
                {
                    if (!SessionReminderRules.ShouldSend(session.ScheduledAt, now, kind)) continue;

                    foreach (var userId in memberIds)
                    {
                        var alreadySent = await db.SessionReminderLogs.AsNoTracking()
                            .AnyAsync(
                                l => l.CampaignId == campaign.Id
                                    && l.SessionId == session.Id
                                    && l.UserId == userId
                                    && l.ReminderKind == kind,
                                ct);
                        if (alreadySent) continue;

                        var (title, body) = SessionReminderRules.BuildMessage(session, kind);
                        var url = $"/campaigns/{campaign.Id}";
                        await push.NotifyUserAsync(userId, title, body, url, ct);

                        pendingLogs.Add(new SessionReminderLog
                        {
                            CampaignId = campaign.Id,
                            SessionId = session.Id,
                            UserId = userId,
                            ReminderKind = kind,
                            SentAt = now,
                        });
                    }
                }
            }
        }

        if (pendingLogs.Count == 0) return;

        db.SessionReminderLogs.AddRange(pendingLogs);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Sent {Count} session reminder push(es)", pendingLogs.Count);
    }
}
