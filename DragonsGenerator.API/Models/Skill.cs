namespace DragonsGenerator.API.Models;

public record Skill(
    string Id,
    string Name,
    string Ability,
    string Description,
    List<string> Examples,
    bool PassiveCheck,
    string? Source = null
);
