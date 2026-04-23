using System.Text.Json;

namespace DragonsGenerator.API.Models;

public record Equipment(
    string Id,
    string Name,
    string Type,
    Cost Cost,
    JsonElement? Data,
    string? Subtype = null,
    double? WKg = null
);

public record Cost(int? V, string U);