using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace DragonsGenerator.API.Tests;

internal static class ApiTestAuth
{
    internal static async Task<string> LoginAdminAsync(HttpClient client)
    {
        return await LoginAsync(client, "admin@dragons.local", "AdminDragons!2026");
    }

    internal static async Task<string> LoginAsync(HttpClient client, string email, string password)
    {
        var login = await client.PostAsJsonAsync("/auth/login", new { email, password });
        login.EnsureSuccessStatusCode();
        var token = ExtractSessionToken(login);
        Assert.False(string.IsNullOrWhiteSpace(token));
        return token!;
    }

    /// <summary>JWT depuis le cookie HttpOnly dg_session (Phase 2) ou le corps JSON legacy.</summary>
    internal static string? ExtractSessionToken(HttpResponseMessage login)
    {
        if (login.Headers.TryGetValues("Set-Cookie", out var setCookies))
        {
            foreach (var header in setCookies)
            {
                const string prefix = "dg_session=";
                var idx = header.IndexOf(prefix, StringComparison.Ordinal);
                if (idx < 0)
                    continue;
                var start = idx + prefix.Length;
                var end = header.IndexOf(';', start);
                var value = end < 0 ? header[start..] : header[start..end];
                if (!string.IsNullOrWhiteSpace(value))
                    return value;
            }
        }

        var auth = login.Content.ReadFromJsonAsync<JsonElement>().GetAwaiter().GetResult();
        if (auth.TryGetProperty("token", out var tokenProp))
        {
            var bodyToken = tokenProp.GetString();
            if (!string.IsNullOrWhiteSpace(bodyToken))
                return bodyToken;
        }

        return null;
    }

    internal static async Task<(string Email, string Token, Guid UserId)> RegisterConfirmAndLoginAsync(
        HttpClient client,
        string? suffix = null
    )
    {
        var email = $"user-{Guid.NewGuid():N}@dragons.local";
        const string password = "TestPass123!";
        var displayName = $"Hero{Guid.NewGuid():N}"[..12];

        var register = await client.PostAsJsonAsync(
            "/auth/register",
            new { email, password, displayName, acceptTerms = true }
        );
        var registerBody = await register.Content.ReadAsStringAsync();
        Assert.True(
            register.IsSuccessStatusCode,
            $"register → {(int)register.StatusCode} {registerBody}"
        );

        var regJson = JsonDocument.Parse(registerBody).RootElement;
        var confirmLink = regJson.GetProperty("confirmLink").GetString();
        Assert.False(string.IsNullOrWhiteSpace(confirmLink));

        var tokenParam = ExtractQueryParam(confirmLink!, "token");
        var confirm = await client.GetAsync(
            $"/auth/confirm-email?token={Uri.EscapeDataString(tokenParam)}"
        );
        confirm.EnsureSuccessStatusCode();

        var token = await LoginAsync(client, email, password);
        var userId = await GetUserIdAsync(client, token);
        return (email, token, userId);
    }

    internal static HttpRequestMessage Authed(HttpMethod method, string url, string token)
    {
        var req = new HttpRequestMessage(method, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return req;
    }

    internal static void UseBearer(HttpClient client, string token)
    {
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    internal static void ClearAuth(HttpClient client)
    {
        client.DefaultRequestHeaders.Authorization = null;
    }

    private static async Task<Guid> GetUserIdAsync(HttpClient client, string token)
    {
        using var req = Authed(HttpMethod.Get, "/auth/me", token);
        var me = await client.SendAsync(req);
        me.EnsureSuccessStatusCode();
        var user = await me.Content.ReadFromJsonAsync<JsonElement>();
        return user.GetProperty("id").GetGuid();
    }

    private static string ExtractQueryParam(string url, string key)
    {
        var query = url.Contains('?') ? url[(url.IndexOf('?') + 1)..] : string.Empty;
        foreach (var part in query.Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var kv = part.Split('=', 2);
            if (kv.Length == 2 && kv[0] == key)
                return Uri.UnescapeDataString(kv[1]);
        }
        throw new InvalidOperationException($"Missing query param {key} in {url}");
    }
}
