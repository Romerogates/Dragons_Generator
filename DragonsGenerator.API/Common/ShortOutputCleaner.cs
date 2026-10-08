using System.Text.RegularExpressions;

namespace DragonsGenerator.API.Common;

/// <summary>
/// Vies / backstories : ne garder que le paragraphe français, sans le raisonnement anglais (gpt-oss).
/// </summary>
public static class ShortOutputCleaner
{
    private static readonly Regex QuotedBlock = new(
        """["«]([^"«»]{60,})["»]""",
        RegexOptions.Compiled);

    public static string? Clean(string? raw)
    {
        var text = GroqChatClient.SanitizeModelOutput(raw);
        if (string.IsNullOrWhiteSpace(text))
            return null;

        foreach (Match quote in QuotedBlock.Matches(text))
        {
            var candidate = NormalizeParagraph(quote.Groups[1].Value);
            if (IsUsableStory(candidate))
                return candidate;
        }

        var paragraphs = Regex.Split(text, @"\n\s*\n")
            .Select(NormalizeParagraph)
            .Where(IsUsableStory)
            .OrderByDescending(p => p.Length)
            .ToList();
        if (paragraphs.Count > 0)
            return paragraphs[0];

        var stripped = StripEnglishMetaLines(text);
        stripped = NormalizeParagraph(stripped);
        return IsUsableStory(stripped) ? stripped : null;
    }

    public static bool IsUsableStory(string? text)
    {
        if (string.IsNullOrWhiteSpace(text) || text.Length < 80)
            return false;
        if (LooksLikeMeta(text))
            return false;
        return LooksFrench(text);
    }

    public static bool LooksLikeMeta(string text)
    {
        var lower = text.ToLowerInvariant();
        if (Regex.IsMatch(
                lower,
                """\b(the user wants|let's write|let's draft|let's count|let's aim|we need to|i'll adjust|word count|single dense paragraph|no introduction|write in french|so the spectre)\b"""))
            return true;

        var englishHits = Regex.Matches(
            lower,
            """\b(the|and|with|they|want|need|write|draft|count|words|paragraph|background|fairy|hook|let's|we'll)\b""").Count;
        return englishHits >= 8;
    }

    public static bool LooksFrench(string text)
    {
        var lower = text.ToLowerInvariant();
        var frenchHits = Regex.Matches(
            lower,
            """\b(le|la|les|un|une|des|et|est|dans|qui|que|son|sa|ses|pour|avec|plus|mais)\b""").Count;
        if (frenchHits >= 4)
            return true;
        return text.Any(c => "àâäéèêëïîôùûüçœ".Contains(c));
    }

    private static string StripEnglishMetaLines(string text)
    {
        var kept = new List<string>();
        foreach (var line in text.Split('\n'))
        {
            var trimmed = line.Trim();
            if (trimmed.Length == 0)
                continue;
            if (LooksLikeMeta(trimmed) && !LooksFrench(trimmed))
                continue;
            kept.Add(trimmed);
        }

        return string.Join(' ', kept);
    }

    private static string NormalizeParagraph(string text)
    {
        var t = text.Trim().Trim('"', '«', '»');
        t = Regex.Replace(t, @"\s+", " ");
        return t.Trim();
    }
}
