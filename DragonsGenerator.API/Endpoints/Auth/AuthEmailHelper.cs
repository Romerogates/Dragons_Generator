using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;

namespace DragonsGenerator.API.Endpoints.Auth;

internal static class AuthEmailHelper
{
    internal static async Task<(bool Sent, string Link)> SendConfirmationAsync(
        AppUser user,
        string? webUrl,
        AppUrlOptions appUrl,
        IEmailSender email,
        ILogger logger,
        bool allowRequestWebUrl,
        CancellationToken ct
    )
    {
        user.EmailConfirmToken = AuthHelpers.NewToken();
        var webBase = AuthHelpers.ResolveWebUrl(webUrl, appUrl.PublicWebUrl, allowRequestWebUrl);
        var link = $"{webBase}/confirm-email?token={Uri.EscapeDataString(user.EmailConfirmToken)}";
        try
        {
            await email.SendAsync(
                user.Email,
                "Confirmez votre compte — Dragons Generator",
                AuthEmailTemplates.Confirmation(user.DisplayName, link),
                ct
            );
            return (true, link);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Email de confirmation non envoyé à {Email}", user.Email);
            return (false, link);
        }
    }

    internal static Dictionary<string, object?> BuildConfirmationResponse(
        AppUser user,
        bool emailSent,
        string link,
        string message,
        IHostEnvironment env,
        bool resent = false
    )
    {
        var response = new Dictionary<string, object?>
        {
            ["message"] = message,
            ["email"] = user.Email,
            ["emailSent"] = emailSent,
            ["resent"] = resent,
        };
        if (env.IsDevelopment())
        {
            response["confirmLink"] = link;
        }
        return response;
    }
}
