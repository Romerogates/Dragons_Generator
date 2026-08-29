using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace DragonsGenerator.API.Tests;

[Collection("ApiIntegration")]
public class ApiIntegrationTests
{
    private readonly HttpClient _client;

    public ApiIntegrationTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

  [Theory]
  [InlineData("/species")]
  [InlineData("/species/summary")]
  [InlineData("/health")]
  [InlineData("/classes")]
  [InlineData("/classes/summary")]
  [InlineData("/skills")]
  [InlineData("/skills/summary")]
  [InlineData("/equipments")]
  [InlineData("/equipments/summary")]
  [InlineData("/backgrounds")]
  public async Task Public_catalog_endpoints_return_success(string path)
    {
        var response = await _client.GetAsync(path);
        Assert.True(response.IsSuccessStatusCode, $"{path} → {response.StatusCode}");
        var json = await response.Content.ReadAsStringAsync();
        Assert.False(string.IsNullOrWhiteSpace(json));
    }

    [Fact]
    public async Task Get_equipment_by_id_returns_dague()
    {
        var response = await _client.GetAsync("/equipments/wp-dague");
        Assert.True(response.IsSuccessStatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("wp-dague", body.GetProperty("id").GetString());
    }

    [Fact]
    public async Task Register_and_login_flow_works()
    {
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var email = $"test-{suffix}@dragons.local";
        var password = "TestPass123!";
        var register = await _client.PostAsJsonAsync(
            "/auth/register",
            new { email, password, displayName = $"Hero{suffix}" }
        );
        var registerBody = await register.Content.ReadAsStringAsync();
        Assert.True(
            register.IsSuccessStatusCode,
            $"register → {(int)register.StatusCode} {registerBody}"
        );

        var regJson = JsonDocument.Parse(registerBody).RootElement;
        var confirmLink = regJson.GetProperty("confirmLink").GetString();
        Assert.False(string.IsNullOrWhiteSpace(confirmLink));

        var blocked = await _client.PostAsJsonAsync("/auth/login", new { email, password });
        Assert.Equal(System.Net.HttpStatusCode.Forbidden, blocked.StatusCode);

        var confirm = await _client.GetAsync("/auth/confirm-email?token=invalid");
        Assert.False(confirm.IsSuccessStatusCode);

        var tokenParam = confirmLink!.Split("token=", 2)[1];
        var confirmOk = await _client.GetAsync(
            $"/auth/confirm-email?token={Uri.EscapeDataString(Uri.UnescapeDataString(tokenParam))}"
        );
        confirmOk.EnsureSuccessStatusCode();

        var login = await _client.PostAsJsonAsync("/auth/login", new { email, password });
        var loginBody = await login.Content.ReadAsStringAsync();
        Assert.True(login.IsSuccessStatusCode, $"login → {(int)login.StatusCode} {loginBody}");
        var auth = JsonDocument.Parse(loginBody).RootElement;
        var token = auth.GetProperty("token").GetString();
        Assert.False(string.IsNullOrWhiteSpace(token));

        using var req = ApiTestAuth.Authed(HttpMethod.Get, "/auth/me", token!);
        var me = await _client.SendAsync(req);
        Assert.True(me.IsSuccessStatusCode);
        var user = await me.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(email, user.GetProperty("email").GetString());
    }

    [Fact]
    public async Task Protected_me_campaigns_requires_auth()
    {
        var anon = await _client.GetAsync("/me/campaigns");
        Assert.Equal(System.Net.HttpStatusCode.Unauthorized, anon.StatusCode);

        var login = await _client.PostAsJsonAsync(
            "/auth/login",
            new { email = "admin@dragons.local", password = "AdminDragons!2026" }
        );
        var auth = await login.Content.ReadFromJsonAsync<JsonElement>();
        var token = auth.GetProperty("token").GetString();

        using var req = new HttpRequestMessage(HttpMethod.Get, "/me/campaigns");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await _client.SendAsync(req);
        Assert.True(response.IsSuccessStatusCode);
    }
}
