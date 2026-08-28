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

        if (text.Contains("<think>", StringComparison.OrdinalIgnoreCase))
        {
            var afterThinking = Regex.Replace(
                text,
                @"(?is)<think>.*?(?:</think>|$)",
                string.Empty);
            text = afterThinking.Trim();
        }

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
}
