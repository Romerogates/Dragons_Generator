using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DragonsGenerator.API.Tests;

[Collection("ApiIntegration")]
public class AdminStatsIntegrationTests
{
    private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };
    private readonly HttpClient _client;

    public AdminStatsIntegrationTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateTestClient();
    }

    [Fact]
    public async Task Player_cannot_read_admin_stats()
    {
        var (_, token, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "statplayer");
        using var req = ApiTestAuth.Authed(HttpMethod.Get, "/admin/stats", token);
        var res = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Fact]
    public async Task Admin_stats_includes_server_http_and_tokens()
    {
        var adminToken = await ApiTestAuth.LoginAdminAsync(_client);
        using var req = ApiTestAuth.Authed(HttpMethod.Get, "/admin/stats", adminToken);
        var res = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var json = await res.Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.True(json.GetProperty("users").GetInt32() >= 1);
        Assert.True(json.GetProperty("totalTokens").GetInt64() >= 0);
        Assert.True(json.GetProperty("server").GetProperty("workingSetBytes").GetInt64() > 0);
        Assert.True(json.GetProperty("server").TryGetProperty("hostMemoryTotalBytes", out _));
        Assert.True(json.GetProperty("http").GetProperty("requestsSinceStart").GetInt32() >= 1);
        Assert.True(json.GetProperty("generationsByKind").ValueKind is JsonValueKind.Array);
        Assert.True(json.GetProperty("generationsByProvider").ValueKind is JsonValueKind.Array);
    }
}
