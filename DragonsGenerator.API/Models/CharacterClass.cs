using System.Text.Json;

namespace DragonsGenerator.API.Models;

public record CharacterClass(
    string Id,
    string Name,
    JsonElement Data
);