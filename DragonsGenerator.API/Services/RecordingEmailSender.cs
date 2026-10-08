using DragonsGenerator.API.Persistence;
using Microsoft.Extensions.Options;

namespace DragonsGenerator.API.Services;

/// <summary>Enregistre chaque envoi (SMTP ou log) pour le desk admin — pas une inbox OVH.</summary>
public sealed class RecordingEmailSender(
    IEmailSender inner,
    IServiceScopeFactory scopes,
    IOptionsMonitor<SmtpOptions> smtp,
    ILogger<RecordingEmailSender> logger
) : IEmailSender
{
    public const int MaxBodyChars = 32_000;

    public async Task SendAsync(string toEmail, string subject, string htmlBody, CancellationToken ct = default)
    {
        var from = smtp.CurrentValue.FromEmail ?? "";
        try
        {
            await inner.SendAsync(toEmail, subject, htmlBody, ct);
            await PersistAsync(toEmail, from, subject, htmlBody, "sent", null, ct);
        }
        catch (Exception ex)
        {
            await PersistAsync(toEmail, from, subject, htmlBody, "failed", ex.Message, ct);
            throw;
        }
    }

    private async Task PersistAsync(
        string toEmail,
        string fromEmail,
        string subject,
        string htmlBody,
        string status,
        string? error,
        CancellationToken ct)
    {
        try
        {
            await using var scope = scopes.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.OutboundEmails.Add(new OutboundEmail
            {
                ToEmail = Trunc(toEmail, 256),
                FromEmail = Trunc(fromEmail, 256),
                Subject = Trunc(subject, 400),
                HtmlBody = Trunc(htmlBody ?? "", MaxBodyChars),
                Status = status,
                Error = error is null ? null : Trunc(error, 1000),
            });
            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Impossible d’enregistrer le mail sortant pour {To}", toEmail);
        }
    }

    private static string Trunc(string value, int max) =>
        string.IsNullOrEmpty(value) ? "" : (value.Length <= max ? value : value[..max]);
}
