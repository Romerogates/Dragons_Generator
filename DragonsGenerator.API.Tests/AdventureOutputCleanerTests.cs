using DragonsGenerator.API.Common;

namespace DragonsGenerator.API.Tests;

public class AdventureOutputCleanerTests
{
    [Fact]
    public void Clean_removes_english_planning_and_keeps_french_sections()
    {
        const string raw = """
            - **Accroche** — présentation du conflit
            - **Contexte** — où et quand, ambiance
            **Integration:** Must integrate creatures.
            2. **Deconstruct Constraints & Requirements:**
            Must follow structure. Word count 400-600.

            **Accroche** — La Cité Franche tremble. Des disparitions mystérieuses jettent un voile de peur sur les quartiers commerçants et les héros sont convoqués pour enquêter sur une menace qui grandit dans les ténèbres.

            **Contexte** — Situé aux frontières du royaume, le port cosmopolite de Cité Franche vit sous un ciel de brume perpétuelle où chaque ombre cache un secret.

            **Personnages clés** — **Chef de bande rat-garou** dirige les sabotages souterrains. **Dragonnet de cuivre** guide les héros. **Goule** ajoute une folie imprévisible à la mêlée générale.

            **Acte 1** — Les aventuriers descendent dans les catacombes humides, guidés par les indices laissés par les marchands disparus et le dragonnet rejoint leur convoi.

            **Acte 2** — Le chef rat-garou surgit et une goule émerge des ombres, compliquant le combat sous les voûtes de pierre.

            **Acte 3** — Les héros poursuivent l'antagoniste blessé et la cité retrouve une fragile sérénité après le clash final.

            **Pistes pour le MJ** — La goule peut révéler un artefact volé. Le chef peut survivre en empoisonnant les réserves d'eau.

            4. **Word Count Check (French):**
            Total: ~523 words. Perfect.
            """;

        var cleaned = AdventureOutputCleaner.Clean(raw);

        Assert.NotNull(cleaned);
        Assert.DoesNotContain("Word Count", cleaned, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Deconstruct", cleaned, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Integration", cleaned, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("présentation du conflit", cleaned, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("**Accroche**", cleaned);
        Assert.Contains("La Cité Franche tremble", cleaned);
        Assert.Contains("**Pistes pour le MJ**", cleaned);
    }
}
