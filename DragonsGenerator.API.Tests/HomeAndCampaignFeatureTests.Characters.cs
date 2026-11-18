using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DragonsGenerator.API.Tests;

public partial class HomeAndCampaignFeatureTests
{

    [Fact]
    public async Task Dm_can_view_proposed_and_approved_player_character_in_campaign()
    {
        var (_, ownerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "sheetowner");
        var (_, playerToken, playerId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "sheetplayer");

        Guid campaignId;
        using (var createReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/campaigns", ownerToken))
        {
            createReq.Content = JsonContent.Create(new
            {
                title = "Campagne fiches joueurs",
                data = JsonDocument.Parse("{}").RootElement,
            });
            var create = await _client.SendAsync(createReq);
            create.EnsureSuccessStatusCode();
            var created = await create.Content.ReadFromJsonAsync<JsonElement>();
            campaignId = created!.GetProperty("id").GetGuid();
        }

        Guid characterId;
        using (var charReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/characters", playerToken))
        {
            charReq.Content = JsonContent.Create(new
            {
                name = "Eldrin",
                data = JsonDocument.Parse("""{"name":"Eldrin","totalLevel":3,"classes":[{"classLabel":"Guerrier","level":3}]}""").RootElement,
            });
            var created = await _client.SendAsync(charReq);
            created.EnsureSuccessStatusCode();
            var body = await created.Content.ReadFromJsonAsync<JsonElement>();
            characterId = body!.GetProperty("id").GetGuid();
        }

        await InvitePlayerToCampaignAsync(ownerToken, playerToken, playerId, campaignId);

        using (var proposeReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaigns/{campaignId}/propose-character", playerToken))
        {
            proposeReq.Content = JsonContent.Create(new { characterId });
            (await _client.SendAsync(proposeReq)).EnsureSuccessStatusCode();
        }

        Guid memberId;
        using (var detailReq = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}", ownerToken))
        {
            var detail = await _client.SendAsync(detailReq);
            detail.EnsureSuccessStatusCode();
            var body = await detail.Content.ReadFromJsonAsync<JsonElement>();
            memberId = body!.GetProperty("members").EnumerateArray()
                .First(m => m.GetProperty("userId").GetGuid() == playerId)
                .GetProperty("id").GetGuid();
        }

        using (var ownerDirectReq = ApiTestAuth.Authed(HttpMethod.Get, $"/me/characters/{characterId}", ownerToken))
        {
            var resp = await _client.SendAsync(ownerDirectReq);
            Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
        }

        using (var proposedReq = ApiTestAuth.Authed(
            HttpMethod.Get,
            $"/me/campaigns/{campaignId}/members/{memberId}/character?scope=proposed",
            ownerToken))
        {
            var resp = await _client.SendAsync(proposedReq);
            resp.EnsureSuccessStatusCode();
            var sheet = await resp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Eldrin", sheet!.GetProperty("name").GetString());
        }

        using (var approveReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaigns/{campaignId}/members/{memberId}/approve", ownerToken))
        {
            (await _client.SendAsync(approveReq)).EnsureSuccessStatusCode();
        }

        using (var approvedReq = ApiTestAuth.Authed(
            HttpMethod.Get,
            $"/me/campaigns/{campaignId}/members/{memberId}/character?scope=approved",
            ownerToken))
        {
            var resp = await _client.SendAsync(approvedReq);
            resp.EnsureSuccessStatusCode();
            var sheet = await resp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Eldrin", sheet!.GetProperty("name").GetString());
        }

        using (var removeReq = ApiTestAuth.Authed(
            HttpMethod.Delete,
            $"/me/campaigns/{campaignId}/members/{memberId}",
            ownerToken))
        {
            (await _client.SendAsync(removeReq)).EnsureSuccessStatusCode();
        }

        using (var detailAfterReq = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}", ownerToken))
        {
            var detail = await _client.SendAsync(detailAfterReq);
            detail.EnsureSuccessStatusCode();
            var body = await detail.Content.ReadFromJsonAsync<JsonElement>();
            var members = body!.GetProperty("members").EnumerateArray().ToList();
            Assert.DoesNotContain(members, m => m.GetProperty("userId").GetGuid() == playerId);
        }

        using (var inviteAgainReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaigns/{campaignId}/invites", ownerToken))
        {
            inviteAgainReq.Content = JsonContent.Create(new { userId = playerId });
            (await _client.SendAsync(inviteAgainReq)).EnsureSuccessStatusCode();
        }
    }

    [Fact]
    public async Task Character_propose_approve_reject_logs_activity_and_notifications()
    {
        var (_, ownerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "propowner");
        var (_, playerToken, playerId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "propplayer");

        Guid campaignId;
        using (var createReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/campaigns", ownerToken))
        {
            createReq.Content = JsonContent.Create(new
            {
                title = "Campagne propositions",
                data = JsonDocument.Parse("{}").RootElement,
            });
            var create = await _client.SendAsync(createReq);
            create.EnsureSuccessStatusCode();
            var created = await create.Content.ReadFromJsonAsync<JsonElement>();
            campaignId = created!.GetProperty("id").GetGuid();
        }

        Guid characterId;
        using (var charReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/characters", playerToken))
        {
            charReq.Content = JsonContent.Create(new
            {
                name = "Lyra",
                data = JsonDocument.Parse("""{"name":"Lyra","totalLevel":2}""").RootElement,
            });
            var created = await _client.SendAsync(charReq);
            created.EnsureSuccessStatusCode();
            var body = await created.Content.ReadFromJsonAsync<JsonElement>();
            characterId = body!.GetProperty("id").GetGuid();
        }

        await InvitePlayerToCampaignAsync(ownerToken, playerToken, playerId, campaignId);

        using (var proposeReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaigns/{campaignId}/propose-character", playerToken))
        {
            proposeReq.Content = JsonContent.Create(new { characterId });
            (await _client.SendAsync(proposeReq)).EnsureSuccessStatusCode();
        }

        using (var actReq = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}/activity", ownerToken))
        {
            var act = await _client.SendAsync(actReq);
            act.EnsureSuccessStatusCode();
            var raw = await act.Content.ReadAsStringAsync();
            Assert.Contains("character_proposed", raw);
        }

        using (var ownerNotifReq = ApiTestAuth.Authed(HttpMethod.Get, "/me/notifications", ownerToken))
        {
            var notif = await _client.SendAsync(ownerNotifReq);
            notif.EnsureSuccessStatusCode();
            var body = await notif.Content.ReadFromJsonAsync<JsonElement>();
            var kinds = body!.GetProperty("notifications").EnumerateArray()
                .Select(n => n.GetProperty("kind").GetString())
                .ToList();
            Assert.Contains("character_proposal", kinds);
        }

        Guid memberId;
        using (var detailReq = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}", ownerToken))
        {
            var detail = await _client.SendAsync(detailReq);
            detail.EnsureSuccessStatusCode();
            var body = await detail.Content.ReadFromJsonAsync<JsonElement>();
            memberId = body!.GetProperty("members").EnumerateArray()
                .First(m => m.GetProperty("userId").GetGuid() == playerId)
                .GetProperty("id").GetGuid();
        }

        using (var rejectReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaigns/{campaignId}/members/{memberId}/reject", ownerToken))
        {
            (await _client.SendAsync(rejectReq)).EnsureSuccessStatusCode();
        }

        using (var actRejectReq = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}/activity", ownerToken))
        {
            var act = await _client.SendAsync(actRejectReq);
            act.EnsureSuccessStatusCode();
            var raw = await act.Content.ReadAsStringAsync();
            Assert.Contains("character_rejected", raw);
        }

        using (var playerRejectNotif = ApiTestAuth.Authed(HttpMethod.Get, "/me/notifications", playerToken))
        {
            var notif = await _client.SendAsync(playerRejectNotif);
            notif.EnsureSuccessStatusCode();
            var body = await notif.Content.ReadFromJsonAsync<JsonElement>();
            var kinds = body!.GetProperty("notifications").EnumerateArray()
                .Select(n => n.GetProperty("kind").GetString())
                .ToList();
            Assert.Contains("proposal_rejected", kinds);
        }

        using (var proposeAgain = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaigns/{campaignId}/propose-character", playerToken))
        {
            proposeAgain.Content = JsonContent.Create(new { characterId });
            (await _client.SendAsync(proposeAgain)).EnsureSuccessStatusCode();
        }

        using (var approveReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaigns/{campaignId}/members/{memberId}/approve", ownerToken))
        {
            (await _client.SendAsync(approveReq)).EnsureSuccessStatusCode();
        }

        using (var actApproveReq = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}/activity", ownerToken))
        {
            var act = await _client.SendAsync(actApproveReq);
            act.EnsureSuccessStatusCode();
            var raw = await act.Content.ReadAsStringAsync();
            Assert.Contains("character_approved", raw);
        }

        using (var playerApproveNotif = ApiTestAuth.Authed(HttpMethod.Get, "/me/notifications", playerToken))
        {
            var notif = await _client.SendAsync(playerApproveNotif);
            notif.EnsureSuccessStatusCode();
            var body = await notif.Content.ReadFromJsonAsync<JsonElement>();
            var kinds = body!.GetProperty("notifications").EnumerateArray()
                .Select(n => n.GetProperty("kind").GetString())
                .ToList();
            Assert.Contains("proposal_approved", kinds);
            Assert.DoesNotContain("proposal_rejected", kinds);
        }
    }

    [Fact]
    public async Task Character_pick_request_logs_activity_and_notifies_player()
    {
        var (_, ownerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "pickowner");
        var (_, playerToken, playerId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "pickplayer");

        Guid campaignId;
        using (var createReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/campaigns", ownerToken))
        {
            createReq.Content = JsonContent.Create(new
            {
                title = "Campagne rappel perso",
                data = JsonDocument.Parse("{}").RootElement,
            });
            var create = await _client.SendAsync(createReq);
            create.EnsureSuccessStatusCode();
            var created = await create.Content.ReadFromJsonAsync<JsonElement>();
            campaignId = created!.GetProperty("id").GetGuid();
        }

        await InvitePlayerToCampaignAsync(ownerToken, playerToken, playerId, campaignId);

        Guid memberId;
        using (var detailReq = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}", ownerToken))
        {
            var detail = await _client.SendAsync(detailReq);
            detail.EnsureSuccessStatusCode();
            var body = await detail.Content.ReadFromJsonAsync<JsonElement>();
            memberId = body!.GetProperty("members").EnumerateArray()
                .First(m => m.GetProperty("userId").GetGuid() == playerId)
                .GetProperty("id").GetGuid();
        }

        using (var requestReq = ApiTestAuth.Authed(
            HttpMethod.Post,
            $"/me/campaigns/{campaignId}/members/{memberId}/request-character",
            ownerToken))
        {
            (await _client.SendAsync(requestReq)).EnsureSuccessStatusCode();
        }

        using (var actReq = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}/activity", ownerToken))
        {
            var act = await _client.SendAsync(actReq);
            act.EnsureSuccessStatusCode();
            var raw = await act.Content.ReadAsStringAsync();
            Assert.Contains("character_pick_requested", raw);
        }

        using (var playerNotifReq = ApiTestAuth.Authed(HttpMethod.Get, "/me/notifications", playerToken))
        {
            var notif = await _client.SendAsync(playerNotifReq);
            notif.EnsureSuccessStatusCode();
            var body = await notif.Content.ReadFromJsonAsync<JsonElement>();
            var kinds = body!.GetProperty("notifications").EnumerateArray()
                .Select(n => n.GetProperty("kind").GetString())
                .ToList();
            Assert.Contains("character_pick_requested", kinds);
        }
    }


    [Fact]
    public async Task Character_reject_without_pending_proposal_returns_not_found()
    {
        var (_, ownerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "rejedgeowner");
        var (_, playerToken, playerId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "rejedgeplayer");

        var campaignId = await CreateEmptyCampaignAsync(ownerToken, "Campagne reject edge");
        await InvitePlayerToCampaignAsync(ownerToken, playerToken, playerId, campaignId);

        Guid memberId;
        using (var detailReq = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}", ownerToken))
        {
            var detail = await _client.SendAsync(detailReq);
            detail.EnsureSuccessStatusCode();
            var body = await detail.Content.ReadFromJsonAsync<JsonElement>();
            memberId = body!.GetProperty("members").EnumerateArray()
                .First(m => m.GetProperty("userId").GetGuid() == playerId)
                .GetProperty("id").GetGuid();
        }

        using (var rejectReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaigns/{campaignId}/members/{memberId}/reject", ownerToken))
        {
            var res = await _client.SendAsync(rejectReq);
            Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        }

        using (var rejectAsPlayer = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaigns/{campaignId}/members/{memberId}/reject", playerToken))
        {
            var res = await _client.SendAsync(rejectAsPlayer);
            Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        }
    }
}
