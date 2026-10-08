using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace DragonsGenerator.API.Services;

public class GoogleAuthOptions
{
    public string ClientId { get; set; } = "";
}

public sealed record GoogleProfile(string Subject, string Email, string? Name, bool EmailVerified);

public sealed class GoogleIdTokenValidator(
    IHttpClientFactory httpFactory,
    IOptionsMonitor<GoogleAuthOptions> options,
    ILogger<GoogleIdTokenValidator> logger
)
{
    public bool IsConfigured => !string.IsNullOrWhiteSpace(options.CurrentValue.ClientId);

    public string? ClientId => string.IsNullOrWhiteSpace(options.CurrentValue.ClientId)
        ? null
        : options.CurrentValue.ClientId.Trim();

    public async Task<GoogleProfile?> ValidateAsync(string idToken, CancellationToken ct)
    {
        var clientId = ClientId;
        if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(idToken))
            return null;

        try
        {
            var http = httpFactory.CreateClient("Google");
            var url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + Uri.EscapeDataString(idToken);
            var payload = await http.GetFromJsonAsync<TokenInfo>(url, ct);
            if (payload is null)
                return null;
            if (!string.Equals(payload.Aud, clientId, StringComparison.Ordinal))
                return null;
            if (string.IsNullOrWhiteSpace(payload.Sub) || string.IsNullOrWhiteSpace(payload.Email))
                return null;
            if (!IsVerified(payload.EmailVerified))
                return null;
            return new GoogleProfile(payload.Sub, payload.Email.Trim().ToLowerInvariant(), payload.Name, true);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Jeton Google invalide");
            return null;
        }
    }

    private static bool IsVerified(JsonElement el) =>
        el.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.String => el.GetString() is "true" or "True" or "1",
            JsonValueKind.Number => el.GetInt32() == 1,
            _ => false,
        };

    private sealed class TokenInfo
    {
        [JsonPropertyName("aud")]
        public string? Aud { get; set; }

        [JsonPropertyName("sub")]
        public string? Sub { get; set; }

        [JsonPropertyName("email")]
        public string? Email { get; set; }

        [JsonPropertyName("email_verified")]
        public JsonElement EmailVerified { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }
    }
}
