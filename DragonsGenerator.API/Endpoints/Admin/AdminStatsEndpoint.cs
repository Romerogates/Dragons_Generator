using DragonsGenerator.API.Common;
using DragonsGenerator.API.Endpoints.Support;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Admin;

public record AdminStatsKindDto(string Kind, int Total, int Ok, long Tokens);

public record AdminStatsProviderDto(string Provider, int Total, int Ok, long Tokens);

public record AdminServerDto(
    string MachineName,
    string Framework,
    string OsDescription,
    string EnvironmentName,
    DateTimeOffset StartedAt,
    int UptimeSeconds,
    double CpuProcessPercent,
    int ThreadCount,
    int ProcessorCount,
    long WorkingSetBytes,
    long PrivateMemoryBytes,
    long GcHeapBytes,
    long? AvailableMemoryBytes,
    long? ContainerMemoryBytes,
    long? ContainerMemoryLimitBytes,
    long? HostMemoryTotalBytes,
    long? HostMemoryAvailableBytes,
    long? HostDiskTotalBytes,
    long? HostDiskAvailableBytes,
    double? Load1,
    double? Load5,
    double? Load15);

public record AdminHttpPathDto(string Path, int Count, int Errors, int AvgDurationMs);

public record AdminHttpRecentDto(string Method, string Path, int Status, int DurationMs, DateTimeOffset At);

public record AdminHttpDto(
    int RequestsSinceStart,
    int Status2xx,
    int Status4xx,
    int Status5xx,
    int InFlight,
    List<AdminHttpPathDto> TopPaths,
    List<AdminHttpRecentDto> Recent);

public record AdminSupportCategoryDto(string Category, int Total, int WaitingOnStaff);

public record AdminSupportDeskDto(
    int Open,
    int InProgress,
    int Closed,
    int WaitingOnStaff,
    int WaitingOnPlayer,
    int? OldestWaitingHours,
    List<AdminSupportCategoryDto> ByCategory);

public record AdminStatsDto(
    int Users,
    int ConfirmedUsers,
    int GoogleUsers,
    int UsersLast7Days,
    int Characters,
    int CharactersLast7Days,
    int Campaigns,
    int CampaignsActive,
    int CampaignsLast7Days,
    int CampaignMembers,
    int Dungeons,
    int DungeonsLast7Days,
    int FriendshipsAccepted,
    int FriendMessages,
    int SupportTickets,
    int SupportMessages,
    int GuideComments,
    int Generations,
    int GenerationsOk,
    int GenerationsLast24h,
    int GenerationsLast7Days,
    long PromptTokens,
    long CompletionTokens,
    long TotalTokens,
    long TokensLast24h,
    long TokensLast7Days,
    List<AdminStatsKindDto> GenerationsByKind,
    List<AdminStatsProviderDto> GenerationsByProvider,
    AdminServerDto Server,
    AdminHttpDto Http,
    AdminSupportDeskDto SupportDesk
);

public class AdminStatsEndpoint(
    AppDbContext db,
    HttpRequestMetrics httpMetrics,
    HostResourceSampler host,
    IHostEnvironment env) : EndpointWithoutRequest<AdminStatsDto>
{
    public override void Configure()
    {
        Get("/admin/stats");
        Roles(AppRoles.Admin);
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var d7 = now.AddDays(-7);
        var d1 = now.AddHours(-24);

        var users = await db.Users.AsNoTracking().ToListAsync(ct);
        var characters = await db.Characters.AsNoTracking().Select(c => c.CreatedAt).ToListAsync(ct);
        var campaigns = await db.Campaigns.AsNoTracking()
            .Select(c => new { c.CreatedAt, c.ClosedAt })
            .ToListAsync(ct);
        var dungeons = await db.Dungeons.AsNoTracking().Select(d => d.CreatedAt).ToListAsync(ct);
        var gens = await db.AiGenerationLogs.AsNoTracking().ToListAsync(ct);

        var byKind = gens
            .GroupBy(g => string.IsNullOrWhiteSpace(g.Kind) ? "autre" : g.Kind)
            .OrderBy(g => g.Key)
            .Select(g => new AdminStatsKindDto(g.Key, g.Count(), g.Count(x => x.Ok), g.Sum(x => (long)x.TotalTokens)))
            .ToList();

        var byProvider = gens
            .GroupBy(g => string.IsNullOrWhiteSpace(g.Provider) ? "inconnu" : g.Provider)
            .OrderByDescending(g => g.Count())
            .Select(g => new AdminStatsProviderDto(g.Key, g.Count(), g.Count(x => x.Ok), g.Sum(x => (long)x.TotalTokens)))
            .ToList();

        var ticketRows = await db.SupportTickets.AsNoTracking()
            .Select(t => new { t.Id, t.Status, t.Category, t.CreatedAt, t.UpdatedAt })
            .ToListAsync(ct);
        var tickets = ticketRows
            .Select(t => new SupportDeskTicketRow(t.Id, t.Status, t.Category, t.CreatedAt, t.UpdatedAt))
            .ToList();
        var lastFromStaff = await SupportInboxHelper.LastFromStaffByTicketAsync(
            db,
            tickets.Select(t => t.Id).ToList(),
            ct);
        var desk = SupportDeskStats.From(tickets, lastFromStaff, now);

        var snap = host.Capture();
        var http = httpMetrics.Snapshot();

        await Send.OkAsync(
            new AdminStatsDto(
                users.Count,
                users.Count(u => u.EmailConfirmed),
                users.Count(u => !string.IsNullOrWhiteSpace(u.GoogleSubject)),
                users.Count(u => u.CreatedAt >= d7),
                characters.Count,
                characters.Count(c => c >= d7),
                campaigns.Count,
                campaigns.Count(c => c.ClosedAt is null),
                campaigns.Count(c => c.CreatedAt >= d7),
                await db.CampaignMembers.AsNoTracking().CountAsync(ct),
                dungeons.Count,
                dungeons.Count(d => d >= d7),
                await db.Friendships.AsNoTracking().CountAsync(f => f.Status == FriendStatuses.Accepted, ct),
                await db.FriendMessages.AsNoTracking().CountAsync(ct),
                await db.SupportTickets.AsNoTracking().CountAsync(ct),
                await db.SupportTicketMessages.AsNoTracking().CountAsync(ct),
                await db.GuideComments.AsNoTracking().CountAsync(ct),
                gens.Count,
                gens.Count(g => g.Ok),
                gens.Count(g => g.CreatedAt >= d1),
                gens.Count(g => g.CreatedAt >= d7),
                gens.Sum(g => (long)g.PromptTokens),
                gens.Sum(g => (long)g.CompletionTokens),
                gens.Sum(g => (long)g.TotalTokens),
                gens.Where(g => g.CreatedAt >= d1).Sum(g => (long)g.TotalTokens),
                gens.Where(g => g.CreatedAt >= d7).Sum(g => (long)g.TotalTokens),
                byKind,
                byProvider,
                new AdminServerDto(
                    snap.MachineName,
                    snap.Framework,
                    snap.OsDescription,
                    env.EnvironmentName,
                    snap.StartedAt,
                    snap.UptimeSeconds,
                    snap.CpuProcessPercent,
                    snap.ThreadCount,
                    snap.ProcessorCount,
                    snap.WorkingSetBytes,
                    snap.PrivateMemoryBytes,
                    snap.GcHeapBytes,
                    snap.AvailableMemoryBytes,
                    snap.ContainerMemoryBytes,
                    snap.ContainerMemoryLimitBytes,
                    snap.HostMemoryTotalBytes,
                    snap.HostMemoryAvailableBytes,
                    snap.HostDiskTotalBytes,
                    snap.HostDiskAvailableBytes,
                    snap.Load1,
                    snap.Load5,
                    snap.Load15),
                new AdminHttpDto(
                    http.RequestsSinceStart,
                    http.Status2xx,
                    http.Status4xx,
                    http.Status5xx,
                    http.InFlight,
                    http.TopPaths.Select(p => new AdminHttpPathDto(p.Path, p.Count, p.Errors, p.AvgDurationMs)).ToList(),
                    http.Recent.Select(r => new AdminHttpRecentDto(r.Method, r.Path, r.Status, r.DurationMs, r.At)).ToList()),
                new AdminSupportDeskDto(
                    desk.Open,
                    desk.InProgress,
                    desk.Closed,
                    desk.WaitingOnStaff,
                    desk.WaitingOnPlayer,
                    desk.OldestWaitingHours,
                    desk.ByCategory.Select(c => new AdminSupportCategoryDto(c.Category, c.Total, c.WaitingOnStaff)).ToList())
            ),
            ct);
    }
}
