using DragonsGenerator.API.Common;

namespace DragonsGenerator.API.Tests;

public class CreatureStoriesBatchJsonTests
{
    private static readonly string[] Ids = ["cre-gobelin", "cre-orc"];

    [Fact]
    public void TryParse_clean_array()
    {
        var json = """
            [{"creatureId":"cre-gobelin","backstory":"Un petit guerrier de la Cité Franche."},{"creatureId":"cre-orc","backstory":"Une brute au cœur tendre."}]
            """;

        var parsed = CreatureStoriesBatchJson.TryParse(json, Ids);
        Assert.NotNull(parsed);
        Assert.Equal(2, parsed!.Count);
        Assert.Equal("cre-gobelin", parsed[0].CreatureId);
        Assert.Contains("Cité Franche", parsed[0].Backstory);
    }

    [Fact]
    public void TryParse_markdown_fence_and_trailing_comma()
    {
        var text = """
            ```json
            [
              {"creatureId":"cre-gobelin","backstory":"Histoire A"},
              {"creatureId":"cre-orc","backstory":"Histoire B"},
            ]
            ```
            """;

        var parsed = CreatureStoriesBatchJson.TryParse(text, Ids);
        Assert.NotNull(parsed);
        Assert.Equal(2, parsed!.Count);
    }

    [Fact]
    public void TryParse_ignores_unknown_ids_and_empty_stories()
    {
        var json = """
            [
              {"creatureId":"cre-inconnu","backstory":"Nope"},
              {"creatureId":"cre-gobelin","backstory":""},
              {"creatureId":"cre-orc","backstory":"OK"}
            ]
            """;

        var parsed = CreatureStoriesBatchJson.TryParse(json, Ids);
        Assert.NotNull(parsed);
        Assert.Single(parsed!);
        Assert.Equal("cre-orc", parsed[0].CreatureId);
    }

    [Fact]
    public void TryParse_prose_without_json_returns_null()
    {
        Assert.Null(CreatureStoriesBatchJson.TryParse("Voici l'histoire du gobelin…", Ids));
        Assert.False(CreatureStoriesBatchJson.LooksLikeBatchJson("pas de json", Ids));
    }

    [Fact]
    public void LooksLikeBatchJson_true_when_at_least_one_valid()
    {
        var text = """[{"creatureId":"cre-gobelin","backstory":"Une vie."}]""";
        Assert.True(CreatureStoriesBatchJson.LooksLikeBatchJson(text, Ids));
    }
}
