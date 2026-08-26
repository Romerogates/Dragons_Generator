namespace DragonsGenerator.API.Models;

public record Deity(
    string Id,
    string Name,
    string? Tonality,
    List<string> Domains,
    string? Description,
    List<string> OtherNames,
    string? WorshippersNote,
    List<string> GrantsPowersTo,
    string? Source = null
);
