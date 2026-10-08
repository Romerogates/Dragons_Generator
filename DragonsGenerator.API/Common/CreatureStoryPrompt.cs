namespace DragonsGenerator.API.Common;

public static class CreatureStoryPrompt
{
    public const string OriginalityRules = """
        Le personnage s'appelle UNIQUEMENT le nom donné dans l'histoire — aucun autre surnom.
        La fiche bestiaire décrit l'ESPÈCE et parfois un PNJ d'exemple (surnoms, gangs, lieux).
        Inspire-toi du physique, des pouvoirs et du tempérament. N'importe PAS les noms propres de l'exemple.
        Invente un individu original. N'écris pas « Nom, le SurnomDuBestiaire ».
        """;

    public static string BuildSingle(
        string customName,
        string speciesName,
        string type,
        string? category,
        string? challengeRating,
        string roleLabel,
        string? setting,
        string? description,
        string? traitsSummary,
        string? actionsSummary)
    {
        var flavor = string.IsNullOrWhiteSpace(description)
            ? "Non renseignée"
            : description[..Math.Min(description.Length, 400)];

        return $"""
            Tu es un maître du jeu expert en jeux de rôle fantasy francophones, spécialisé dans l'univers d'Eana (Dragons).
            Génère la VIE et l'HISTOIRE PERSONNELLE d'un individu de cette espèce.
            Maximum 120 mots, un seul paragraphe dense et immersif.
            L'histoire doit expliquer qui il/elle est, son passé, ses motivations, et un hook pour une aventure.
            {OriginalityRules}
            Réponds uniquement avec l'histoire en français. Aucun anglais, aucun plan, aucun brouillon, aucun guillemet autour du texte.

            PERSONNAGE:
            - Nom dans l'histoire: {customName.Trim()}
            - Espèce (bestiaire): {speciesName}
            - Type: {type}
            {(string.IsNullOrWhiteSpace(category) ? "" : $"- Catégorie: {category}")}
            {(string.IsNullOrWhiteSpace(challengeRating) ? "" : $"- Facteur de puissance: {challengeRating}")}
            - Rôle narratif: {roleLabel}
            {(setting != null ? $"- Contexte de l'aventure: {setting}" : "")}
            - Notes d'espèce (exemple bestiaire, ne pas copier les noms): {flavor}
            {(string.IsNullOrWhiteSpace(traitsSummary) ? "" : $"- Traits notables: {traitsSummary}")}
            {(string.IsNullOrWhiteSpace(actionsSummary) ? "" : $"- Capacités marquantes: {actionsSummary}")}
            """;
    }
}
