using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DragonsGenerator.API.Tests;

[Collection("ApiIntegration")]
public class GdprIntegrationTests
{
    private readonly HttpClient _client;

    public GdprIntegrationTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateTestClient();
    }

    [Fact]
    public async Task Register_requires_accept_terms()
    {
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var register = await _client.PostAsJsonAsync(
            "/auth/register",
            new
            {
                email = $"noterms-{suffix}@dragons.local",
                password = "TestPass123!",
                displayName = $"Hero{suffix}",
                acceptTerms = false,
            }
        );
        Assert.False(register.IsSuccessStatusCode);
    }

    [Fact]
    public async Task Export_and_delete_account_works_for_regular_user()
    {
        const string password = "TestPass123!";
        var (_, token, userId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "gdpr");

        using (var charReq = ApiTestAuth.Authed(
                   HttpMethod.Post,
                   "/me/characters",
                   token))
        {
            charReq.Content = JsonContent.Create(
                new { name = "Export Hero", data = new { name = "Export Hero", level = 1 } }
            );
            var created = await _client.SendAsync(charReq);
            created.EnsureSuccessStatusCode();
        }

        using (var exportReq = ApiTestAuth.Authed(HttpMethod.Get, "/me/export", token))
        {
            var export = await _client.SendAsync(exportReq);
            export.EnsureSuccessStatusCode();
            var json = await export.Content.ReadAsStringAsync();
            Assert.Contains("Export Hero", json);
            Assert.Contains(userId.ToString(), json, StringComparison.OrdinalIgnoreCase);
        }

        using (var deleteReq = ApiTestAuth.Authed(HttpMethod.Delete, "/auth/me", token))
        {
            deleteReq.Content = JsonContent.Create(new { currentPassword = password });
            var deleted = await _client.SendAsync(deleteReq);
            Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        }

        using (var meReq = ApiTestAuth.Authed(HttpMethod.Get, "/auth/me", token))
        {
            var me = await _client.SendAsync(meReq);
            Assert.Equal(HttpStatusCode.Unauthorized, me.StatusCode);
        }
    }

    [Fact]
    public async Task Delete_account_rejects_wrong_password()
    {
        var (_, token, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "gdprbad");

        using var deleteReq = ApiTestAuth.Authed(HttpMethod.Delete, "/auth/me", token);
        deleteReq.Content = JsonContent.Create(new { currentPassword = "WrongPass999!" });
        var deleted = await _client.SendAsync(deleteReq);
        Assert.Equal(HttpStatusCode.Unauthorized, deleted.StatusCode);
    }
}
