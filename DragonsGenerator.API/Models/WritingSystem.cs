namespace DragonsGenerator.API.Models;

public record WritingSystem(
    string Id,
    string Name,
    string Type,
    List<LanguageReference> UsedByLanguages,
    string Description,
    List<string> SpecialFeatures,
    SignsCountRange? SignsCountRange = null,
    ReadingDifficulty? ReadingDifficulty = null
);

public record SignsCountRange(int Min, int Max);

public record LanguageReference(string Id, string Label);

public record ReadingDifficulty(
    string? RareWordsCheck = null,
    string? ObscurePassagesCheck = null,
    string? DecipherNote = null
);