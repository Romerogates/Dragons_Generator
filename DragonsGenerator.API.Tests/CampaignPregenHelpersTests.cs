using System.Text.Json.Nodes;
using DragonsGenerator.API.Endpoints.Campaigns;

namespace DragonsGenerator.API.Tests;

public class CampaignPregenHelpersTests
{
    [Fact]
    public void UnassignUser_clears_matching_assignment()
    {
        var userId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
        var data = JsonNode.Parse("""
            {
              "pregenCharacters": [
                { "id": "p1", "assignedUserId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "assignedDisplayName": "A", "status": "assigned" },
                { "id": "p2", "assignedUserId": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "status": "assigned" }
              ]
            }
            """)!.AsObject();

        Assert.True(CampaignPregenHelpers.UnassignUser(data, userId));
        var arr = data["pregenCharacters"]!.AsArray();
        Assert.Null(arr[0]!["assignedUserId"]);
        Assert.Equal("ready", arr[0]!["status"]!.GetValue<string>());
        Assert.Equal("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", arr[1]!["assignedUserId"]!.GetValue<string>());
    }

    [Fact]
    public void UnassignUser_noop_without_pregens()
    {
        var data = JsonNode.Parse("""{"title":"x"}""")!.AsObject();
        Assert.False(CampaignPregenHelpers.UnassignUser(data, Guid.NewGuid().ToString()));
    }
}
