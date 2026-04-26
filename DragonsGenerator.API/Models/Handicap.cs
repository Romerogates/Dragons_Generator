using System.Text.Json;

namespace DragonsGenerator.API.Models;

public record Handicap(
    string Id,
    string Name,
    JsonElement Data
);