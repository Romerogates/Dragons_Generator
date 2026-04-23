using System.Text.Json;

namespace DragonsGenerator.API.Models;

// Racine du fichier JSON
public record SpeciesData(
    Dictionary<string, string> SizeCodes,
    Dictionary<string, string> AbilityCodes,
    List<Species> Species
);

public record Species(
    string Id,
    string Name,
    List<string> NameAlt,
    Source Source,
    Flavor Flavor,
    BaseStats BaseStats,
    List<Trait> Traits,
    List<CreationChoice> CreationChoices,
    Languages Languages,
    List<Subspecies> Subspecies,
    List<OptionalRule> OptionalRules,
    List<CivilizationLink>? CivilizationLinks = null
);

public record Source(string Book, string Pages);

public record Flavor(
    string Summary,
    string? Culture = null,
    string? Origins = null,
    List<string>? LoreNotes = null
);

public record BaseStats(
    Dictionary<string, int> AbilityScoreIncrease,
    double SpeedM,
    string Size,
    double DarkvisionM,
    Height Height,
    Weight Weight,
    Age Age,
    Alignment Alignment,
    FlexibleAsi? FlexibleAsi = null,
    string? SpeedNotes = null,
    bool? SpeedNotReducedByHeavyArmor = null
);

public record Height(string Desc, string? RangeM = null);
public record Weight(string Desc, string? RangeKg = null);

public record Age(
    int MaturityYears,
    int LifespanYears,
    string Desc,
    int? AdulthoodCulturalYears = null,
    int? LifespanMaxYears = null
);

public record Alignment(string Tendency, string Desc);

public record FlexibleAsi(int Count, int Value, List<string> Excluded);

public record Trait(
    string Id,
    string Name,
    string Desc,
    JsonElement? Mechanics = null
);

public record CreationChoice(
    string Id,
    string Name,
    string Desc,
    string Type,
    int? ChoiceCount = null,
    JsonElement? Options = null,
    JsonElement? OptionGroups = null,
    string? SpellList = null,
    int? SpellLevel = null,
    string? SpellcastingAbility = null,
    int? ValuePerChoice = null,
    List<string>? Excluded = null
);

public record Subspecies(
    string Id,
    string Name,
    bool Playable,
    string Flavor,
    Dictionary<string, int> AbilityScoreIncrease,
    List<Trait> Traits,
    List<CreationChoice> CreationChoices,
    string? PlayableNotes = null,
    Languages? Languages = null
);

public record Languages(
    List<string> Fixed,
    int ChoiceCount,
    string? Notes = null,
    JsonElement? GrantsFromChoice = null
);

public record OptionalRule(
    string Id,
    string Name,
    string Desc,
    JsonElement? Mechanics = null
);

public record CivilizationLink(string Id, string Name, string Desc);