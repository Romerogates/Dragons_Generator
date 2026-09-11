using System.Text.Json;

namespace DragonsGenerator.API.Endpoints.Friends;

public static class FriendChatAttachmentHelper
{
    public const string Character = "character";
    public const string Campaign = "campaign";
    public const string Invite = "invite";

    public static bool TryValidate(
        string? kind,
        string? payload,
        out string? normalizedKind,
        out string? normalizedPayload,
        out string? error)
    {
        normalizedKind = null;
        normalizedPayload = null;
        error = null;

        if (string.IsNullOrWhiteSpace(kind))
            return true;

        normalizedKind = kind.Trim().ToLowerInvariant();
        if (normalizedKind is not Character and not Campaign and not Invite)
        {
            error = "Type de pièce jointe invalide.";
            return false;
        }

        if (string.IsNullOrWhiteSpace(payload))
        {
            error = "Pièce jointe invalide.";
            return false;
        }

        try
        {
            using var doc = JsonDocument.Parse(payload);
            var root = doc.RootElement;
            if (normalizedKind == Character)
            {
                if (!root.TryGetProperty("characterId", out var idEl) ||
                    !Guid.TryParse(idEl.GetString(), out _))
                {
                    error = "Fiche personnage invalide.";
                    return false;
                }
            }
            else if (normalizedKind == Campaign)
            {
                if (!root.TryGetProperty("campaignId", out var campEl) ||
                    !Guid.TryParse(campEl.GetString(), out _))
                {
                    error = "Campagne invalide.";
                    return false;
                }
            }
            else
            {
                var token = root.TryGetProperty("joinToken", out var tokEl) ? tokEl.GetString() : null;
                if (string.IsNullOrWhiteSpace(token) || token.Length is < 8 or > 64
                    || token.Any(c => !(char.IsAsciiLetterOrDigit(c) || c is '-' or '_')))
                {
                    error = "Lien d'invitation invalide.";
                    return false;
                }

                if (root.TryGetProperty("campaignId", out var campIdEl)
                    && !Guid.TryParse(campIdEl.GetString(), out _))
                {
                    error = "Campagne invalide.";
                    return false;
                }
            }
        }
        catch
        {
            error = "Pièce jointe invalide.";
            return false;
        }

        normalizedPayload = payload.Trim();
        return true;
    }

    public static string Preview(string? body, string? kind, string? payload)
    {
        if (!string.IsNullOrWhiteSpace(kind))
        {
            return kind switch
            {
                Character => "📜 Fiche partagée",
                Campaign => "🗺 Campagne partagée",
                Invite => "📨 Invitation campagne",
                _ => "📎 Pièce jointe",
            };
        }

        var trimmed = (body ?? "").Trim();
        return trimmed.Length <= 80 ? trimmed : trimmed[..77] + "…";
    }
}
