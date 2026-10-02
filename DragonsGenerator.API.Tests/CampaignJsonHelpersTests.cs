using System.Text.Json.Nodes;
using DragonsGenerator.API.Services;

namespace DragonsGenerator.API.Tests;

public class CampaignJsonHelpersTests
{
    [Fact]
    public void MergeLiveCombatIntoIncoming_keeps_player_initiative_rolls()
    {
        const string stored = """
            {
              "sessions": [{
                "id": "ses-1",
                "activeCombat": {
                  "collectingInitiative": true,
                  "combatants": [
                    { "id": "pc-1", "name": "Aria", "kind": "player", "currentHp": 20, "playerSubmitted": true, "initiativeRoll": 17 },
                    { "id": "gob-1", "name": "Gobelin", "kind": "monster", "currentHp": 7 }
                  ]
                }
              }]
            }
            """;
        const string incoming = """
            {
              "sessions": [{
                "id": "ses-1",
                "activeCombat": {
                  "collectingInitiative": true,
                  "combatants": [
                    { "id": "pc-1", "name": "Aria", "kind": "player", "currentHp": 12, "playerSubmitted": false },
                    { "id": "gob-1", "name": "Gobelin", "kind": "monster", "currentHp": 3 }
                  ]
                }
              }]
            }
            """;

        var merged = CampaignJsonHelpers.MergeLiveCombatIntoIncoming(incoming, stored);
        var node = JsonNode.Parse(merged)!.AsObject();
        var pc = node["sessions"]![0]!["activeCombat"]!["combatants"]![0]!.AsObject();

        Assert.Equal(12, pc["currentHp"]!.GetValue<int>());
        Assert.True(pc["playerSubmitted"]!.GetValue<bool>());
        Assert.Equal(17, pc["initiativeRoll"]!.GetValue<int>());
        Assert.Equal(3, node["sessions"]![0]!["activeCombat"]!["combatants"]![1]!["currentHp"]!.GetValue<int>());
    }

    [Fact]
    public void MergeLiveCombatIntoIncoming_does_not_overwrite_incoming_rolls()
    {
        const string stored = """
            { "sessions": [{ "id": "ses-1", "activeCombat": { "combatants": [
              { "id": "pc-1", "playerSubmitted": true, "initiativeRoll": 3 }
            ]}}]}
            """;
        const string incoming = """
            { "sessions": [{ "id": "ses-1", "activeCombat": { "combatants": [
              { "id": "pc-1", "playerSubmitted": true, "initiativeRoll": 19 }
            ]}}]}
            """;

        var merged = CampaignJsonHelpers.MergeLiveCombatIntoIncoming(incoming, stored);
        var pc = JsonNode.Parse(merged)!["sessions"]![0]!["activeCombat"]!["combatants"]![0]!;
        Assert.Equal(19, pc["initiativeRoll"]!.GetValue<int>());
    }

    [Fact]
    public void FilterInitiativeBoardForViewer_hides_other_members_from_players()
    {
        var me = Guid.NewGuid();
        var other = Guid.NewGuid();
        var board = new InitiativeBoardInfo(
            true,
            "AB12",
            "Embuscade",
            [
                new InitiativeCombatantInfo("a", "Moi", "player", 2, false, me.ToString()),
                new InitiativeCombatantInfo("b", "Allié", "player", 1, false, other.ToString()),
                new InitiativeCombatantInfo("c", "PNJ", "npc", 0, false, null),
            ]);

        var filtered = CampaignJsonHelpers.FilterInitiativeBoardForViewer(board, me, isOwner: false);
        var ownerView = CampaignJsonHelpers.FilterInitiativeBoardForViewer(board, me, isOwner: true);

        Assert.Single(filtered.Combatants);
        Assert.Equal("Moi", filtered.Combatants[0].Name);
        Assert.Equal(3, ownerView.Combatants.Count);
    }

    [Fact]
    public void LevelFromCharacterJson_prefers_totalLevel()
    {
        Assert.Equal(5, CampaignJsonHelpers.LevelFromCharacterJson(
            """{"name":"A","totalLevel":5,"level":1,"classes":[{"level":2}]}"""));
        Assert.Equal(3, CampaignJsonHelpers.LevelFromCharacterJson(
            """{"name":"B","level":3}"""));
        Assert.Equal(4, CampaignJsonHelpers.LevelFromCharacterJson(
            """{"name":"C","classes":[{"level":1},{"level":3}]}"""));
        Assert.Null(CampaignJsonHelpers.LevelFromCharacterJson("{}"));
        Assert.Null(CampaignJsonHelpers.LevelFromCharacterJson(null));
    }

    [Fact]
    public void FilterForPlayerView_keeps_active_combat_for_battlefield()
    {
        const string raw = """
            {
              "adventure": "secret",
              "notes": "mj",
              "activeSessionId": "ses-1",
              "sessions": [{
                "id": "ses-1",
                "mode": "online",
                "notes": "prep",
                "playNotes": "live",
                "playNotebook": { "id": "nb1", "text": "secret" },
                "playPads": [{ "id": "p1", "kind": "note", "title": "N" }],
                "activeCombat": {
                  "id": "c1",
                  "round": 1,
                  "turnIndex": 0,
                  "combatants": [
                    { "id": "pc-1", "name": "Aria", "kind": "player", "initiativeBonus": 2 }
                  ]
                },
                "combatHistory": [{ "id": "h1" }]
              }],
              "creatures": [{ "id": "x" }],
              "encounters": [{ "id": "e" }]
            }
            """;
        using var doc = System.Text.Json.JsonDocument.Parse(raw);
        var filtered = CampaignJsonHelpers.FilterForPlayerView(doc.RootElement, Guid.NewGuid());
        Assert.Equal("ses-1", filtered.GetProperty("activeSessionId").GetString());
        Assert.Equal("", filtered.GetProperty("adventure").GetString());
        var session = filtered.GetProperty("sessions")[0];
        Assert.Equal("", session.GetProperty("notes").GetString());
        Assert.Equal("", session.GetProperty("playNotes").GetString());
        Assert.Equal(System.Text.Json.JsonValueKind.Null, session.GetProperty("playNotebook").ValueKind);
        Assert.Equal(0, session.GetProperty("playPads").GetArrayLength());
        Assert.Equal("c1", session.GetProperty("activeCombat").GetProperty("id").GetString());
        Assert.Equal(0, session.GetProperty("combatHistory").GetArrayLength());
        Assert.Equal(0, filtered.GetProperty("creatures").GetArrayLength());
    }

    [Fact]
    public void FilterForPlayerView_keeps_player_recap_and_strips_run_sheet()
    {
        const string raw = """
            {
              "sessions": [{
                "id": "ses-1",
                "objectives": "secret obj",
                "scenes": "secret scenes",
                "prepChecklist": "secret checklist",
                "playerRecap": "Vous avez vaincu le dragon.",
                "activeMapId": "map-1",
                "notes": "mj only"
              }]
            }
            """;
        using var doc = System.Text.Json.JsonDocument.Parse(raw);
        var filtered = CampaignJsonHelpers.FilterForPlayerView(doc.RootElement, Guid.NewGuid());
        var session = filtered.GetProperty("sessions")[0];
        Assert.Equal("", session.GetProperty("objectives").GetString());
        Assert.Equal("", session.GetProperty("scenes").GetString());
        Assert.Equal("", session.GetProperty("prepChecklist").GetString());
        Assert.Equal("Vous avez vaincu le dragon.", session.GetProperty("playerRecap").GetString());
        Assert.Equal("map-1", session.GetProperty("activeMapId").GetString());
        Assert.Equal("", session.GetProperty("notes").GetString());
    }

    [Fact]
    public void FilterForPlayerView_hydrates_library_linked_active_map()
    {
        var libId = Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
        const string raw = """
            {
              "activeSessionId": "ses-1",
              "sessions": [{ "id": "ses-1", "activeMapId": "map-live" }],
              "dungeonMaps": [
                {
                  "id": "map-live",
                  "libraryDungeonId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                  "name": "Crypte linked",
                  "fogOfWarEnabled": true,
                  "revealedRoomIds": ["r1"],
                  "rooms": [{ "id": "r1", "label": "A", "encounterId": "enc-1", "notes": "camp" }]
                }
              ]
            }
            """;
        using var doc = System.Text.Json.JsonDocument.Parse(raw);
        var libJson = System.Text.Json.Nodes.JsonNode.Parse("""
            {
              "id": "lib-inner",
              "name": "Lib Crypte",
              "gridWidth": 4,
              "gridHeight": 4,
              "tiles": [["floor","floor","floor","floor"],["floor","floor","floor","floor"],["floor","floor","floor","floor"],["floor","floor","floor","floor"]],
              "rooms": [{ "id": "r1", "label": "A", "x": 0, "y": 0, "width": 2, "height": 2, "notes": "lib-secret", "encounterId": "enc-lib" }],
              "markers": [{ "id": "m1", "kind": "trap", "x": 1, "y": 1, "notes": "piège" }]
            }
            """)!.AsObject();
        var geometries = new Dictionary<Guid, System.Text.Json.Nodes.JsonObject> { [libId] = libJson };
        var filtered = CampaignJsonHelpers.FilterForPlayerView(doc.RootElement, Guid.NewGuid(), geometries);
        var map = filtered.GetProperty("dungeonMaps")[0];
        Assert.Equal("map-live", map.GetProperty("id").GetString());
        Assert.Equal(4, map.GetProperty("gridWidth").GetInt32());
        Assert.True(map.GetProperty("fogOfWarEnabled").GetBoolean());
        Assert.Equal("", map.GetProperty("rooms")[0].GetProperty("notes").GetString());
        Assert.Equal(System.Text.Json.JsonValueKind.Null, map.GetProperty("rooms")[0].GetProperty("encounterId").ValueKind);
        Assert.Equal("", map.GetProperty("markers")[0].GetProperty("notes").GetString());
    }

    [Fact]
    public void CollectActiveLibraryDungeonIds_returns_id_when_no_tiles()
    {
        var libId = Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
        const string raw = """
            {
              "activeSessionId": "ses-1",
              "sessions": [{ "id": "ses-1", "activeMapId": "map-live" }],
              "dungeonMaps": [
                { "id": "map-live", "libraryDungeonId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "name": "X" }
              ]
            }
            """;
        using var doc = System.Text.Json.JsonDocument.Parse(raw);
        var ids = CampaignJsonHelpers.CollectActiveLibraryDungeonIds(doc.RootElement);
        Assert.Single(ids);
        Assert.Equal(libId, ids[0]);
    }

    [Fact]
    public void FilterForPlayerView_keeps_active_session_map_with_fog_strips_spoilers()
    {
        const string raw = """
            {
              "activeSessionId": "ses-1",
              "sessions": [{ "id": "ses-1", "activeMapId": "map-live" }],
              "dungeonMaps": [
                {
                  "id": "map-live",
                  "name": "Crypte",
                  "fogOfWarEnabled": true,
                  "revealedRoomIds": ["r1"],
                  "rooms": [
                    {
                      "id": "r1",
                      "label": "A",
                      "notes": "trésor secret",
                      "encounterId": "enc-1",
                      "randomEncounter": { "creatures": [{ "name": "Gobelin", "quantity": 2 }] }
                    }
                  ],
                  "markers": [{ "id": "m1", "notes": "piège MJ", "kind": "trap", "x": 1, "y": 1 }]
                },
                { "id": "map-other", "name": "Autre", "rooms": [], "markers": [] }
              ]
            }
            """;
        using var doc = System.Text.Json.JsonDocument.Parse(raw);
        var filtered = CampaignJsonHelpers.FilterForPlayerView(doc.RootElement, Guid.NewGuid());
        var maps = filtered.GetProperty("dungeonMaps");
        Assert.Equal(1, maps.GetArrayLength());
        var map = maps[0];
        Assert.Equal("map-live", map.GetProperty("id").GetString());
        Assert.True(map.GetProperty("fogOfWarEnabled").GetBoolean());
        Assert.Equal("r1", map.GetProperty("revealedRoomIds")[0].GetString());
        var room = map.GetProperty("rooms")[0];
        Assert.Equal("", room.GetProperty("notes").GetString());
        Assert.Equal(System.Text.Json.JsonValueKind.Null, room.GetProperty("encounterId").ValueKind);
        Assert.False(room.TryGetProperty("randomEncounter", out _));
        Assert.Equal("", map.GetProperty("markers")[0].GetProperty("notes").GetString());
    }

    [Fact]
    public void FilterForPlayerView_strips_all_maps_when_no_active_session_map()
    {
        const string raw = """
            {
              "activeSessionId": null,
              "sessions": [{ "id": "ses-1", "activeMapId": "map-1" }],
              "dungeonMaps": [{ "id": "map-1", "name": "Crypte", "rooms": [], "markers": [] }]
            }
            """;
        using var doc = System.Text.Json.JsonDocument.Parse(raw);
        var filtered = CampaignJsonHelpers.FilterForPlayerView(doc.RootElement, Guid.NewGuid());
        Assert.Equal(0, filtered.GetProperty("dungeonMaps").GetArrayLength());
    }

    [Fact]
    public void ExtractAgendaEvents_includes_schedule_and_sessions_for_owner()
    {
        const string json = """
            {
              "scheduleEvents": [
                {
                  "id": "e1",
                  "title": "Prep",
                  "startsAt": "2026-10-05T19:00:00Z",
                  "endsAt": "2026-10-05T21:00:00Z",
                  "allDay": false,
                  "kind": "prep"
                }
              ],
              "sessions": [
                {
                  "id": "s1",
                  "title": "Soirée 1",
                  "scheduledAt": "2026-10-01T18:00:00Z",
                  "status": "planned"
                },
                {
                  "id": "s2",
                  "title": "Annulée",
                  "scheduledAt": "2026-10-02T18:00:00Z",
                  "status": "cancelled"
                }
              ]
            }
            """;

        var campaignId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var events = CampaignJsonHelpers.ExtractAgendaEvents(json, campaignId, "Ma Campagne", isOwner: true);

        Assert.Equal(3, events.Count);
        Assert.Contains(events, e => e.Id.EndsWith(":schedule:e1") && e.Kind == "prep");
        Assert.Contains(events, e => e.Id.EndsWith(":session:s1") && e.Status == "planned");
        Assert.Contains(events, e => e.Id.EndsWith(":session:s2") && e.Status == "cancelled");
    }

    [Fact]
    public void ExtractAgendaEvents_hides_cancelled_sessions_for_players()
    {
        const string json = """
            {
              "sessions": [
                { "id": "ok", "title": "OK", "scheduledAt": "2026-10-01T18:00:00Z", "status": "planned" },
                { "id": "no", "title": "NO", "scheduledAt": "2026-10-02T18:00:00Z", "status": "cancelled" }
              ]
            }
            """;

        var events = CampaignJsonHelpers.ExtractAgendaEvents(
            json,
            Guid.NewGuid(),
            "C",
            isOwner: false);

        Assert.Single(events);
        Assert.EndsWith(":session:ok", events[0].Id);
    }

    [Fact]
    public void AnalyzeCombatEnded_detects_cleared_active_combat_with_new_history()
    {
        const string oldJson = """
            {
              "sessions": [{
                "id": "ses-1",
                "activeCombat": { "id": "c1", "label": "Embuscade", "round": 3 },
                "combatHistory": []
              }]
            }
            """;
        const string newJson = """
            {
              "sessions": [{
                "id": "ses-1",
                "activeCombat": null,
                "combatHistory": [{
                  "id": "h1",
                  "label": "Embuscade",
                  "round": 4,
                  "endedAt": "2026-09-29T20:00:00Z"
                }]
              }]
            }
            """;

        var info = CampaignJsonHelpers.AnalyzeCombatEnded(oldJson, newJson);
        Assert.True(info.Changed);
        Assert.Equal("ses-1", info.SessionId);
        Assert.Equal("h1", info.HistoryId);
        Assert.Equal("Embuscade", info.Label);
        Assert.Equal(4, info.Round);
        Assert.Contains("Combat terminé", info.Message);
        Assert.Contains("tour 4", info.Message);
    }

    [Fact]
    public void AnalyzeCombatEnded_ignores_clear_without_history_growth()
    {
        const string oldJson = """
            { "sessions": [{ "id": "ses-1", "activeCombat": { "id": "c1" }, "combatHistory": [] }] }
            """;
        const string newJson = """
            { "sessions": [{ "id": "ses-1", "activeCombat": null, "combatHistory": [] }] }
            """;

        Assert.False(CampaignJsonHelpers.AnalyzeCombatEnded(oldJson, newJson).Changed);
    }

    [Fact]
    public void AnalyzeCombatEnded_defaults_label_when_history_unnamed()
    {
        const string oldJson = """
            { "sessions": [{ "id": "ses-1", "activeCombat": { "id": "c1" }, "combatHistory": [] }] }
            """;
        const string newJson = """
            {
              "sessions": [{
                "id": "ses-1",
                "activeCombat": null,
                "combatHistory": [{ "id": "h2", "label": "  " }]
              }]
            }
            """;

        var info = CampaignJsonHelpers.AnalyzeCombatEnded(oldJson, newJson);
        Assert.True(info.Changed);
        Assert.Equal("Combat", info.Label);
        Assert.Equal("Combat terminé — Combat", info.Message);
    }

    [Fact]
    public void MergeLiveCombatIntoIncoming_preserves_tableChat_when_client_omits()
    {
        const string stored = """
            {
              "sessions": [{
                "id": "ses-1",
                "tableChat": [
                  { "id": "m1", "at": "2026-01-01T12:00:00Z", "authorUserId": "u1", "authorName": "A", "body": "salut" },
                  { "id": "m2", "at": "2026-01-01T12:01:00Z", "authorUserId": "u2", "authorName": "B", "body": "ok" }
                ],
                "activeCombat": null
              }]
            }
            """;
        const string incoming = """
            {
              "sessions": [{
                "id": "ses-1",
                "activeCombat": null
              }]
            }
            """;

        var merged = CampaignJsonHelpers.MergeLiveCombatIntoIncoming(incoming, stored);
        var chat = JsonNode.Parse(merged)!["sessions"]![0]!["tableChat"]!.AsArray();
        Assert.Equal(2, chat.Count);
        Assert.Equal("m2", chat[1]!["id"]!.GetValue<string>());
    }

    [Fact]
    public void MergeLiveCombatIntoIncoming_keeps_longer_incoming_tableChat()
    {
        const string stored = """
            {
              "sessions": [{
                "id": "ses-1",
                "tableChat": [
                  { "id": "m1", "body": "old" }
                ]
              }]
            }
            """;
        const string incoming = """
            {
              "sessions": [{
                "id": "ses-1",
                "tableChat": [
                  { "id": "m1", "body": "old" },
                  { "id": "m2", "body": "new" }
                ]
              }]
            }
            """;

        var merged = CampaignJsonHelpers.MergeLiveCombatIntoIncoming(incoming, stored);
        var chat = JsonNode.Parse(merged)!["sessions"]![0]!["tableChat"]!.AsArray();
        Assert.Equal(2, chat.Count);
        Assert.Equal("m2", chat[1]!["id"]!.GetValue<string>());
    }
}
