using DragonsGenerator.API.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Services;

/// <summary>Rappels push 24 h et 1 h avant sessions planifiées et dates de calendrier.</summary>
public sealed class SessionReminderWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<SessionReminderWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(90), stoppingToken);

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
            .Select(c => new { c.Id, c.OwnerUserId, c.JsonData })
            .ToListAsync(ct);

        var due = new List<(Guid Id, Guid OwnerUserId, List<PlannedSessionInfo> Upcoming)>();
        foreach (var campaign in campaigns)
        {
            var upcoming = CampaignJsonHelpers.ListUpcomingPlannedSessions(campaign.JsonData, now)
                .Concat(CampaignJsonHelpers.ListUpcomingScheduleEvents(campaign.JsonData, now))
                .ToList();
            if (upcoming.Count == 0) continue;
            due.Add((campaign.Id, campaign.OwnerUserId, upcoming));
        }

        var campaignIds = due.Select(c => c.Id).ToList();
        var sentKeys = campaignIds.Count == 0
            ? new HashSet<string>(StringComparer.Ordinal)
            : (await db.SessionReminderLogs.AsNoTracking()
                    .Where(l => campaignIds.Contains(l.CampaignId))
                    .Select(l => new { l.CampaignId, l.SessionId, l.UserId, l.ReminderKind })
                    .ToListAsync(ct))
                .Select(l => $"{l.CampaignId}|{l.SessionId}|{l.UserId}|{l.ReminderKind}")
                .ToHashSet(StringComparer.Ordinal);

        var membersByCampaign = campaignIds.Count == 0
            ? new Dictionary<Guid, List<Guid>>()
            : (await db.CampaignMembers.AsNoTracking()
                    .Where(m => campaignIds.Contains(m.CampaignId))
                    .Select(m => new { m.CampaignId, m.UserId })
                    .ToListAsync(ct))
                .GroupBy(m => m.CampaignId)
                .ToDictionary(g => g.Key, g => g.Select(x => x.UserId).Distinct().ToList());

        var pendingLogs = new List<SessionReminderLog>();

        foreach (var campaign in due)
        {
            var upcoming = campaign.Upcoming;
            var memberIds = membersByCampaign.GetValueOrDefault(campaign.Id, []);
            if (!memberIds.Contains(campaign.OwnerUserId))
                memberIds = [.. memberIds, campaign.OwnerUserId];

            foreach (var item in upcoming)
            {
                var isSchedule = item.Id.StartsWith("sched:", StringComparison.Ordinal);
                foreach (var kind in new[] { SessionReminderRules.Kind24Hours, SessionReminderRules.Kind1Hour })
                {
                    if (!SessionReminderRules.ShouldSend(item.ScheduledAt, now, kind)) continue;

                    foreach (var userId in memberIds)
                    {
                        var alreadySent = sentKeys.Contains($"{campaign.Id}|{item.Id}|{userId}|{kind}");
                        if (alreadySent) continue;

                        var (title, body) = SessionReminderRules.BuildMessage(item, kind, isSchedule);
                        var url = isSchedule
                            ? $"/campaigns/{campaign.Id}?tab=calendar"
                            : $"/campaigns/{campaign.Id}?tab=sessions";
                        await push.NotifyUserAsync(userId, title, body, url, ct);

                        pendingLogs.Add(new SessionReminderLog
                        {
                            CampaignId = campaign.Id,
                            SessionId = item.Id,
                            UserId = userId,
                            ReminderKind = kind,
                            SentAt = now,
                        });
                        sentKeys.Add($"{campaign.Id}|{item.Id}|{userId}|{kind}");
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
