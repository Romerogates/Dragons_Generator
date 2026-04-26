using System.Text.Json;
using System.Text.Json.Serialization;

namespace DragonsGenerator.API.Models;

public class HandicapsFile
{
    [JsonPropertyName("handicaps")]
    public List<Handicap> Handicaps { get; set; } = [];

    [JsonPropertyName("rules")]
    public JsonElement? Rules { get; set; }
}