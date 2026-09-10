using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DragonsGenerator.API.Tests;

[Collection("ApiIntegration")]
public class GuideCommentsIntegrationTests
{
    private readonly HttpClient _client;

    public GuideCommentsIntegrationTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateTestClient();
    }

    [Fact]
    public async Task Guide_comments_crud_like_and_sort()
    {
        var (_, tokenA, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "guidecmtA");
        var (_, tokenB, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "guidecmtB");
        const string topic = "faq";

        Guid rootId;
        using (var post = ApiTestAuth.Authed(HttpMethod.Post, $"/guide/topics/{topic}/comments", tokenA))
        {
            post.Content = JsonContent.Create(new { body = "Premier avis utile", parentId = (string?)null });
            var res = await _client.SendAsync(post);
            res.EnsureSuccessStatusCode();
            var json = await res.Content.ReadFromJsonAsync<JsonElement>();
            rootId = json.GetProperty("id").GetGuid();
            Assert.Equal(0, json.GetProperty("likeCount").GetInt32());
            Assert.Equal("half", json.GetProperty("widgetSize").GetString());
        }

        Guid popularId;
        using (var post = ApiTestAuth.Authed(HttpMethod.Post, $"/guide/topics/{topic}/comments", tokenB))
        {
            post.Content = JsonContent.Create(new { body = "Réponse très likée", widgetSize = "third" });
            var res = await _client.SendAsync(post);
            res.EnsureSuccessStatusCode();
            var json = await res.Content.ReadFromJsonAsync<JsonElement>();
            popularId = json.GetProperty("id").GetGuid();
            Assert.Equal("third", json.GetProperty("widgetSize").GetString());
        }

        using (var layout = ApiTestAuth.Authed(HttpMethod.Patch, $"/guide/comments/{popularId}/layout", tokenA))
        {
            layout.Content = JsonContent.Create(new { widgetSize = "full", sortOrder = 0 });
            var res = await _client.SendAsync(layout);
            res.EnsureSuccessStatusCode();
            var json = await res.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("full", json.GetProperty("widgetSize").GetString());
            Assert.Equal(0, json.GetProperty("sortOrder").GetInt32());
        }

        using (var like = ApiTestAuth.Authed(HttpMethod.Post, $"/guide/comments/{popularId}/like", tokenA))
        {
            var res = await _client.SendAsync(like);
            res.EnsureSuccessStatusCode();
            var json = await res.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(1, json.GetProperty("likeCount").GetInt32());
            Assert.True(json.GetProperty("likedByMe").GetBoolean());
        }

        using (var likeAgain = ApiTestAuth.Authed(HttpMethod.Post, $"/guide/comments/{popularId}/like", tokenB))
        {
            (await _client.SendAsync(likeAgain)).EnsureSuccessStatusCode();
        }

        using (var reply = ApiTestAuth.Authed(HttpMethod.Post, $"/guide/topics/{topic}/comments", tokenA))
        {
            reply.Content = JsonContent.Create(new { body = "Réponse niveau 1", parentId = rootId });
            (await _client.SendAsync(reply)).EnsureSuccessStatusCode();
        }

        using (var list = ApiTestAuth.Authed(HttpMethod.Get, $"/guide/topics/{topic}/comments", tokenA))
        {
            var res = await _client.SendAsync(list);
            res.EnsureSuccessStatusCode();
            var arr = await res.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(arr.GetArrayLength() >= 3);
            var first = arr[0];
            Assert.Equal(popularId, first.GetProperty("id").GetGuid());
            Assert.True(first.GetProperty("likeCount").GetInt32() >= 2);
        }

        using (var stats = ApiTestAuth.Authed(HttpMethod.Get, "/guide/topics/stats", tokenA))
        {
            var res = await _client.SendAsync(stats);
            res.EnsureSuccessStatusCode();
            var arr = await res.Content.ReadFromJsonAsync<JsonElement>();
            var hit = arr.EnumerateArray().First(e => e.GetProperty("topicId").GetString() == topic);
            Assert.True(hit.GetProperty("commentCount").GetInt32() >= 3);
            Assert.NotEqual(JsonValueKind.Null, hit.GetProperty("lastCommentAt").ValueKind);
        }

        using (var del = ApiTestAuth.Authed(HttpMethod.Delete, $"/guide/comments/{rootId}", tokenA))
        {
            var res = await _client.SendAsync(del);
            Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
        }
    }

    [Fact]
    public async Task Guide_comment_create_requires_auth()
    {
        var res = await _client.PostAsJsonAsync("/guide/topics/faq/comments", new { body = "nope" });
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }
}
