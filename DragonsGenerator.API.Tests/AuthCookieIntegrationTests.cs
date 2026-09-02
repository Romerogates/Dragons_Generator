using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DragonsGenerator.API.Tests;

[Collection("ApiIntegration")]
public class AuthCookieIntegrationTests
{
    private readonly HttpClient _anonClient;
    private readonly HttpClient _cookieClient;

    public AuthCookieIntegrationTests(CustomWebApplicationFactory factory)
    {
        _anonClient = factory.CreateTestClient();
        _cookieClient = factory.CreateCookieTestClient();
    }

    [Fact]
    public async Task Login_sets_dg_session_cookie_and_null_body_token()
    {
        var login = await _cookieClient.PostAsJsonAsync(
            "/auth/login",
            new { email = "admin@dragons.local", password = "AdminDragons!2026" }
        );
        login.EnsureSuccessStatusCode();

        var jwt = ApiTestAuth.ExtractSessionToken(login);
        Assert.False(string.IsNullOrWhiteSpace(jwt));

        Assert.True(login.Headers.TryGetValues("Set-Cookie", out var setCookies));
        var combined = string.Join("; ", setCookies!);
        Assert.Contains("dg_session=", combined, StringComparison.Ordinal);
        Assert.Contains("httponly", combined, StringComparison.OrdinalIgnoreCase);

        var body = await login.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(
            !body.TryGetProperty("token", out var tokenProp)
                || tokenProp.ValueKind == JsonValueKind.Null
                || string.IsNullOrWhiteSpace(tokenProp.GetString()),
            "Le JWT ne doit plus être renvoyé dans le corps JSON."
        );
        Assert.Equal("admin@dragons.local", body.GetProperty("user").GetProperty("email").GetString());
    }

    [Fact]
    public async Task Auth_me_works_with_session_cookie_only()
    {
        var login = await _cookieClient.PostAsJsonAsync(
            "/auth/login",
            new { email = "admin@dragons.local", password = "AdminDragons!2026" }
        );
        login.EnsureSuccessStatusCode();

        var me = await _cookieClient.GetAsync("/auth/me");
        me.EnsureSuccessStatusCode();
        var user = await me.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("admin@dragons.local", user.GetProperty("email").GetString());
    }

    [Fact]
    public async Task Auth_me_without_credentials_returns_unauthorized()
    {
        var me = await _anonClient.GetAsync("/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, me.StatusCode);
    }

    [Fact]
    public async Task Logout_clears_session_and_blocks_subsequent_auth_me()
    {
        var login = await _cookieClient.PostAsJsonAsync(
            "/auth/login",
            new { email = "admin@dragons.local", password = "AdminDragons!2026" }
        );
        login.EnsureSuccessStatusCode();

        (await _cookieClient.GetAsync("/auth/me")).EnsureSuccessStatusCode();

        var logout = await _cookieClient.PostAsync("/auth/logout", null);
        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);

        var me = await _cookieClient.GetAsync("/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, me.StatusCode);
    }

    [Fact]
    public async Task Bearer_token_still_works_for_api_clients()
    {
        var token = await ApiTestAuth.LoginAdminAsync(_anonClient);

        using var req = ApiTestAuth.Authed(HttpMethod.Get, "/auth/me", token);
        var me = await _anonClient.SendAsync(req);
        me.EnsureSuccessStatusCode();
        var user = await me.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("admin@dragons.local", user.GetProperty("email").GetString());
    }
}
