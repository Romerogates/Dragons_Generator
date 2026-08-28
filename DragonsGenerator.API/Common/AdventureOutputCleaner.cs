using System.Text;
using System.Text.RegularExpressions;

namespace DragonsGenerator.API.Common;

/// <summary>Extrait l'aventure jouable en français, sans méta-planning du modèle.</summary>
public static class AdventureOutputCleaner
{
    private static readonly string[] SectionTitles =
    [
        "Accroche",
        "Contexte",
        "Personnages clés",
        "Acte 1",
        "Acte 2",
        "Acte 3",
        "Pistes pour le MJ",
    ];

    private static readonly Regex EnglishPlanningCutoff = new(
        @"(?is)(?:\d+\.\s*\*\*Word Count|\*\*Word Count Check|\bLet's count\b|\bTotal:\s*~?\d|\bI'll adjust slightly\b|\bDeconstruct Constraints\b|\bMental Refinement\b|\bUnderstand the Task\b|\*\*Integration:\*\*|\*\*Language:\*\*|\*\*Adventure Details:\*\*)",
        RegexOptions.Compiled);

    private static readonly Regex SectionHeader = new(
        @"(?im)^[\*_\s]*(?:\*\*(?<title>Accroche|Contexte|Personnages clés|Acte 1|Acte 2|Acte 3|Pistes pour le MJ)\*\*|\*(?<title>Accroche|Contexte|Personnages clés|Acte 1|Acte 2|Acte 3|Pistes pour le MJ)\*:)\s*[—\-–:]?\s*(?<body>.*)$",
        RegexOptions.Compiled);

    public static string? Clean(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return null;

        var text = GroqChatClient.SanitizeModelOutput(raw) ?? raw.Trim();
        text = EnglishPlanningCutoff.Split(text)[0].Trim();
        text = StripBulletOutline(text);

        var sections = ParseSections(text);
        if (sections.Count >= 3)
            return FormatSections(sections);

        // Dernier recours : plus long bloc français structuré après la première Accroche substantielle
        var fallback = Regex.Match(
            text,
            @"(?is)(\*\*Accroche\*\*\s*[—\-–:]\s*[A-ZÀ-Ü«""][\s\S]+?\*\*Pistes pour le MJ\*\*[\s\S]+?)(?:\n\n|\z)",
            RegexOptions.None);
        if (fallback.Success)
            return Clean(fallback.Groups[1].Value);

        return IsSubstantiveBody(text) ? text.Trim() : null;
    }

    private static string StripBulletOutline(string text)
    {
        // Supprime les listes « - **Accroche** — présentation du conflit » (modèle qui recopie le plan)
        var lines = text.Split('\n');
        var kept = new List<string>();
        foreach (var line in lines)
        {
            var trimmed = line.Trim();
            if (Regex.IsMatch(trimmed, @"^[-*•]\s+\*\*(Accroche|Contexte|Personnages clés|Acte \d|Pistes pour le MJ)\*\*\s*[—\-–]\s*(présentation|où et quand|rappel bref|découverte|complications|climax|2-3 idées)", RegexOptions.IgnoreCase))
                continue;
            if (Regex.IsMatch(trimmed, @"^\*\*(Integration|Language|Adventure Details)\*\*", RegexOptions.IgnoreCase))
                continue;
            kept.Add(line);
        }

        return string.Join('\n', kept);
    }

    private static List<(string Title, string Body)> ParseSections(string text)
    {
        var matches = SectionHeader.Matches(text);
        var sections = new List<(string Title, string Body)>();

        for (var i = 0; i < matches.Count; i++)
        {
            var title = matches[i].Groups["title"].Value.Trim();
            var inlineBody = matches[i].Groups["body"].Value.Trim();
            string body;
            if (i + 1 < matches.Count)
            {
                var start = matches[i].Index + matches[i].Length;
                var end = matches[i + 1].Index;
                var block = text[start..end].Trim();
                body = string.IsNullOrWhiteSpace(inlineBody) ? block : $"{inlineBody}\n{block}".Trim();
            }
            else
            {
                var start = matches[i].Index + matches[i].Length;
                body = string.IsNullOrWhiteSpace(inlineBody) ? text[start..].Trim() : inlineBody;
            }

            body = EnglishPlanningCutoff.Split(body)[0].Trim();
            if (!IsSubstantiveBody(body))
                continue;

            if (sections.Any(s => s.Title == title))
                continue;

            sections.Add((title, body));
        }

        return sections
            .OrderBy(s => Array.IndexOf(SectionTitles, s.Title))
            .ToList();
    }

    private static string FormatSections(IReadOnlyList<(string Title, string Body)> sections)
    {
        var sb = new StringBuilder();
        foreach (var (title, body) in sections)
        {
            if (sb.Length > 0)
                sb.Append("\n\n");
            sb.Append("**").Append(title).Append("** — ").Append(body.Trim());
        }

        return sb.ToString().Trim();
    }

    private static bool IsSubstantiveBody(string body)
    {
        if (string.IsNullOrWhiteSpace(body))
            return false;

        body = body.Trim();
        if (body.Length < 35)
            return false;

        // Rejette les sous-titres seuls recopiés du prompt
        if (Regex.IsMatch(body, @"^(présentation du conflit|où et quand|rappel bref|découverte / enquête|complications|climax|2-3 idées)\.?$", RegexOptions.IgnoreCase))
            return false;

        return Regex.IsMatch(body, @"[a-zà-ÿA-ZÀ-Ü]", RegexOptions.None);
    }
}
