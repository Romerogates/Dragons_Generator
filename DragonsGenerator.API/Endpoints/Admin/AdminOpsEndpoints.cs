using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Admin;

public record OpsEventDto(Guid Id, string Kind, string Title, string Detail, DateTimeOffset CreatedAt);

public record AdminOverviewDto(
    int Users,
    int ConfirmedUsers,
    int Campaigns,
    int TicketsOpen,
    int TicketsInProgress,
    int TicketsClosed,
    int RemindersLast24h,
    OpsEventDto? LastBackup,
    OpsEventDto? LastAlert,
    List<OpsEventDto> RecentOps,
    List<CronRowDto> Crons
);

public record CronRowDto(string Name, string Schedule, string LastKind);

public record IngestOpsEventRequest(string Kind, string Title, string Detail);

public record OutboundEmailDto(
    Guid Id,
    string ToEmail,
    string FromEmail,
    string Subject,
    string HtmlBody,
    string Status,
    string? Error,
    DateTimeOffset CreatedAt
);

public class AdminOpsOverviewEndpoint(AppDbContext db) : EndpointWithoutRequest<AdminOverviewDto>
{
    public override void Configure()
    {
        Get("/admin/ops/overview");
        Roles(AppRoles.Admin);
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var users = await db.Users.AsNoTracking().CountAsync(ct);
        var confirmed = await db.Users.AsNoTracking().CountAsync(u => u.EmailConfirmed, ct);
        var campaigns = await db.Campaigns.AsNoTracking().CountAsync(ct);
        var tickets = await db.SupportTickets.AsNoTracking().Select(t => t.Status).ToListAsync(ct);
        var cutoff = now.AddHours(-24);
        var reminders = (await db.SessionReminderLogs.AsNoTracking().ToListAsync(ct))
            .Count(l => l.SentAt >= cutoff);
        var ops = (await db.OpsEvents.AsNoTracking().ToListAsync(ct))
            .OrderByDescending(e => e.CreatedAt)
            .Take(40)
            .ToList();
        var dtos = ops.Select(ToDto).ToList();

        await Send.OkAsync(
            new AdminOverviewDto(
                users,
                confirmed,
                campaigns,
                tickets.Count(s => s == "open"),
                tickets.Count(s => s == "in_progress"),
                tickets.Count(s => s == "closed"),
                reminders,
                dtos.FirstOrDefault(e => e.Kind is "backup" or "backup_mail"),
                dtos.FirstOrDefault(e => e.Kind == "alert"),
                dtos,
                [
                    new CronRowDto("Watchdog santé", "*/5 * * * *", "alert"),
                    new CronRowDto("Backup SQLite (fichier VPS, pas de mail)", "0 3 * * *", "backup"),
                    new CronRowDto("Let’s Encrypt", "0 4 * * 1", "cert"),
                ]
            ),
            ct);
    }

    private static OpsEventDto ToDto(OpsEvent e) => new(e.Id, e.Kind, e.Title, e.Detail, e.CreatedAt);
}

public class AdminOpsEventsEndpoint(AppDbContext db) : EndpointWithoutRequest<List<OpsEventDto>>
{
    public override void Configure()
    {
        Get("/admin/ops/events");
        Roles(AppRoles.Admin);
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var list = (await db.OpsEvents.AsNoTracking().ToListAsync(ct))
            .OrderByDescending(e => e.CreatedAt)
            .Take(100)
            .Select(e => new OpsEventDto(e.Id, e.Kind, e.Title, e.Detail, e.CreatedAt))
            .ToList();
        await Send.OkAsync(list, ct);
    }
}

public class AdminOutboundEmailsEndpoint(AppDbContext db) : EndpointWithoutRequest<List<OutboundEmailDto>>
{
    public override void Configure()
    {
        Get("/admin/outbound-emails");
        Roles(AppRoles.Admin);
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var list = (await db.OutboundEmails.AsNoTracking().ToListAsync(ct))
            .OrderByDescending(e => e.CreatedAt)
            .Take(200)
            .Select(e => new OutboundEmailDto(
                e.Id,
                e.ToEmail,
                e.FromEmail,
                e.Subject,
                e.HtmlBody,
                e.Status,
                e.Error,
                e.CreatedAt))
            .ToList();
        await Send.OkAsync(list, ct);
    }
}

public class AdminDiagnosticEndpoint(SupportDeskService desk) : EndpointWithoutRequest
{
    public override void Configure()
    {
        Get("/admin/ops/diagnostic");
        Roles(AppRoles.Admin);
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        Guid? ticketId = null;
        var raw = HttpContext.Request.Query["ticketId"].ToString();
        if (Guid.TryParse(raw, out var parsed)) ticketId = parsed;
        var markdown = await desk.BuildDiagnosticMarkdownAsync(ticketId, ct);
        await Send.OkAsync(new { markdown, generatedAt = DateTimeOffset.UtcNow }, ct);
    }
}

public class IngestOpsEventEndpoint(SupportDeskService desk, IHostEnvironment env)
    : Endpoint<IngestOpsEventRequest>
{
    public override void Configure()
    {
        Post("/internal/ops-events");
        AllowAnonymous();
    }

    public override async Task HandleAsync(IngestOpsEventRequest req, CancellationToken ct)
    {
        var ip = HttpContext.Connection.RemoteIpAddress;
        if (!SupportDeskService.IsLoopbackIngest(ip, env.IsDevelopment()))
        {
            await Send.ForbiddenAsync(ct);
            return;
        }

        var kind = (req.Kind ?? "").Trim();
        var title = (req.Title ?? "").Trim();
        if (kind.Length is 0 or > 64 || title.Length is 0 or > 240)
        {
            AddError("kind/title requis.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        await desk.RecordOpsAsync(kind, title, req.Detail ?? "", ct);
        await Send.NoContentAsync(ct);
    }
}
