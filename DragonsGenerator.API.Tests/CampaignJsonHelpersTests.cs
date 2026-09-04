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
}
