namespace DragonsGenerator.API.Models;

public record Civilisation(
    string Id,
    string Name,
    Randomization Randomization,
    Demographics Demographics,
    Linguistics Linguistics,
    Lore Lore
);

public record Randomization(int DiceMin, int DiceMax);

public record Demographics(
    List<SpeciesRef> PrimarySpecies,
    List<SpeciesRef> SecondarySpecies,
    bool IsCosmopolitan,
    List<string> CosmopolitanZones,
    List<RoleRef> SocialRoles,
    List<SpeciesRef>? HostilePopulations = null,
    List<SpeciesRef>? HordeAllies = null,
    List<SpeciesRef>? HistoricalRulers = null,
    List<SpeciesRef>? UnderwaterPopulations = null
);

public record Linguistics(
    List<LanguageRef> OfficialLanguages,
    bool AdditionalLanguagesSpoken,
    List<WritingSystemRef> WritingSystems,
    bool? AdditionalWritingSystemsUsed = null
);

public record Lore(
    string FullDescription,
    List<string> ThreatIds,
    List<string> GeographyTags,
    List<string>? NotableFeatures = null
);

public record SpeciesRef(string Id, string Label);
public record RoleRef(string Id, string Label);
public record LanguageRef(string Id, string Label);
public record WritingSystemRef(string Id, string Label);