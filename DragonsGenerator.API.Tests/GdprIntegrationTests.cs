using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DragonsGenerator.API.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DragonsGenerator.API.Tests;

[Collection("ApiIntegration")]
public class GdprIntegrationTests
{
    private readonly HttpClient _client;
    private readonly CustomWebApplicationFactory _factory;

    public GdprIntegrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
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

    [Fact]
    public async Task Google_user_sets_password_without_current_and_deletes_with_email()
    {
        var (email, token, userId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "ggl");

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var user = await db.Users.FindAsync(userId);
            Assert.NotNull(user);
            user!.GoogleSubject = $"google-{userId:N}";
            await db.SaveChangesAsync();
        }

        using (var meReq = ApiTestAuth.Authed(HttpMethod.Get, "/auth/me", token))
        {
            var me = await _client.SendAsync(meReq);
            me.EnsureSuccessStatusCode();
            var json = JsonDocument.Parse(await me.Content.ReadAsStringAsync()).RootElement;
            Assert.True(json.GetProperty("googleLinked").GetBoolean());
        }

        using (var changeReq = ApiTestAuth.Authed(HttpMethod.Post, "/auth/change-password", token))
        {
            changeReq.Content = JsonContent.Create(new { newPassword = "GooglePass123!" });
            var changed = await _client.SendAsync(changeReq);
            Assert.True(changed.IsSuccessStatusCode, await changed.Content.ReadAsStringAsync());
        }

        var login = await _client.PostAsJsonAsync(
            "/auth/login",
            new { email, password = "GooglePass123!" }
        );
        login.EnsureSuccessStatusCode();

        using (var badDelete = ApiTestAuth.Authed(HttpMethod.Delete, "/auth/me", token))
        {
            badDelete.Content = JsonContent.Create(new { confirmEmail = "wrong@dragons.local" });
            var rejected = await _client.SendAsync(badDelete);
            Assert.Equal(HttpStatusCode.BadRequest, rejected.StatusCode);
        }

        using (var deleteReq = ApiTestAuth.Authed(HttpMethod.Delete, "/auth/me", token))
        {
            deleteReq.Content = JsonContent.Create(new { confirmEmail = email });
            var deleted = await _client.SendAsync(deleteReq);
            Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        }
    }
}
