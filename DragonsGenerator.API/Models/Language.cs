namespace DragonsGenerator.API.Models;

public record Language(
    string Id,
    string Name,
    string Category,
    LanguageLinguistics Linguistics,
    LanguageSpeakers Speakers,
    LanguageLore Lore
);

public record LanguageLinguistics(
    List<LanguageWritingSystem> WritingSystems,
    bool IsOralOnly,
    string? WritingNotes = null
);

public record LanguageWritingSystem(
    string Id,
    string Label,
    string Type
);

public record LanguageSpeakers(
    List<SpeakerRef> Primary,
    List<string> Regions,
    bool? IsExtinct = null
);

public record SpeakerRef(string Id, string Label);

public record LanguageLore(
    string FullDescription,
    string? Sonority = null
);