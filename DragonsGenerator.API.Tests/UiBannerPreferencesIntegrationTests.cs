using System.Net.Http.Json;
using System.Text.Json;

namespace DragonsGenerator.API.Tests;

[Collection("ApiIntegration")]
public class UiBannerPreferencesIntegrationTests
{
    private readonly HttpClient _client;

    public UiBannerPreferencesIntegrationTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateTestClient();
    }

    [Fact]
    public async Task Ui_banner_preferences_roundtrip()
    {
        var (_, token, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "bannerprefs");

        using (var getEmpty = ApiTestAuth.Authed(HttpMethod.Get, "/me/ui-banner-preferences", token))
        {
            var res = await _client.SendAsync(getEmpty);
            res.EnsureSuccessStatusCode();
            var json = await res.Content.ReadFromJsonAsync<JsonElement>();
            Assert.False(json.GetProperty("hideAllBanners").GetBoolean());
            Assert.Equal(0, json.GetProperty("dismissedBannerIds").GetArrayLength());
        }

        using (var put = ApiTestAuth.Authed(HttpMethod.Put, "/me/ui-banner-preferences", token))
        {
            put.Content = JsonContent.Create(new
            {
                hideAllBanners = true,
                dismissedBannerIds = new[] { "setup-guide", "dungeon-toast" },
            });
            var res = await _client.SendAsync(put);
            res.EnsureSuccessStatusCode();
            var json = await res.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(json.GetProperty("hideAllBanners").GetBoolean());
            Assert.Equal(2, json.GetProperty("dismissedBannerIds").GetArrayLength());
        }

        using (var getAgain = ApiTestAuth.Authed(HttpMethod.Get, "/me/ui-banner-preferences", token))
        {
            var res = await _client.SendAsync(getAgain);
            res.EnsureSuccessStatusCode();
            var json = await res.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(json.GetProperty("hideAllBanners").GetBoolean());
            var ids = json.GetProperty("dismissedBannerIds").EnumerateArray().Select(e => e.GetString()).ToArray();
            Assert.Contains("setup-guide", ids);
            Assert.Contains("dungeon-toast", ids);
        }
    }

    [Fact]
    public async Task Ui_banner_preferences_requires_auth()
    {
        var res = await _client.GetAsync("/me/ui-banner-preferences");
        Assert.Equal(System.Net.HttpStatusCode.Unauthorized, res.StatusCode);
    }
}
