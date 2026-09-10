using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;

namespace DragonsGenerator.API.Tests;

[Collection("ApiIntegration")]
public class CampaignLiveHubTests
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public CampaignLiveHubTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateTestClient();
    }

    [Fact]
    public async Task JoinCampaign_MemberReceivesUpdate_OnPut()
    {
        var (_, token, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "livehub");

        Guid campaignId;
        using (var create = ApiTestAuth.Authed(HttpMethod.Post, "/me/campaigns", token))
        {
            create.Content = JsonContent.Create(new
            {
                title = "Table live",
                data = new { activeSessionId = (string?)null, sessions = Array.Empty<object>() },
            });
            var created = await _client.SendAsync(create);
            created.EnsureSuccessStatusCode();
            var summary = await created.Content.ReadFromJsonAsync<JsonElement>();
            campaignId = summary.GetProperty("id").GetGuid();
        }

        var tcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        await using var hub = new HubConnectionBuilder()
            .WithUrl(new Uri(_factory.Server.BaseAddress!, "/hubs/campaign-live"), o =>
            {
                o.HttpMessageHandlerFactory = _ => _factory.Server.CreateHandler();
                o.AccessTokenProvider = () => Task.FromResult<string?>(token);
            })
            .Build();

        hub.On<JsonElement>("campaignUpdated", payload => tcs.TrySetResult(payload));
        await hub.StartAsync();
        await hub.InvokeAsync("JoinCampaign", campaignId);

        using (var put = ApiTestAuth.Authed(HttpMethod.Put, $"/me/campaigns/{campaignId}", token))
        {
            put.Content = JsonContent.Create(new
            {
                title = "Table live sync",
                data = new { activeSessionId = (string?)null, sessions = Array.Empty<object>(), notes = "maj" },
            });
            var updated = await _client.SendAsync(put);
            updated.EnsureSuccessStatusCode();
        }

        var completed = await Task.WhenAny(tcs.Task, Task.Delay(TimeSpan.FromSeconds(8)));
        Assert.Same(tcs.Task, completed);
        var evt = await tcs.Task;
        Assert.Equal(campaignId.ToString("D"), evt.GetProperty("campaignId").GetString());
        Assert.Equal("campaign", evt.GetProperty("reason").GetString());

        await hub.InvokeAsync("LeaveCampaign", campaignId);
        await hub.StopAsync();
    }

    [Fact]
    public async Task JoinCampaign_RejectsNonMember()
    {
        var (_, ownerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "liveown");
        var (_, strangerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "livestr");

        Guid campaignId;
        using (var create = ApiTestAuth.Authed(HttpMethod.Post, "/me/campaigns", ownerToken))
        {
            create.Content = JsonContent.Create(new { title = "Privée", data = new { } });
            var created = await _client.SendAsync(create);
            created.EnsureSuccessStatusCode();
            campaignId = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        }

        await using var hub = new HubConnectionBuilder()
            .WithUrl(new Uri(_factory.Server.BaseAddress!, "/hubs/campaign-live"), o =>
            {
                o.HttpMessageHandlerFactory = _ => _factory.Server.CreateHandler();
                o.AccessTokenProvider = () => Task.FromResult<string?>(strangerToken);
            })
            .Build();

        await hub.StartAsync();
        var ex = await Assert.ThrowsAsync<HubException>(() => hub.InvokeAsync("JoinCampaign", campaignId));
        Assert.Contains("introuvable", ex.Message, StringComparison.OrdinalIgnoreCase);
        await hub.StopAsync();
    }
}
