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
        Assert.Equal("c1", session.GetProperty("activeCombat").GetProperty("id").GetString());
        Assert.Equal(0, session.GetProperty("combatHistory").GetArrayLength());
        Assert.Equal(0, filtered.GetProperty("creatures").GetArrayLength());
    }
}
