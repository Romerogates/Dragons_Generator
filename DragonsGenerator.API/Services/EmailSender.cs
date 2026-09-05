using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using MimeKit;

namespace DragonsGenerator.API.Services;

public interface IEmailSender
{
    Task SendAsync(string toEmail, string subject, string htmlBody, CancellationToken ct = default);
}

public class SmtpOptions
{
    public string Host { get; set; } = "localhost";
    public int Port { get; set; } = 1025;
    public string? UserName { get; set; }
    public string? Password { get; set; }
    public bool UseSsl { get; set; }
    public string FromEmail { get; set; } = "noreply@dragons-generator.local";
    public string FromName { get; set; } = "Dragons Generator";
}

public class SmtpEmailSender(IOptionsMonitor<SmtpOptions> options, ILogger<SmtpEmailSender> logger)
    : IEmailSender
{
    public async Task SendAsync(
        string toEmail,
        string subject,
        string htmlBody,
        CancellationToken ct = default
    )
    {
        var opt = options.CurrentValue;
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(opt.FromName, opt.FromEmail));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = subject;
        message.Body = new BodyBuilder { HtmlBody = htmlBody }.ToMessageBody();

        try
        {
            const int attempts = 3;
            for (var attempt = 1; attempt <= attempts; attempt++)
            {
                try
                {
                    using var client = new SmtpClient();
                    var secure = opt.Port switch
                    {
                        465 => SecureSocketOptions.SslOnConnect,
                        587 => SecureSocketOptions.StartTls,
                        _ when opt.UseSsl => SecureSocketOptions.StartTls,
                        _ => SecureSocketOptions.None,
                    };

                    await client.ConnectAsync(opt.Host, opt.Port, secure, ct);
                    if (!string.IsNullOrWhiteSpace(opt.UserName))
                    {
                        await client.AuthenticateAsync(opt.UserName, opt.Password ?? "", ct);
                    }

                    await client.SendAsync(message, ct);
                    await client.DisconnectAsync(true, ct);
                    logger.LogInformation("Email envoyé à {Email} : {Subject}", toEmail, subject);
                    return;
                }
                catch (Exception ex) when (attempt < attempts)
                {
                    logger.LogWarning(ex, "SMTP tentative {Attempt}/{Attempts} échouée pour {Email}", attempt, attempts, toEmail);
                    await Task.Delay(TimeSpan.FromMilliseconds(250 * attempt), ct);
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Échec envoi email à {Email}", toEmail);
            throw;
        }
    }
}

/// <summary>Fallback dev : log le mail sans SMTP (si Smtp:Host=log).</summary>
public class LoggingEmailSender(ILogger<LoggingEmailSender> logger, IHostEnvironment env) : IEmailSender
{
    public Task SendAsync(
        string toEmail,
        string subject,
        string htmlBody,
        CancellationToken ct = default
    )
    {
        if (env.IsProduction())
        {
            logger.LogError(
                "[EMAIL-LOG] Production : mail non envoyé (Smtp__Host=log). To={To} Subject={Subject}",
                toEmail,
                subject
            );
        }
        else
        {
            logger.LogWarning(
                "[EMAIL-LOG] To={To} Subject={Subject}\n{Body}",
                toEmail,
                subject,
                htmlBody
            );
        }
        return Task.CompletedTask;
    }
}
