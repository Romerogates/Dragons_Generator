using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DragonsGenerator.API.Tests;

public partial class HomeAndCampaignFeatureTests
{

    [Fact]
    public async Task Campaign_invite_decline_clears_pending_and_allows_reinvite()
    {
        var (_, ownerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "declowner");
        var (_, playerToken, playerId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "declplayer");

        var campaignId = await CreateEmptyCampaignAsync(ownerToken, "Campagne decline");
        await EnsureFriendsAsync(ownerToken, playerToken, playerId);
        var inviteId = await SendCampaignInviteAsync(ownerToken, playerToken, playerId, campaignId);

        using (var declineReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaign-invites/{inviteId}/decline", playerToken))
        {
            (await _client.SendAsync(declineReq)).EnsureSuccessStatusCode();
        }

        using (var listInv = ApiTestAuth.Authed(HttpMethod.Get, "/me/campaign-invites", playerToken))
        {
            var inv = await _client.SendAsync(listInv);
            inv.EnsureSuccessStatusCode();
            var arr = await inv.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Empty(arr!.EnumerateArray());
        }

        using (var detailReq = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}", ownerToken))
        {
            var detail = await _client.SendAsync(detailReq);
            detail.EnsureSuccessStatusCode();
            var body = await detail.Content.ReadFromJsonAsync<JsonElement>();
            var members = body!.GetProperty("members").EnumerateArray().ToList();
            Assert.DoesNotContain(members, m => m.GetProperty("userId").GetGuid() == playerId);
        }

        using (var declineAgain = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaign-invites/{inviteId}/decline", playerToken))
        {
            var res = await _client.SendAsync(declineAgain);
            Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        }

        using (var acceptDeclined = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaign-invites/{inviteId}/accept", playerToken))
        {
            var res = await _client.SendAsync(acceptDeclined);
            Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        }

        var reinviteId = await SendCampaignInviteAsync(ownerToken, playerToken, playerId, campaignId);
        using (var acceptReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaign-invites/{reinviteId}/accept", playerToken))
        {
            (await _client.SendAsync(acceptReq)).EnsureSuccessStatusCode();
        }

        using (var detailAfter = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}", ownerToken))
        {
            var detail = await _client.SendAsync(detailAfter);
            detail.EnsureSuccessStatusCode();
            var body = await detail.Content.ReadFromJsonAsync<JsonElement>();
            var members = body!.GetProperty("members").EnumerateArray().ToList();
            Assert.Contains(members, m => m.GetProperty("userId").GetGuid() == playerId);
        }
    }

    [Fact]
    public async Task Campaign_invite_decline_by_other_user_returns_not_found()
    {
        var (_, ownerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "declothowner");
        var (_, playerToken, playerId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "declothplayer");
        var (_, strangerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "declothstranger");

        var campaignId = await CreateEmptyCampaignAsync(ownerToken, "Campagne invite étrangère");
        await EnsureFriendsAsync(ownerToken, playerToken, playerId);
        var inviteId = await SendCampaignInviteAsync(ownerToken, playerToken, playerId, campaignId);

        using (var declineReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaign-invites/{inviteId}/decline", strangerToken))
        {
            var res = await _client.SendAsync(declineReq);
            Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        }

        using (var listInv = ApiTestAuth.Authed(HttpMethod.Get, "/me/campaign-invites", playerToken))
        {
            var inv = await _client.SendAsync(listInv);
            inv.EnsureSuccessStatusCode();
            var arr = await inv.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Contains(arr!.EnumerateArray(), i => i.GetProperty("id").GetGuid() == inviteId);
        }
    }

    [Fact]
    public async Task Campaign_invite_duplicate_pending_and_non_friend_are_rejected()
    {
        var (_, ownerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "dupowner");
        var (_, playerToken, playerId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "dupplayer");
        var (_, _, strangerId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "dupstranger");

        var campaignId = await CreateEmptyCampaignAsync(ownerToken, "Campagne conflits invite");

        using (var nonFriendInvite = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaigns/{campaignId}/invites", ownerToken))
        {
            nonFriendInvite.Content = JsonContent.Create(new { userId = strangerId });
            var res = await _client.SendAsync(nonFriendInvite);
            Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        }

        await EnsureFriendsAsync(ownerToken, playerToken, playerId);
        _ = await SendCampaignInviteAsync(ownerToken, playerToken, playerId, campaignId);

        using (var dupInvite = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaigns/{campaignId}/invites", ownerToken))
        {
            dupInvite.Content = JsonContent.Create(new { userId = playerId });
            var res = await _client.SendAsync(dupInvite);
            Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
        }
    }

    [Fact]
    public async Task Campaign_join_link_allows_non_friend_to_join()
    {
        var (_, ownerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "joinowner");
        var (_, playerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "joinplayer");
        var campaignId = await CreateEmptyCampaignAsync(ownerToken, "Campagne lien");

        string token;
        using (var createLink = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaigns/{campaignId}/join-link", ownerToken))
        {
            var res = await _client.SendAsync(createLink);
            res.EnsureSuccessStatusCode();
            var body = await res.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(body!.GetProperty("enabled").GetBoolean());
            token = body.GetProperty("token").GetString()!;
            Assert.False(string.IsNullOrWhiteSpace(token));
        }

        using (var preview = new HttpRequestMessage(HttpMethod.Get, $"/join/{token}"))
        {
            var res = await _client.SendAsync(preview);
            res.EnsureSuccessStatusCode();
            var body = await res.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(campaignId, body!.GetProperty("campaignId").GetGuid());
            Assert.Equal("Campagne lien", body.GetProperty("title").GetString());
            Assert.False(body.GetProperty("alreadyMember").GetBoolean());
        }

        using (var join = ApiTestAuth.Authed(HttpMethod.Post, $"/me/join/{token}", playerToken))
        {
            var res = await _client.SendAsync(join);
            res.EnsureSuccessStatusCode();
            var body = await res.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(campaignId, body!.GetProperty("id").GetGuid());
            Assert.Equal("player", body.GetProperty("role").GetString());
        }

        using (var previewAgain = ApiTestAuth.Authed(HttpMethod.Get, $"/join/{token}", playerToken))
        {
            var res = await _client.SendAsync(previewAgain);
            res.EnsureSuccessStatusCode();
            var body = await res.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(body!.GetProperty("alreadyMember").GetBoolean());
        }

        using (var revoke = ApiTestAuth.Authed(HttpMethod.Delete, $"/me/campaigns/{campaignId}/join-link", ownerToken))
        {
            (await _client.SendAsync(revoke)).EnsureSuccessStatusCode();
        }

        using (var joinAfterRevoke = ApiTestAuth.Authed(HttpMethod.Post, $"/me/join/{token}", playerToken))
        {
            var res = await _client.SendAsync(joinAfterRevoke);
            Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        }
    }

    [Fact]
    public async Task Split_campaign_endpoint_files_keep_existing_routes()
    {
        var (_, ownerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "splitowner");
        var campaignId = await CreateEmptyCampaignAsync(ownerToken, "Split routes");

        using (var list = ApiTestAuth.Authed(HttpMethod.Get, "/me/campaigns", ownerToken))
        {
            var res = await _client.SendAsync(list);
            res.EnsureSuccessStatusCode();
            var arr = await res.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Contains(arr.EnumerateArray(), c => c.GetProperty("id").GetGuid() == campaignId);
        }

        using (var detail = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}", ownerToken))
        {
            (await _client.SendAsync(detail)).EnsureSuccessStatusCode();
        }

        using (var pending = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}/invites", ownerToken))
        {
            (await _client.SendAsync(pending)).EnsureSuccessStatusCode();
        }

        using (var xp = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaigns/{campaignId}/award-xp", ownerToken))
        {
            xp.Content = JsonContent.Create(new { memberId = Guid.Empty, xp = 0 });
            var res = await _client.SendAsync(xp);
            Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        }

        using (var assign = ApiTestAuth.Authed(
            HttpMethod.Post,
            $"/me/campaigns/{campaignId}/pregens/{Guid.NewGuid()}/assign",
            ownerToken))
        {
            assign.Content = JsonContent.Create(new { userId = Guid.NewGuid(), displayName = "X" });
            var res = await _client.SendAsync(assign);
            Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        }

        using (var memberChar = ApiTestAuth.Authed(
            HttpMethod.Get,
            $"/me/campaigns/{campaignId}/members/{Guid.NewGuid()}/character",
            ownerToken))
        {
            var res = await _client.SendAsync(memberChar);
            Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        }

        using (var archive = ApiTestAuth.Authed(HttpMethod.Put, $"/me/campaigns/{campaignId}/archive", ownerToken))
        {
            archive.Content = JsonContent.Create(new { archived = true });
            (await _client.SendAsync(archive)).EnsureSuccessStatusCode();
        }
    }

    [Fact]
    public async Task Friend_shared_character_is_readable_by_friend_only()
    {
        var (_, ownerToken, ownerId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "shareowner");
        var (_, friendToken, friendId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "sharefriend");
        var (_, strangerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "sharestranger");
        await EnsureFriendsAsync(ownerToken, friendToken, friendId);

        Guid characterId;
        using (var createChar = ApiTestAuth.Authed(HttpMethod.Post, "/me/characters", ownerToken))
        {
            createChar.Content = JsonContent.Create(new
            {
                name = "Héros partagé",
                data = JsonDocument.Parse("""{"name":"Héros partagé","totalLevel":1}""").RootElement,
            });
            var res = await _client.SendAsync(createChar);
            res.EnsureSuccessStatusCode();
            var body = await res.Content.ReadFromJsonAsync<JsonElement>();
            characterId = body!.GetProperty("id").GetGuid();
        }

        using (var ok = ApiTestAuth.Authed(HttpMethod.Get, $"/me/friends/{ownerId}/characters/{characterId}", friendToken))
        {
            var res = await _client.SendAsync(ok);
            res.EnsureSuccessStatusCode();
            var body = await res.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Héros partagé", body!.GetProperty("name").GetString());
        }

        using (var denied = ApiTestAuth.Authed(HttpMethod.Get, $"/me/friends/{ownerId}/characters/{characterId}", strangerToken))
        {
            var res = await _client.SendAsync(denied);
            Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        }
    }
}
