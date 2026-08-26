using System.Text.Json;

namespace DragonsGenerator.API.Models;

public record Feat(
    string Id,
    string Name,
    bool RequiresMagic,
    string? Category,
    string? Description,
    bool Repeatable,
    List<string> Tags,
    JsonElement Data
);
