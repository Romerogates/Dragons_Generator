using System.Net.Http.Json;
using System.Text.Json;

namespace DragonsGenerator.API.Tests;

[Collection("ApiIntegration")]
public class GuidePreferencesIntegrationTests
{
    private readonly HttpClient _client;

    public GuidePreferencesIntegrationTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Guide_preferences_roundtrip_and_merge()
    {
        var (_, token, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "guideprefs");

        using (var getEmpty = ApiTestAuth.Authed(HttpMethod.Get, "/me/guide-preferences", token))
        {
            var res = await _client.SendAsync(getEmpty);
            res.EnsureSuccessStatusCode();
            var json = await res.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(0, json.GetProperty("readNewsIds").GetArrayLength());
        }

        using (var put = ApiTestAuth.Authed(HttpMethod.Put, "/me/guide-preferences", token))
        {
            put.Content = JsonContent.Create(new
            {
                readNewsIds = new[] { "news-donjon-v1", "news-campagne-vide-handout" },
                audience = "dm",
            });
            var res = await _client.SendAsync(put);
            res.EnsureSuccessStatusCode();
            var json = await res.Content.ReadFromJsonAsync<JsonElement>();
            var ids = json.GetProperty("readNewsIds").EnumerateArray().Select(e => e.GetString()).ToArray();
            Assert.Equal(2, ids.Length);
            Assert.Contains("news-donjon-v1", ids);
        }

        using (var getAgain = ApiTestAuth.Authed(HttpMethod.Get, "/me/guide-preferences", token))
        {
            var res = await _client.SendAsync(getAgain);
            res.EnsureSuccessStatusCode();
            var json = await res.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(2, json.GetProperty("readNewsIds").GetArrayLength());
        }

        using (var putReplace = ApiTestAuth.Authed(HttpMethod.Put, "/me/guide-preferences", token))
        {
            putReplace.Content = JsonContent.Create(new { readNewsIds = new[] { "news-donjon-v1" } });
            (await _client.SendAsync(putReplace)).EnsureSuccessStatusCode();
        }

        using (var getFinal = ApiTestAuth.Authed(HttpMethod.Get, "/me/guide-preferences", token))
        {
            var res = await _client.SendAsync(getFinal);
            res.EnsureSuccessStatusCode();
            var json = await res.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Single(json.GetProperty("readNewsIds").EnumerateArray());
        }
    }

    [Fact]
    public async Task Guide_preferences_requires_auth()
    {
        var res = await _client.GetAsync("/me/guide-preferences");
        Assert.Equal(System.Net.HttpStatusCode.Unauthorized, res.StatusCode);
    }
}
