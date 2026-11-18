using DragonsGenerator.API.Services;

namespace DragonsGenerator.API.Tests;

public class CampaignLiveTableStoreTests
{
    [Fact]
    public void IsEmpty_treats_blank_and_braces()
    {
        Assert.True(CampaignLiveTableStore.IsEmpty(null));
        Assert.True(CampaignLiveTableStore.IsEmpty(""));
        Assert.True(CampaignLiveTableStore.IsEmpty(" {} "));
        Assert.True(CampaignLiveTableStore.IsEmpty("null"));
        Assert.False(CampaignLiveTableStore.IsEmpty("""{"sessions":{}}"""));
    }

    [Fact]
    public void Extract_copies_pawns_map_and_combat_by_session_id()
    {
        const string json = """
            {
              "notes": "keep",
              "sessions": [
                { "id": "ses-1", "title": "Soirée", "tablePawns": [{ "id": "p1", "mapX": 2 }], "activeMapId": "map-a", "activeCombat": { "round": 1 } },
                { "id": "ses-2", "title": "Vide" },
                { "title": "sans-id", "tablePawns": [] }
              ]
            }
            """;
        var live = CampaignLiveTableStore.Extract(json);
        Assert.Contains("ses-1", live);
        Assert.DoesNotContain("ses-2", live);
        Assert.Contains("map-a", live);
        Assert.Contains("\"round\":1", live.Replace(" ", ""));
    }

    [Fact]
    public void Extract_empty_or_invalid_json()
    {
        Assert.Equal("{}", CampaignLiveTableStore.Extract(null));
        Assert.Equal("{}", CampaignLiveTableStore.Extract("{"));
        Assert.Equal("{}", CampaignLiveTableStore.Extract("""{"sessions":[]}"""));
    }

    [Fact]
    public void Hydrate_overlays_live_slice_on_matching_session()
    {
        const string campaign = """
            {
              "sessions": [
                { "id": "ses-1", "title": "Soirée", "tablePawns": [{ "id": "p1", "mapX": 1 }], "activeMapId": "old" }
              ]
            }
            """;
        const string live = """
            {
              "sessions": {
                "ses-1": {
                  "tablePawns": [{ "id": "p1", "mapX": 8 }],
                  "activeMapId": "new-map",
                  "activeCombat": { "round": 3 }
                }
              }
            }
            """;
        var hydrated = CampaignLiveTableStore.Hydrate(campaign, live);
        Assert.Contains("\"mapX\":8", hydrated.Replace(" ", ""));
        Assert.Contains("new-map", hydrated);
        Assert.Contains("Soirée", hydrated);
        Assert.Contains("\"round\":3", hydrated.Replace(" ", ""));
    }

    [Fact]
    public void Write_extracts_live_slice_so_hydrate_keeps_later_combat()
    {
        var campaign = new Persistence.CampaignRecord
        {
            JsonData = """{"sessions":[{"id":"ses-1","activeCombat":{"round":1}}]}""",
        };
        CampaignLiveTableStore.Write(campaign, campaign.JsonData);
        Assert.Contains("ses-1", campaign.LiveTableJson);

        var rolled = """{"sessions":[{"id":"ses-1","activeCombat":{"round":1,"initiativeRoll":17}}]}""";
        CampaignLiveTableStore.Write(campaign, rolled);
        var hydrated = CampaignLiveTableStore.Read(campaign);
        Assert.Contains("initiativeRoll", hydrated);
        Assert.Contains("17", hydrated);
    }

    [Fact]
    public void Hydrate_empty_live_returns_campaign_json()
    {
        const string campaign = """{"sessions":[{"id":"ses-1"}]}""";
        Assert.Equal(campaign, CampaignLiveTableStore.Hydrate(campaign, "{}"));
        Assert.Equal("{}", CampaignLiveTableStore.Hydrate(null, null));
        Assert.Equal("{", CampaignLiveTableStore.Hydrate("{", "not-json"));
        Assert.Equal(campaign, CampaignLiveTableStore.Hydrate(campaign, """{"sessions":[]}"""));
        Assert.Equal("""{"notes":1}""", CampaignLiveTableStore.Hydrate("""{"notes":1}""", """{"sessions":{"ses-1":{"activeMapId":"x"}}}"""));
    }

    [Fact]
    public void Extract_ignores_sessions_without_live_fields_or_id()
    {
        Assert.Equal("{}", CampaignLiveTableStore.Extract("""{"sessions":{"not":"array"}}"""));
        Assert.Equal("{}", CampaignLiveTableStore.Extract("   "));
        var live = CampaignLiveTableStore.Extract("""{"sessions":[{"id":1,"tablePawns":[]}]}""");
        Assert.Equal("{}", live);
    }
}
