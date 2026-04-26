using System.Text.Json;

namespace DragonsGenerator.API.Models;

public record Background(
    string Id,
    string Name,
    JsonElement Data
);