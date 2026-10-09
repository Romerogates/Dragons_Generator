using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DragonsGenerator.API.Tests;

[Collection("ApiIntegration")]
public class AnnouncementsIntegrationTests
{
    private readonly HttpClient _client;

    public AnnouncementsIntegrationTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateTestClient();
    }

    [Fact]
    public async Task Player_cannot_create_announcement()
    {
        var (_, token, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "annplayer");

        using var req = ApiTestAuth.Authed(HttpMethod.Post, "/admin/announcements", token);
        req.Content = JsonContent.Create(new { message = "Panne générale", severity = "outage" });
        var res = await _client.SendAsync(req);

        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Theory]
    [InlineData("ok", "info", 1)]
    [InlineData("Message valide", "panic", 1)]
    [InlineData("Message valide", "info", 0)]
    [InlineData("Message valide", "info", 61)]
    public async Task Create_rejects_invalid_input(string message, string severity, int days)
    {
        var adminToken = await ApiTestAuth.LoginAdminAsync(_client);

        using var req = ApiTestAuth.Authed(HttpMethod.Post, "/admin/announcements", adminToken);
        req.Content = JsonContent.Create(new { message, severity, durationDays = days });
        var res = await _client.SendAsync(req);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Active_announcement_reaches_banner_and_inbox_until_ended()
    {
        var adminToken = await ApiTestAuth.LoginAdminAsync(_client);
        var (_, playerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "annreader");

        Guid id;
        using (var create = ApiTestAuth.Authed(HttpMethod.Post, "/admin/announcements", adminToken))
        {
            create.Content = JsonContent.Create(new
            {
                message = "La génération IA est en maintenance ce soir.",
                severity = "outage",
                durationDays = 2,
            });
            var created = await _client.SendAsync(create);
            var raw = await created.Content.ReadAsStringAsync();
            Assert.True(created.IsSuccessStatusCode, raw);
            var body = JsonDocument.Parse(raw).RootElement;
            id = body.GetProperty("id").GetGuid();
            Assert.Equal("Incident en cours", body.GetProperty("title").GetString());
            Assert.True(body.GetProperty("active").GetBoolean());
        }

        try
        {
            var active = await _client.GetFromJsonAsync<JsonElement>("/announcements/active");
            Assert.Contains(active.EnumerateArray(), a => a.GetProperty("id").GetGuid() == id);

            using (var notifReq = ApiTestAuth.Authed(HttpMethod.Get, "/me/notifications", playerToken))
            {
                var notif = await _client.SendAsync(notifReq);
                notif.EnsureSuccessStatusCode();
                var summary = await notif.Content.ReadFromJsonAsync<NotificationsSummaryResponse>();
                Assert.Contains(
                    summary!.Notifications,
                    n => n.Kind == "announcement" && n.ActionPath == $"/notifications?announcement={id}");
            }

            using (var end = ApiTestAuth.Authed(HttpMethod.Post, $"/admin/announcements/{id}/end", adminToken))
            {
                var ended = await _client.SendAsync(end);
                ended.EnsureSuccessStatusCode();
                var body = await ended.Content.ReadFromJsonAsync<JsonElement>();
                Assert.False(body.GetProperty("active").GetBoolean());
            }

            var afterEnd = await _client.GetFromJsonAsync<JsonElement>("/announcements/active");
            Assert.DoesNotContain(afterEnd.EnumerateArray(), a => a.GetProperty("id").GetGuid() == id);

            using (var list = ApiTestAuth.Authed(HttpMethod.Get, "/admin/announcements", adminToken))
            {
                var history = await (await _client.SendAsync(list)).Content.ReadFromJsonAsync<JsonElement>();
                Assert.Contains(history.EnumerateArray(), a => a.GetProperty("id").GetGuid() == id);
            }
        }
        finally
        {
            using var del = ApiTestAuth.Authed(HttpMethod.Delete, $"/admin/announcements/{id}", adminToken);
            Assert.Equal(HttpStatusCode.NoContent, (await _client.SendAsync(del)).StatusCode);
        }
    }
}
