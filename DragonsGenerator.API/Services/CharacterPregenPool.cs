using System.Text.Json;
using System.Text.Json.Nodes;

namespace DragonsGenerator.API.Services;

/// <summary>
/// Pré-tirés campagne stockés comme CharacterRecord du MJ, hors liste « Mes héros ».
/// Flag JSON <c>isPregenPool: true</c> (pas de colonne DB — compatible EnsureCreated).
/// </summary>
public static class CharacterPregenPool
{
    public const string JsonFlag = "isPregenPool";

    public static bool IsPoolRecord(string? jsonData) =>
        !string.IsNullOrWhiteSpace(jsonData)
        && jsonData.Contains("\"isPregenPool\":true", StringComparison.Ordinal);

    /// <summary>Retire le flag pour une copie « Mes héros » (claim).</summary>
    public static string StripPoolFlag(string jsonData)
    {
        try
        {
            var node = JsonNode.Parse(string.IsNullOrWhiteSpace(jsonData) ? "{}" : jsonData);
            if (node is JsonObject obj)
            {
                obj.Remove(JsonFlag);
                return obj.ToJsonString(new JsonSerializerOptions { WriteIndented = false });
            }
        }
        catch
        {
            /* keep raw */
        }
        return jsonData;
    }
}
