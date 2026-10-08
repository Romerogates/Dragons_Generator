using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DragonsGenerator.API.Tests;

[Collection("ApiIntegration")]
public class FriendSupportIntegrationTests
{
    private readonly HttpClient _client;

    public FriendSupportIntegrationTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateTestClient();
    }

    [Fact]
    public async Task Friends_search_requires_auth()
    {
        var response = await _client.GetAsync("/users/search?q=hero");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Friends_search_returns_display_name_only()
    {
        var (_, token, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "search");

        using var req = ApiTestAuth.Authed(HttpMethod.Get, "/users/search?q=Hero", token);
        var response = await _client.SendAsync(req);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("@dragons.local", body);
        Assert.Contains("displayName", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Friends_search_returns_empty_for_short_query()
    {
        var token = await ApiTestAuth.LoginAdminAsync(_client);
        using var req = ApiTestAuth.Authed(HttpMethod.Get, "/users/search?q=a", token);
        var response = await _client.SendAsync(req);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Array, body.ValueKind);
        Assert.Empty(body.EnumerateArray());
    }

    [Fact]
    public async Task Friends_search_returns_enriched_fields_for_valid_query()
    {
        var (_, token, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "enriched");

        using var req = ApiTestAuth.Authed(HttpMethod.Get, "/users/search?q=Hero", token);
        var response = await _client.SendAsync(req);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Array, body.ValueKind);
        if (body.GetArrayLength() > 0)
        {
            var first = body[0];
            Assert.True(first.TryGetProperty("relationshipStatus", out _));
            Assert.True(first.TryGetProperty("memberSince", out _));
        }
    }

    [Fact]
    public async Task Friends_suggestions_returns_campaign_teammates()
    {
        var (_, ownerToken, ownerId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "sugowner");
        var (_, playerToken, playerId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "sugplayer");
        var (_, teammateToken, teammateId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "sugmate");

        Guid campaignId;
        using (var createReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/campaigns", ownerToken))
        {
            createReq.Content = JsonContent.Create(new
            {
                title = "Camp Suggestions",
                data = new { setting = "Eana", partyLevel = 1, tone = "classic", adventure = "", creatures = Array.Empty<object>(), encounters = Array.Empty<object>(), notes = "", pregenCharacters = Array.Empty<object>(), sessions = Array.Empty<object>() },
            });
            var created = await _client.SendAsync(createReq);
            created.EnsureSuccessStatusCode();
            campaignId = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        }

        async Task BecomeFriendsAsync(string requesterTok, string addresseeTok, Guid addresseeId)
        {
            using (var friendReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/friends/request", requesterTok))
            {
                friendReq.Content = JsonContent.Create(new { userId = addresseeId });
                (await _client.SendAsync(friendReq)).EnsureSuccessStatusCode();
            }

            Guid requestId;
            using (var pendingReq = ApiTestAuth.Authed(HttpMethod.Get, "/me/friends/requests", addresseeTok))
            {
                var list = await (await _client.SendAsync(pendingReq)).Content.ReadFromJsonAsync<JsonElement>();
                requestId = list![0].GetProperty("id").GetGuid();
            }

            using var acceptReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/friends/requests/{requestId}/accept", addresseeTok);
            (await _client.SendAsync(acceptReq)).EnsureSuccessStatusCode();
        }

        async Task InviteAndAcceptAsync(string ownerTok, string playerTok, Guid uid)
        {
            using var inviteReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaigns/{campaignId}/invites", ownerTok);
            inviteReq.Content = JsonContent.Create(new { userId = uid });
            (await _client.SendAsync(inviteReq)).EnsureSuccessStatusCode();

            Guid inviteId;
            using (var listInv = ApiTestAuth.Authed(HttpMethod.Get, "/me/campaign-invites", playerTok))
            {
                var arr = await (await _client.SendAsync(listInv)).Content.ReadFromJsonAsync<JsonElement>();
                inviteId = arr![0].GetProperty("id").GetGuid();
            }

            using var acceptReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaign-invites/{inviteId}/accept", playerTok);
            (await _client.SendAsync(acceptReq)).EnsureSuccessStatusCode();
        }

        await BecomeFriendsAsync(ownerToken, playerToken, playerId);
        await BecomeFriendsAsync(ownerToken, teammateToken, teammateId);
        await InviteAndAcceptAsync(ownerToken, playerToken, playerId);
        await InviteAndAcceptAsync(ownerToken, teammateToken, teammateId);

        using var sugReq = ApiTestAuth.Authed(HttpMethod.Get, "/me/friends/suggestions", playerToken);
        var sugRes = await _client.SendAsync(sugReq);
        sugRes.EnsureSuccessStatusCode();
        var suggestions = await sugRes.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(
            suggestions.EnumerateArray(),
            s => s.GetProperty("id").GetGuid() == teammateId
        );
        var mate = suggestions.EnumerateArray().First(s => s.GetProperty("id").GetGuid() == teammateId);
        Assert.Equal("Coéquipier de campagne", mate.GetProperty("suggestionReason").GetString());
        Assert.Equal("none", mate.GetProperty("relationshipStatus").GetString());
        Assert.DoesNotContain(
            suggestions.EnumerateArray(),
            s => s.GetProperty("id").GetGuid() == ownerId
        );
    }

    [Fact]
    public async Task Friends_list_includes_friend_since()
    {
        var (_, tokenA, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "sincea");
        var (_, tokenB, userBId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "sinceb");

        using (var requestReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/friends/request", tokenA))
        {
            requestReq.Content = JsonContent.Create(new { userId = userBId });
            (await _client.SendAsync(requestReq)).EnsureSuccessStatusCode();
        }

        Guid requestId;
        using (var pendingReq = ApiTestAuth.Authed(HttpMethod.Get, "/me/friends/requests", tokenB))
        {
            var list = await (await _client.SendAsync(pendingReq)).Content.ReadFromJsonAsync<JsonElement>();
            requestId = list![0].GetProperty("id").GetGuid();
        }

        using (var acceptReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/friends/requests/{requestId}/accept", tokenB))
        {
            (await _client.SendAsync(acceptReq)).EnsureSuccessStatusCode();
        }

        using var friendsReq = ApiTestAuth.Authed(HttpMethod.Get, "/me/friends", tokenA);
        var friends = await (await _client.SendAsync(friendsReq)).Content.ReadFromJsonAsync<JsonElement>();
        var friend = friends.EnumerateArray().First(f => f.GetProperty("id").GetGuid() == userBId);
        Assert.True(friend.TryGetProperty("friendSince", out _));
    }

    [Fact]
    public async Task Friends_send_accept_and_list_flow()
    {
        var (_, tokenA, userAId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "a");
        var (_, tokenB, userBId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "b");

        using (var selfReq = ApiTestAuth.Authed(
            HttpMethod.Post,
            "/me/friends/request",
            tokenA))
        {
            selfReq.Content = JsonContent.Create(new { userId = userAId });
            var self = await _client.SendAsync(selfReq);
            Assert.Equal(HttpStatusCode.BadRequest, self.StatusCode);
        }

        using (var requestReq = ApiTestAuth.Authed(
            HttpMethod.Post,
            "/me/friends/request",
            tokenA))
        {
            requestReq.Content = JsonContent.Create(new { userId = userBId });
            var sent = await _client.SendAsync(requestReq);
            Assert.Equal(HttpStatusCode.NoContent, sent.StatusCode);
        }

        Guid requestId;
        using (var pendingReq = ApiTestAuth.Authed(HttpMethod.Get, "/me/friends/requests", tokenB))
        {
            var pending = await _client.SendAsync(pendingReq);
            pending.EnsureSuccessStatusCode();
            var list = await pending.Content.ReadFromJsonAsync<JsonElement>();
            requestId = list[0].GetProperty("id").GetGuid();
            Assert.Equal(userAId, list[0].GetProperty("userId").GetGuid());
        }

        using (var acceptReq = ApiTestAuth.Authed(
            HttpMethod.Post,
            $"/me/friends/requests/{requestId}/accept",
            tokenB))
        {
            var accept = await _client.SendAsync(acceptReq);
            Assert.Equal(HttpStatusCode.NoContent, accept.StatusCode);
        }

        using (var friendsReq = ApiTestAuth.Authed(HttpMethod.Get, "/me/friends", tokenA))
        {
            var friends = await _client.SendAsync(friendsReq);
            friends.EnsureSuccessStatusCode();
            var body = await friends.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Contains(
                body.EnumerateArray(),
                u => u.GetProperty("id").GetGuid() == userBId
            );
        }
    }

    [Fact]
    public async Task Friends_duplicate_request_returns_conflict()
    {
        var (_, tokenA, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "dupa");
        var (_, tokenB, userBId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "dupb");

        using var requestReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/friends/request", tokenA);
        requestReq.Content = JsonContent.Create(new { userId = userBId });
        Assert.Equal(HttpStatusCode.NoContent, (await _client.SendAsync(requestReq)).StatusCode);

        using var dupReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/friends/request", tokenA);
        dupReq.Content = JsonContent.Create(new { userId = userBId });
        Assert.Equal(HttpStatusCode.Conflict, (await _client.SendAsync(dupReq)).StatusCode);
    }

    [Fact]
    public async Task Support_create_and_list_ticket()
    {
        var (_, token, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "support");

        using var createReq = ApiTestAuth.Authed(HttpMethod.Post, "/support/tickets", token);
        createReq.Content = new MultipartFormDataContent
        {
            { new StringContent("Bug fiche PDF"), "subject" },
            { new StringContent("La dague manque sur ma fiche Lettré."), "message" },
        };
        var created = await _client.SendAsync(createReq);
        created.EnsureSuccessStatusCode();
        var ticket = await created.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Bug fiche PDF", ticket.GetProperty("subject").GetString());
        var ticketId = ticket.GetProperty("id").GetGuid();

        using var listReq = ApiTestAuth.Authed(HttpMethod.Get, "/support/tickets", token);
        var listResponse = await _client.SendAsync(listReq);
        listResponse.EnsureSuccessStatusCode();
        var list = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(
            list.EnumerateArray(),
            t => t.GetProperty("id").GetGuid() == ticketId
        );
    }

    [Fact]
    public async Task Support_thread_player_and_admin_can_exchange()
    {
        var (_, playerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "deskplayer");
        var adminToken = await ApiTestAuth.LoginAdminAsync(_client);

        using var createReq = ApiTestAuth.Authed(HttpMethod.Post, "/support/tickets", playerToken);
        createReq.Content = new MultipartFormDataContent
        {
            { new StringContent("Table bloquée"), "subject" },
            { new StringContent("Le combat ne s'ouvre plus."), "message" },
        };
        var created = await _client.SendAsync(createReq);
        created.EnsureSuccessStatusCode();
        var ticketId = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        using var takeReq = ApiTestAuth.Authed(HttpMethod.Patch, $"/admin/support/tickets/{ticketId}", adminToken);
        takeReq.Content = JsonContent.Create(new { status = "in_progress" });
        Assert.Equal(HttpStatusCode.OK, (await _client.SendAsync(takeReq)).StatusCode);

        using var staffReq = ApiTestAuth.Authed(HttpMethod.Post, $"/support/tickets/{ticketId}/messages", adminToken);
        staffReq.Content = new MultipartFormDataContent
        {
            { new StringContent("On regarde le journal de session."), "body" },
        };
        (await _client.SendAsync(staffReq)).EnsureSuccessStatusCode();

        using var playerMsg = ApiTestAuth.Authed(HttpMethod.Post, $"/support/tickets/{ticketId}/messages", playerToken);
        playerMsg.Content = new MultipartFormDataContent
        {
            { new StringContent("Ça arrive après Lancer le combat."), "body" },
        };
        (await _client.SendAsync(playerMsg)).EnsureSuccessStatusCode();

        using var threadReq = ApiTestAuth.Authed(HttpMethod.Get, $"/support/tickets/{ticketId}", playerToken);
        var threadRes = await _client.SendAsync(threadReq);
        threadRes.EnsureSuccessStatusCode();
        var thread = await threadRes.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, thread.GetProperty("messages").GetArrayLength());

        var overviewReq = ApiTestAuth.Authed(HttpMethod.Get, "/admin/ops/overview", adminToken);
        var overviewRes = await _client.SendAsync(overviewReq);
        overviewRes.EnsureSuccessStatusCode();
        var overview = await overviewRes.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(overview.GetProperty("ticketsInProgress").GetInt32() >= 1);

        using var ingest = new HttpRequestMessage(HttpMethod.Post, "/internal/ops-events")
        {
            Content = JsonContent.Create(new { kind = "backup", title = "Backup test", detail = "ok" }),
        };
        Assert.Equal(HttpStatusCode.NoContent, (await _client.SendAsync(ingest)).StatusCode);

        using var diagReq = ApiTestAuth.Authed(HttpMethod.Get, $"/admin/ops/diagnostic?ticketId={ticketId}", adminToken);
        var diagRes = await _client.SendAsync(diagReq);
        diagRes.EnsureSuccessStatusCode();
        var diag = await diagRes.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("Ticket à corriger", diag.GetProperty("markdown").GetString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Support_admin_list_requires_admin_role()
    {
        var (_, userToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "notadmin");
        using var userReq = ApiTestAuth.Authed(HttpMethod.Get, "/admin/support/tickets", userToken);
        Assert.Equal(HttpStatusCode.Forbidden, (await _client.SendAsync(userReq)).StatusCode);

        var adminToken = await ApiTestAuth.LoginAdminAsync(_client);
        using var adminReq = ApiTestAuth.Authed(HttpMethod.Get, "/admin/support/tickets", adminToken);
        var adminResponse = await _client.SendAsync(adminReq);
        adminResponse.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Outbound_emails_are_recorded_and_admin_only()
    {
        var (email, userToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "mailog");
        var adminToken = await ApiTestAuth.LoginAdminAsync(_client);

        using var listReq = ApiTestAuth.Authed(HttpMethod.Get, "/admin/outbound-emails", adminToken);
        var listRes = await _client.SendAsync(listReq);
        listRes.EnsureSuccessStatusCode();
        var list = await listRes.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(list.GetArrayLength() >= 1);
        Assert.Contains(
            list.EnumerateArray(),
            item => string.Equals(item.GetProperty("toEmail").GetString(), email, StringComparison.OrdinalIgnoreCase)
                && (item.GetProperty("htmlBody").GetString() ?? "").Length > 0
                && item.GetProperty("status").GetString() == "sent"
        );

        using var forbidden = ApiTestAuth.Authed(HttpMethod.Get, "/admin/outbound-emails", userToken);
        Assert.Equal(HttpStatusCode.Forbidden, (await _client.SendAsync(forbidden)).StatusCode);
    }

    [Fact]
    public async Task Support_rejects_invalid_character_link()
    {
        var (_, token, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "badchar");

        using var createReq = ApiTestAuth.Authed(HttpMethod.Post, "/support/tickets", token);
        createReq.Content = new MultipartFormDataContent
        {
            { new StringContent("Perso cassé"), "subject" },
            { new StringContent("Export JSON incomplet."), "message" },
            { new StringContent(Guid.NewGuid().ToString()), "characterId" },
        };
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.SendAsync(createReq)).StatusCode);
    }

    [Fact]
    public async Task Support_attachment_requires_auth_and_owner_or_admin()
    {
        var (_, ownerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "attachowner");
        var (_, otherToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "attachother");
        var adminToken = await ApiTestAuth.LoginAdminAsync(_client);

        var pngBytes = Convert.FromBase64String(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        );

        using var createReq = ApiTestAuth.Authed(HttpMethod.Post, "/support/tickets", ownerToken);
        createReq.Content = new MultipartFormDataContent
        {
            { new StringContent("Bug visuel"), "subject" },
            { new StringContent("Capture d'écran jointe."), "message" },
            { new ByteArrayContent(pngBytes), "file", "capture.png" },
        };
        var created = await _client.SendAsync(createReq);
        created.EnsureSuccessStatusCode();
        var ticket = await created.Content.ReadFromJsonAsync<JsonElement>();
        var ticketId = ticket.GetProperty("id").GetGuid();
        Assert.Contains(
            $"/support/tickets/{ticketId}/attachment",
            ticket.GetProperty("attachmentUrl").GetString(),
            StringComparison.Ordinal
        );

        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await _client.GetAsync($"/support/tickets/{ticketId}/attachment")).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await _client.GetAsync("/uploads/tickets/capture.png")).StatusCode
        );

        using var otherReq = ApiTestAuth.Authed(
            HttpMethod.Get,
            $"/support/tickets/{ticketId}/attachment",
            otherToken
        );
        Assert.Equal(HttpStatusCode.Forbidden, (await _client.SendAsync(otherReq)).StatusCode);

        using var ownerReq = ApiTestAuth.Authed(
            HttpMethod.Get,
            $"/support/tickets/{ticketId}/attachment",
            ownerToken
        );
        var ownerResponse = await _client.SendAsync(ownerReq);
        ownerResponse.EnsureSuccessStatusCode();
        Assert.Equal("image/png", ownerResponse.Content.Headers.ContentType?.MediaType);

        using var adminReq = ApiTestAuth.Authed(
            HttpMethod.Get,
            $"/support/tickets/{ticketId}/attachment",
            adminToken
        );
        var adminResponse = await _client.SendAsync(adminReq);
        adminResponse.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Auth_google_without_client_id_is_unavailable()
    {
        var response = await _client.PostAsJsonAsync("/auth/google", new { idToken = "x", acceptTerms = true });
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }

    [Fact]
    public async Task Auth_providers_returns_google_client_id_field()
    {
        var response = await _client.GetAsync("/auth/providers");
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.TryGetProperty("googleClientId", out _));
    }

    [Fact]
    public async Task Admin_backup_list_requires_admin()
    {
        var (_, token, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "nobackup");
        using var userReq = ApiTestAuth.Authed(HttpMethod.Get, "/admin/ops/backups", token);
        Assert.Equal(HttpStatusCode.Forbidden, (await _client.SendAsync(userReq)).StatusCode);

        var adminToken = await ApiTestAuth.LoginAdminAsync(_client);
        using var adminReq = ApiTestAuth.Authed(HttpMethod.Get, "/admin/ops/backups", adminToken);
        var adminRes = await _client.SendAsync(adminReq);
        adminRes.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Support_attach_campaign_member_ok_stranger_rejected()
    {
        var (_, ownerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "campown");
        var (_, strangerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "campstr");
        var adminToken = await ApiTestAuth.LoginAdminAsync(_client);

        Guid campaignId;
        using (var createCamp = ApiTestAuth.Authed(HttpMethod.Post, "/me/campaigns", ownerToken))
        {
            createCamp.Content = JsonContent.Create(new
            {
                title = "Table cassée",
                data = JsonDocument.Parse("""{"notes":"secret-mj"}""").RootElement,
            });
            var createdCamp = await _client.SendAsync(createCamp);
            createdCamp.EnsureSuccessStatusCode();
            campaignId = (await createdCamp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        }

        using (var denied = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}", adminToken))
        {
            Assert.Equal(HttpStatusCode.NotFound, (await _client.SendAsync(denied)).StatusCode);
        }

        using var createTicket = ApiTestAuth.Authed(HttpMethod.Post, "/support/tickets", ownerToken);
        createTicket.Content = new MultipartFormDataContent
        {
            { new StringContent("Combat figé"), "subject" },
            { new StringContent("La table ne répond plus après l'init."), "message" },
            { new StringContent(campaignId.ToString()), "campaignId" },
        };
        var ticketRes = await _client.SendAsync(createTicket);
        ticketRes.EnsureSuccessStatusCode();
        var ticket = await ticketRes.Content.ReadFromJsonAsync<JsonElement>();
        var ticketId = ticket.GetProperty("id").GetGuid();
        Assert.Equal(campaignId, ticket.GetProperty("campaignId").GetGuid());
        Assert.Equal("Table cassée", ticket.GetProperty("campaignName").GetString());

        using var strangerTicket = ApiTestAuth.Authed(HttpMethod.Post, "/support/tickets", strangerToken);
        strangerTicket.Content = new MultipartFormDataContent
        {
            { new StringContent("Pas ma table"), "subject" },
            { new StringContent("Je tente d'attacher une campagne d'un autre."), "message" },
            { new StringContent(campaignId.ToString()), "campaignId" },
        };
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.SendAsync(strangerTicket)).StatusCode);

        Guid characterId;
        using (var charReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/characters", ownerToken))
        {
            charReq.Content = JsonContent.Create(new
            {
                name = "Lira",
                data = JsonDocument.Parse("""{"name":"Lira"}""").RootElement,
            });
            var charCreated = await _client.SendAsync(charReq);
            charCreated.EnsureSuccessStatusCode();
            characterId = (await charCreated.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        }

        var pngBytes = Convert.FromBase64String(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        );
        using var msgReq = ApiTestAuth.Authed(HttpMethod.Post, $"/support/tickets/{ticketId}/messages", ownerToken);
        msgReq.Content = new MultipartFormDataContent
        {
            { new StringContent("Voici la table, la fiche et une capture."), "body" },
            { new StringContent(characterId.ToString()), "characterId" },
            { new StringContent(campaignId.ToString()), "campaignId" },
            { new ByteArrayContent(pngBytes), "file", "capture.png" },
        };
        var msgRes = await _client.SendAsync(msgReq);
        msgRes.EnsureSuccessStatusCode();
        var msg = await msgRes.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(characterId, msg.GetProperty("characterId").GetGuid());
        Assert.Equal(campaignId, msg.GetProperty("campaignId").GetGuid());
        Assert.Equal("capture.png", msg.GetProperty("attachmentOriginalName").GetString());

        using (var inspect = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}", adminToken))
        {
            var inspectRes = await _client.SendAsync(inspect);
            inspectRes.EnsureSuccessStatusCode();
            var detail = await inspectRes.Content.ReadFromJsonAsync<JsonElement>();
            Assert.False(detail.GetProperty("isOwner").GetBoolean());
            Assert.Equal("support", detail.GetProperty("role").GetString());
            Assert.Equal("secret-mj", detail.GetProperty("data").GetProperty("notes").GetString());
            Assert.DoesNotContain(
                detail.GetProperty("members").EnumerateArray(),
                m => m.GetProperty("role").GetString() == "support");
        }

        using (var put = ApiTestAuth.Authed(HttpMethod.Put, $"/me/campaigns/{campaignId}", adminToken))
        {
            put.Content = JsonContent.Create(new
            {
                title = "Hijack",
                data = JsonDocument.Parse("""{"notes":"nope"}""").RootElement,
            });
            Assert.Equal(HttpStatusCode.NotFound, (await _client.SendAsync(put)).StatusCode);
        }

        using (var followUp = ApiTestAuth.Authed(HttpMethod.Post, $"/support/tickets/{ticketId}/messages", ownerToken))
        {
            followUp.Content = new MultipartFormDataContent
            {
                { new StringContent("Rappel FormData avec campagne."), "body" },
                { new StringContent(campaignId.ToString()), "campaignId" },
            };
            (await _client.SendAsync(followUp)).EnsureSuccessStatusCode();
        }
    }

    [Fact]
    public async Task Support_category_inbox_notif_and_disabled_login()
    {
        var (_, playerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "deskcat");
        var adminToken = await ApiTestAuth.LoginAdminAsync(_client);

        using var createReq = ApiTestAuth.Authed(HttpMethod.Post, "/support/tickets", playerToken);
        createReq.Content = new MultipartFormDataContent
        {
            { new StringContent("IA cassée"), "subject" },
            { new StringContent("La barre IA reste bloquée."), "message" },
            { new StringContent("ia"), "category" },
        };
        var created = await _client.SendAsync(createReq);
        created.EnsureSuccessStatusCode();
        var ticket = await created.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("ia", ticket.GetProperty("category").GetString());
        var ticketId = ticket.GetProperty("id").GetGuid();

        using var inboxReq = ApiTestAuth.Authed(HttpMethod.Get, "/admin/support/inbox-count", adminToken);
        var inboxRes = await _client.SendAsync(inboxReq);
        inboxRes.EnsureSuccessStatusCode();
        var inbox = await inboxRes.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(inbox.GetProperty("waitingOnStaff").GetInt32() >= 1);

        using var adminNotifReq = ApiTestAuth.Authed(HttpMethod.Get, "/me/notifications", adminToken);
        var adminNotif = await _client.SendAsync(adminNotifReq);
        adminNotif.EnsureSuccessStatusCode();
        var adminSummary = await adminNotif.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(adminSummary.GetProperty("supportInboxCount").GetInt32() >= 1);

        using var takeReq = ApiTestAuth.Authed(HttpMethod.Patch, $"/admin/support/tickets/{ticketId}", adminToken);
        takeReq.Content = JsonContent.Create(new { status = "in_progress" });
        Assert.Equal(HttpStatusCode.OK, (await _client.SendAsync(takeReq)).StatusCode);

        using var staffReq = ApiTestAuth.Authed(HttpMethod.Post, $"/support/tickets/{ticketId}/messages", adminToken);
        staffReq.Content = new MultipartFormDataContent
        {
            { new StringContent("On regarde le log IA."), "body" },
        };
        (await _client.SendAsync(staffReq)).EnsureSuccessStatusCode();

        using var playerNotifReq = ApiTestAuth.Authed(HttpMethod.Get, "/me/notifications", playerToken);
        var playerNotif = await _client.SendAsync(playerNotifReq);
        playerNotif.EnsureSuccessStatusCode();
        var playerSummary = await playerNotif.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(
            playerSummary.GetProperty("notifications").EnumerateArray(),
            n => n.GetProperty("kind").GetString() == "support_reply"
        );

        var (email, _, userId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "disabledacc");
        using var disableReq = ApiTestAuth.Authed(HttpMethod.Put, $"/admin/users/{userId}", adminToken);
        disableReq.Content = JsonContent.Create(new { disabled = true });
        (await _client.SendAsync(disableReq)).EnsureSuccessStatusCode();

        var login = await _client.PostAsJsonAsync("/auth/login", new { email, password = "TestPass123!" });
        Assert.Equal(HttpStatusCode.Forbidden, login.StatusCode);
    }
}
