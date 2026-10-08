using System.Net;
using System.Text;
using DragonsGenerator.API.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DragonsGenerator.API.Services;

public sealed class SupportDeskService(
    AppDbContext db,
    IEmailSender email,
    IOptions<AppUrlOptions> appUrl,
    IOptions<AlertOptions> alert,
    ILogger<SupportDeskService> logger)
{
    public async Task RecordOpsAsync(string kind, string title, string detail, CancellationToken ct)
    {
        db.OpsEvents.Add(new OpsEvent
        {
            Kind = Trunc(kind, 64),
            Title = Trunc(title, 240),
            Detail = Trunc(detail, 4000),
        });
        await db.SaveChangesAsync(ct);
    }

    public async Task NotifyNewTicketAsync(
        SupportTicket ticket,
        string userEmail,
        CancellationToken ct,
        string? excerpt = null)
    {
        var to = alert.Value.Email?.Trim();
        if (string.IsNullOrWhiteSpace(to)) return;
        var link = $"{WebBase()}/admin?tab=tickets&ticket={ticket.Id}";
        try
        {
            await email.SendAsync(
                to,
                $"Ticket support — {ticket.Subject}",
                AuthEmailTemplates.SupportNewTicket(
                    ticket.Subject,
                    userEmail,
                    excerpt ?? ticket.Message,
                    link),
                ct);
            await RecordOpsAsync("support_mail", "Nouveau ticket mailé au desk", $"{ticket.Subject} · {userEmail}", ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Support new-ticket email failed");
        }
    }

    public async Task NotifyTakenAsync(SupportTicket ticket, string userEmail, string displayName, CancellationToken ct)
    {
        var link = $"{WebBase()}/support?ticket={ticket.Id}";
        try
        {
            await email.SendAsync(
                userEmail,
                "Nous consultons votre demande",
                AuthEmailTemplates.SupportTaken(
                    string.IsNullOrWhiteSpace(displayName) ? "aventurier" : displayName,
                    ticket.Subject,
                    link),
                ct);
            await RecordOpsAsync("support_mail", "Mail « nous consultons »", ticket.Subject, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Support taken email failed");
        }
    }

    public async Task NotifyReplyAsync(
        SupportTicket ticket,
        string userEmail,
        string displayName,
        string excerpt,
        CancellationToken ct)
    {
        var link = $"{WebBase()}/support?ticket={ticket.Id}";
        try
        {
            await email.SendAsync(
                userEmail,
                $"Réponse du support — {ticket.Subject}",
                AuthEmailTemplates.SupportReply(
                    string.IsNullOrWhiteSpace(displayName) ? "aventurier" : displayName,
                    ticket.Subject,
                    excerpt,
                    link),
                ct);
            await RecordOpsAsync("support_mail", "Mail réponse support", ticket.Subject, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Support reply email failed");
            throw;
        }
    }

    public async Task<string> BuildDiagnosticMarkdownAsync(Guid? ticketId, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var users = await db.Users.AsNoTracking().CountAsync(ct);
        var confirmed = await db.Users.AsNoTracking().CountAsync(u => u.EmailConfirmed, ct);
        var campaigns = await db.Campaigns.AsNoTracking().CountAsync(ct);
        var tickets = await db.SupportTickets.AsNoTracking().ToListAsync(ct);
        var open = tickets.Count(t => t.Status == "open");
        var wip = tickets.Count(t => t.Status == "in_progress");
        var closed = tickets.Count(t => t.Status == "closed");
        var reminderCutoff = now.AddHours(-24);
        var reminders24h = (await db.SessionReminderLogs.AsNoTracking().ToListAsync(ct))
            .Count(l => l.SentAt >= reminderCutoff);
        var ops = (await db.OpsEvents.AsNoTracking().ToListAsync(ct))
            .OrderByDescending(e => e.CreatedAt)
            .Take(25)
            .ToList();
        var lastBackup = ops.FirstOrDefault(e => e.Kind is "backup" or "backup_mail");
        var lastAlert = ops.FirstOrDefault(e => e.Kind == "alert");

        var sb = new StringBuilder();
        sb.AppendLine("# Diagnostic Dragons Generator");
        sb.AppendLine($"Généré : {now:O}");
        sb.AppendLine();
        sb.AppendLine("## Stats");
        sb.AppendLine($"- Comptes : {users} (confirmés {confirmed})");
        sb.AppendLine($"- Campagnes : {campaigns}");
        sb.AppendLine($"- Tickets : {tickets.Count} (ouverts {open}, en cours {wip}, fermés {closed})");
        sb.AppendLine($"- Rappels session 24 h : {reminders24h}");
        sb.AppendLine($"- Dernier backup ops : {Fmt(lastBackup)}");
        sb.AppendLine($"- Dernière alerte ops : {Fmt(lastAlert)}");
        sb.AppendLine();
        sb.AppendLine("## Crons attendus (VPS)");
        sb.AppendLine("- Watchdog santé : toutes les 5 min");
        sb.AppendLine("- Backup SQLite (VPS, sans mail) : 03:00");
        sb.AppendLine("- Let’s Encrypt : lundi 04:00");
        sb.AppendLine();
        sb.AppendLine("## Derniers événements ops");
        if (ops.Count == 0) sb.AppendLine("- (aucun encore)");
        foreach (var e in ops)
            sb.AppendLine($"- {e.CreatedAt:u} · `{e.Kind}` · {e.Title} — {OneLine(e.Detail)}");

        if (ticketId is Guid tid)
        {
            var ticket = tickets.FirstOrDefault(t => t.Id == tid)
                ?? await db.SupportTickets.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tid, ct);
            if (ticket is not null)
            {
                var owner = await db.Users.AsNoTracking()
                    .Where(u => u.Id == ticket.UserId)
                    .Select(u => new { u.Email, u.DisplayName })
                    .FirstOrDefaultAsync(ct);
                var msgs = (await db.SupportTicketMessages.AsNoTracking()
                        .Where(m => m.TicketId == tid)
                        .ToListAsync(ct))
                    .OrderBy(m => m.CreatedAt)
                    .ToList();
                sb.AppendLine();
                sb.AppendLine("## Ticket à corriger");
                sb.AppendLine($"- Id : `{ticket.Id}`");
                sb.AppendLine($"- Statut : {ticket.Status}");
                sb.AppendLine($"- Sujet : {ticket.Subject}");
                sb.AppendLine($"- Joueur : {owner?.DisplayName} <{owner?.Email}>");
                sb.AppendLine($"- Personnage : {ticket.CharacterName ?? "—"}");
                sb.AppendLine($"- Créé : {ticket.CreatedAt:O}");
                sb.AppendLine();
                sb.AppendLine("### Message initial");
                sb.AppendLine("```");
                sb.AppendLine(ticket.Message);
                sb.AppendLine("```");
                foreach (var m in msgs)
                {
                    sb.AppendLine();
                    sb.AppendLine($"### {(m.FromStaff ? "Support" : "Joueur")} — {m.CreatedAt:u}");
                    sb.AppendLine("```");
                    sb.AppendLine(m.Body);
                    sb.AppendLine("```");
                }
            }
        }

        sb.AppendLine();
        sb.AppendLine("Colle ce bloc dans Cursor pour corriger le souci.");
        return sb.ToString();
    }

    private string WebBase() => appUrl.Value.PublicWebUrl.TrimEnd('/');

    private static string Trunc(string value, int max) =>
        string.IsNullOrWhiteSpace(value) ? "" : (value.Length <= max ? value : value[..max]);

    private static string OneLine(string value) =>
        (value ?? "").Replace('\r', ' ').Replace('\n', ' ').Trim();

    private static string Fmt(OpsEvent? e) =>
        e is null ? "aucun" : $"{e.CreatedAt:u} — {e.Title}";

    public static bool IsLoopbackIngest(IPAddress? ip, bool isDevelopment) =>
        (ip is not null && IPAddress.IsLoopback(ip)) || (isDevelopment && ip is null);
}
