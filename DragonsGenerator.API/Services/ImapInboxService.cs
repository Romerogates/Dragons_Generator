using MailKit;
using MailKit.Net.Imap;
using MailKit.Search;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;

namespace DragonsGenerator.API.Services;

public class ImapOptions
{
    public string Host { get; set; } = "";
    public int Port { get; set; } = 993;
    public bool UseSsl { get; set; } = true;
    public string? UserName { get; set; }
    public string? Password { get; set; }
}

public record InboxMailDto(
    string Id,
    string From,
    string To,
    string Subject,
    string Snippet,
    DateTimeOffset Date,
    bool Seen
);

public sealed class ImapInboxService(IOptionsMonitor<ImapOptions> imap, IOptionsMonitor<SmtpOptions> smtp)
{
    private readonly object _gate = new();
    private DateTimeOffset _cachedAt = DateTimeOffset.MinValue;
    private List<InboxMailDto> _cache = [];

    public bool IsConfigured
    {
        get
        {
            var opt = Effective();
            return !string.IsNullOrWhiteSpace(opt.Host)
                && !string.IsNullOrWhiteSpace(opt.UserName)
                && !string.IsNullOrWhiteSpace(opt.Password)
                && !IsSink(opt.Host);
        }
    }

    public async Task<List<InboxMailDto>> ListRecentAsync(int take, CancellationToken ct)
    {
        lock (_gate)
        {
            if (_cache.Count > 0 && DateTimeOffset.UtcNow - _cachedAt < TimeSpan.FromMinutes(2))
                return _cache.Take(take).ToList();
        }

        if (!IsConfigured)
            return [];

        var opt = Effective();
        using var client = new ImapClient();
        var secure = opt.Port == 993 || opt.UseSsl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls;
        await client.ConnectAsync(opt.Host, opt.Port, secure, ct);
        await client.AuthenticateAsync(opt.UserName ?? "", opt.Password ?? "", ct);
        var inbox = client.Inbox;
        await inbox.OpenAsync(FolderAccess.ReadOnly, ct);

        var uids = (await inbox.SearchAsync(SearchQuery.All, ct)).ToList();
        var n = Math.Clamp(take, 1, 50);
        var slice = uids.Skip(Math.Max(0, uids.Count - n)).Reverse().ToList();
        var list = new List<InboxMailDto>(slice.Count);
        foreach (var uid in slice)
        {
            var msg = await inbox.GetMessageAsync(uid, ct);
            var from = msg.From.Mailboxes.FirstOrDefault()?.Address ?? msg.From.ToString();
            var to = msg.To.Mailboxes.FirstOrDefault()?.Address ?? "";
            var body = msg.TextBody ?? msg.HtmlBody ?? "";
            var snippet = body.Length > 280 ? body[..280] + "…" : body;
            list.Add(new InboxMailDto(
                uid.ToString(),
                from,
                to,
                msg.Subject ?? "(sans sujet)",
                snippet.Replace('\r', ' ').Replace('\n', ' ').Trim(),
                msg.Date,
                false
            ));
        }

        await client.DisconnectAsync(true, ct);
        lock (_gate)
        {
            _cache = list;
            _cachedAt = DateTimeOffset.UtcNow;
        }
        return list;
    }

    private ImapOptions Effective()
    {
        var i = imap.CurrentValue;
        var s = smtp.CurrentValue;
        return new ImapOptions
        {
            Host = string.IsNullOrWhiteSpace(i.Host) ? "imap.mail.ovh.net" : i.Host.Trim(),
            Port = i.Port == 0 ? 993 : i.Port,
            UseSsl = i.UseSsl,
            UserName = string.IsNullOrWhiteSpace(i.UserName) ? s.UserName : i.UserName,
            Password = string.IsNullOrWhiteSpace(i.Password) ? s.Password : i.Password,
        };
    }

    private static bool IsSink(string host) =>
        host.Equals("log", StringComparison.OrdinalIgnoreCase)
        || host.Equals("mailhog", StringComparison.OrdinalIgnoreCase)
        || host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
        || host is "127.0.0.1";
}
