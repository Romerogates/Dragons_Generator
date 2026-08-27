namespace DragonsGenerator.API.Models;

public record CreatureAbility(int Score, string Modifier);

public record CreatureNamedEntry(string Name, string Description);

public record Creature(
    string Id,
    string Name,
    string Category,
    string? Part,
    string? Section,
    string Type,
    int ArmorClass,
    string? ArmorNote,
    string HitPoints,
    int? WoundThreshold,
    string Speed,
    Dictionary<string, CreatureAbility> Abilities,
    string? SavingThrows,
    string? Skills,
    string? Senses,
    string? Languages,
    string ChallengeRating,
    int Xp,
    List<CreatureNamedEntry> Traits,
    List<CreatureNamedEntry> Actions,
    List<CreatureNamedEntry> Reactions,
    List<CreatureNamedEntry> LegendaryActions,
    string Description
);
