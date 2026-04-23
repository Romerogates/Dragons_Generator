using System.Text.Json;

namespace DragonsGenerator.API.Models;

public record Spell(
    //string Guid,
    string Id,
    string Name,
    int Level,
    string School,
    CastingTime CastingTime,
    SpellRange Range,
    SpellDuration Duration,
    SpellComponents Components,
    bool IsRitual,
    bool IsConcentration,
    bool IsCorrupted,
    string Description,
    List<ModularOption> ModularOptions,
    List<string> Classes,
    string? HigherLevels = null
);

public record CastingTime(JsonElement? Amount, string? Unit);

public record SpellRange(JsonElement? Amount, string? Unit);

public record SpellDuration(JsonElement? Amount, string? Unit);

public record SpellComponents(bool V, bool S, string? M);

public record ModularOption(string Name, string Description);