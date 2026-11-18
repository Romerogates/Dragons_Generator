using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DragonsGenerator.API.Tests;

public partial class HomeAndCampaignFeatureTests
{

    [Fact]
    public async Task Opening_initiative_collection_logs_activity_once()
    {
        var (_, ownerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "initpushowner");
        var sessionId = "sess-push-1";
        var scheduledAt = "2026-09-15T19:00:00.0000000+00:00";
        Guid campaignId;

        using (var createReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/campaigns", ownerToken))
        {
            createReq.Content = JsonContent.Create(new
            {
                title = "Init Push",
                data = new
                {
                    activeSessionId = sessionId,
                    sessions = new object[]
                    {
                        new
                        {
                            id = sessionId,
                            title = "Soirée",
                            scheduledAt,
                            status = "planned",
                            playNotes = "notes live",
                            activeCombat = new
                            {
                                id = "combat-1",
                                label = "Grotte",
                                round = 1,
                                turnIndex = 0,
                                collectingInitiative = false,
                                combatants = new object[]
                                {
                                    new
                                    {
                                        id = "cb-1",
                                        name = "Gobelin",
                                        kind = "monster",
                                        initiativeBonus = 0,
                                    },
                                },
                            },
                        },
                    },
                    handouts = Array.Empty<object>(),
                    creatures = Array.Empty<object>(),
                    encounters = Array.Empty<object>(),
                    pregenCharacters = Array.Empty<object>(),
                },
            });
            var created = await _client.SendAsync(createReq);
            created.EnsureSuccessStatusCode();
            campaignId = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        }

        using (var putReq = ApiTestAuth.Authed(HttpMethod.Put, $"/me/campaigns/{campaignId}", ownerToken))
        {
            putReq.Content = JsonContent.Create(new
            {
                data = new
                {
                    activeSessionId = sessionId,
                    sessions = new object[]
                    {
                        new
                        {
                            id = sessionId,
                            title = "Soirée",
                            scheduledAt,
                            status = "planned",
                            playNotes = "notes live",
                            activeCombat = new
                            {
                                id = "combat-1",
                                label = "Grotte",
                                round = 1,
                                turnIndex = 0,
                                collectingInitiative = true,
                                initiativeCode = "XY99",
                                combatants = new object[]
                                {
                                    new
                                    {
                                        id = "cb-1",
                                        name = "Gobelin",
                                        kind = "monster",
                                        initiativeBonus = 0,
                                    },
                                },
                            },
                        },
                    },
                    handouts = Array.Empty<object>(),
                    creatures = Array.Empty<object>(),
                    encounters = Array.Empty<object>(),
                    pregenCharacters = Array.Empty<object>(),
                },
            });
            (await _client.SendAsync(putReq)).EnsureSuccessStatusCode();
        }

        using (var actReq = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}/activity?limit=20", ownerToken))
        {
            var act = await _client.SendAsync(actReq);
            act.EnsureSuccessStatusCode();
            var items = await act.Content.ReadFromJsonAsync<JsonElement>();
            var kinds = items.EnumerateArray().Select(i => i.GetProperty("kind").GetString()).ToList();
            Assert.Equal(1, kinds.Count(k => k == "initiative_collection_opened"));
            Assert.DoesNotContain(kinds, k => k == "session_updated");
        }

        using (var putReq = ApiTestAuth.Authed(HttpMethod.Put, $"/me/campaigns/{campaignId}", ownerToken))
        {
            putReq.Content = JsonContent.Create(new
            {
                data = new
                {
                    activeSessionId = sessionId,
                    sessions = new object[]
                    {
                        new
                        {
                            id = sessionId,
                            title = "Soirée",
                            scheduledAt,
                            status = "planned",
                            playNotes = "notes live modifiées",
                            activeCombat = new
                            {
                                id = "combat-1",
                                label = "Grotte",
                                round = 1,
                                turnIndex = 0,
                                collectingInitiative = true,
                                initiativeCode = "XY99",
                                combatants = new object[]
                                {
                                    new
                                    {
                                        id = "cb-1",
                                        name = "Gobelin",
                                        kind = "monster",
                                        initiativeBonus = 0,
                                        initiativeRoll = 14,
                                    },
                                },
                            },
                        },
                    },
                    handouts = Array.Empty<object>(),
                    creatures = Array.Empty<object>(),
                    encounters = Array.Empty<object>(),
                    pregenCharacters = Array.Empty<object>(),
                },
            });
            (await _client.SendAsync(putReq)).EnsureSuccessStatusCode();
        }

        using (var actReq = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}/activity?limit=20", ownerToken))
        {
            var act = await _client.SendAsync(actReq);
            act.EnsureSuccessStatusCode();
            var items = await act.Content.ReadFromJsonAsync<JsonElement>();
            var kinds = items.EnumerateArray().Select(i => i.GetProperty("kind").GetString()).ToList();
            Assert.Equal(1, kinds.Count(k => k == "initiative_collection_opened"));
            Assert.DoesNotContain(kinds, k => k == "session_updated");
        }
    }

}
