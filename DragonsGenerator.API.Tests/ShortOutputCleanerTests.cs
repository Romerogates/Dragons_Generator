using DragonsGenerator.API.Common;

namespace DragonsGenerator.API.Tests;

public class ShortOutputCleanerTests
{
    [Fact]
    public void Clean_keeps_only_the_french_story_from_gpt_oss_reasoning()
    {
        const string raw = """
            The user wants a background for an Anakedi, a fairy. They want a single dense paragraph, no introduction or commentary. Max 120 words.
            Let's draft:

            "Anakedi, une fée tigrée aux yeux d'ébène, a longtemps erré dans les ruelles de la cité de Veyla, jusqu’à ce qu’un conflit avec un chasseur de créatures l’ait propulsé à la tête du gang marginal Balikölüm. Son museau marqué par des cicatrices de batailles passées l’a rendu redoutable : lorsqu’une menace surgit, il ne parle pas, il attaque."

            So the spectre is allied to heroes. But it's chaotic evil. We'll craft a story.
            """;

        var cleaned = ShortOutputCleaner.Clean(raw);

        Assert.NotNull(cleaned);
        Assert.StartsWith("Anakedi, une fée tigrée", cleaned);
        Assert.DoesNotContain("The user wants", cleaned, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Let's draft", cleaned, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("spectre is allied", cleaned, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Clean_rejects_english_only_planning()
    {
        var cleaned = ShortOutputCleaner.Clean(
            "The user wants a background. Let's write about a fairy. We need 120 words. Let's count.");
        Assert.Null(cleaned);
    }
}
