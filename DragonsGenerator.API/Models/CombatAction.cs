using System.Text.Json;

namespace DragonsGenerator.API.Models;

public record CombatAction(
    string Id,
    string Name,
    string ActionCost,
    string Category,
    string? Description,
    JsonElement? Mechanics,
    string? Source = null
);
