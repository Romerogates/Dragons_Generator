using DragonsGenerator.API.Common;

namespace DragonsGenerator.API.Tests;

public class CreatureStoryPromptTests
{
    [Fact]
    public void BuildSingle_keeps_custom_name_and_forbids_bestiary_nicknames()
    {
        var prompt = CreatureStoryPrompt.BuildSingle(
            "Anakedi",
            "Anakedi",
            "Fée de taille TP",
            "divers",
            "3",
            "antagoniste principal",
            "Cité Franche",
            "Le matou Aile-de-poulet s’est imposé à la tête du groupe marginal Balikölüm.",
            "Neuf vies",
            "Griffes");

        Assert.Contains("Nom dans l'histoire: Anakedi", prompt);
        Assert.Contains(CreatureStoryPrompt.OriginalityRules, prompt);
        Assert.Contains("ne pas copier les noms", prompt);
        Assert.Contains("Aile-de-poulet", prompt);
    }
}
