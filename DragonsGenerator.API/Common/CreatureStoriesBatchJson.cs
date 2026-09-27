using System.Text.Json;
using System.Text.RegularExpressions;

namespace DragonsGenerator.API.Common;

/// <summary>Parse le JSON tableau renvoyé par le lot de vies de créatures.</summary>
public static class CreatureStoriesBatchJson
{
    private static readonly Regex Fence = new(
        @"^```(?:json)?\s*|\s*```$",
        RegexOptions.IgnoreCase | RegexOptions.Multiline | RegexOptions.Compiled);

    public static bool LooksLikeBatchJson(string? text, IReadOnlyCollection<string> expectedIds)
    {
        var parsed = TryParse(text, expectedIds);
        return parsed is { Count: > 0 };
    }

    public static List<(string CreatureId, string Backstory)>? TryParse(
        string? text,
        IReadOnlyCollection<string> expectedIds)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;

        var json = ExtractJsonArray(text);
        if (json is null) return null;

        var expected = expectedIds as HashSet<string>
            ?? expectedIds.ToHashSet(StringComparer.Ordinal);

        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Array) return null;

            var list = new List<(string, string)>();
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                if (el.ValueKind != JsonValueKind.Object) continue;
                var id = el.TryGetProperty("creatureId", out var idEl) ? idEl.GetString() : null;
                var story = el.TryGetProperty("backstory", out var sEl) ? sEl.GetString()?.Trim() : null;
                if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(story)) continue;
                if (!expected.Contains(id)) continue;
                list.Add((id, story));
            }

            return list.Count > 0 ? list : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public static string? ExtractJsonArray(string text)
    {
        text = Fence.Replace(text.Trim(), "").Trim();
        var start = text.IndexOf('[');
        var end = text.LastIndexOf(']');
        if (start < 0 || end <= start) return null;

        var slice = text[start..(end + 1)];
        // Trailing commas avant ] ou } (fréquent chez les petits modèles).
        slice = Regex.Replace(slice, @",\s*([\]}])", "$1");
        return slice;
    }
}
