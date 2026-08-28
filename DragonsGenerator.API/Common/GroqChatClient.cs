using System.Text.RegularExpressions;

namespace DragonsGenerator.API.Common;

public sealed record GroqChatResult(
    bool Ok,
    string? Text,
    string? Error,
    bool RateLimited = false,
    bool Retryable = false,
    int? RetryAfterMs = null);

public static class GroqChatClient
{
    internal static string? SanitizeModelOutput(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return null;

        var original = text;

        if (text.Contains("<think>", StringComparison.OrdinalIgnoreCase))
        {
            text = Regex.Replace(
                text,
                @"(?is)<think>.*?(?:</think>|$)",
                string.Empty).Trim();
        }

        if (string.IsNullOrWhiteSpace(text))
            text = ExtractStructuredAdventure(original);

        if (string.IsNullOrWhiteSpace(text))
            return null;

        if (Regex.IsMatch(text, @"^\s*We need to\b", RegexOptions.IgnoreCase))
        {
            var quoted = Regex.Matches(text, "\"([^\"]{40,})\"")
                .Select(m => m.Groups[1].Value.Trim())
                .LastOrDefault();
            if (!string.IsNullOrWhiteSpace(quoted))
                text = quoted;
        }

        text = text.Trim().Trim('"');
        if (text.StartsWith("```", StringComparison.Ordinal))
        {
            text = Regex.Replace(text, @"^```(?:json)?\s*", string.Empty, RegexOptions.IgnoreCase);
            text = Regex.Replace(text, @"\s*```$", string.Empty);
        }

        return string.IsNullOrWhiteSpace(text) ? null : text;
    }

    /// <summary>groq/compound place parfois l'aventure uniquement dans le bloc thinking.</summary>
    private static string? ExtractStructuredAdventure(string text)
    {
        var match = Regex.Match(text, @"(?is)(\*\*Accroche\*\*[\s\S]+)", RegexOptions.None);
        if (match.Success)
            return match.Groups[1].Value.Trim();

        match = Regex.Match(text, @"(?is)((?:\*\*[^*]+\*\*\s*[—\-–][\s\S]+))", RegexOptions.None);
        return match.Success ? match.Groups[1].Value.Trim() : null;
    }
}
