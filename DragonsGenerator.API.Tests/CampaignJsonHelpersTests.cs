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
}
