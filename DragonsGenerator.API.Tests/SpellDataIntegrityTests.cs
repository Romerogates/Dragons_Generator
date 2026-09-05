using System.Text.Json;

namespace DragonsGenerator.API.Tests;

/// <summary>
/// Garde-fou data : chaque sort du catalogue doit exposer un tableau <c>classes</c> non vide
/// (sinon le filtre magic-step les exclut).
/// </summary>
public class SpellDataIntegrityTests
{
    private static string DataRoot()
    {
        var fromBin = Path.Combine(AppContext.BaseDirectory, "Data", "Spells");
        if (Directory.Exists(fromBin)) return fromBin;
        // Fallback repo layout when running from source tree.
        var cwd = Directory.GetCurrentDirectory();
        var candidate = Path.GetFullPath(Path.Combine(cwd, "..", "DragonsGenerator.API", "Data", "Spells"));
        return candidate;
    }

    [Fact]
    public void Every_spell_json_has_non_empty_classes()
    {
        var root = DataRoot();
        Assert.True(Directory.Exists(root), $"Spells data folder missing: {root}");

        var files = Directory.GetFiles(root, "*.json", SearchOption.AllDirectories);
        Assert.NotEmpty(files);

        var missing = new List<string>();
        foreach (var file in files)
        {
            var text = File.ReadAllText(file);
            using var doc = JsonDocument.Parse(text);
            if (!doc.RootElement.TryGetProperty("classes", out var classes) ||
                classes.ValueKind != JsonValueKind.Array ||
                classes.GetArrayLength() == 0)
            {
                missing.Add(Path.GetRelativePath(root, file));
            }
        }

        Assert.True(
            missing.Count == 0,
            "Sorts sans classes non vide :\n" + string.Join("\n", missing)
        );
    }
}
