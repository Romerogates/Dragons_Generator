using System.Text.Json;
using DragonsGenerator.API.Models;

namespace DragonsGenerator.API.Common;

public static partial class DataMappers
{
    private static JsonSerializerOptions Options => IndexedDataStore.JsonOptions;

    public static int ParseHitDie(string hitDie)
    {
        if (string.IsNullOrWhiteSpace(hitDie))
            return 0;

        var parts = hitDie.Split('d', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return parts.Length == 2 && int.TryParse(parts[1], out var value) ? value : 0;
    }

    private static JsonElement ExtractData(JsonElement detail, params string[] exclude)
    {
        var dict = new Dictionary<string, JsonElement>();
        foreach (var prop in detail.EnumerateObject())
        {
            if (!exclude.Contains(prop.Name))
                dict[prop.Name] = prop.Value.Clone();
        }

        var json = JsonSerializer.Serialize(dict, Options);
        return JsonSerializer.Deserialize<JsonElement>(json, Options);
    }

    private static string GetString(JsonElement el, string prop) =>
        el.TryGetProperty(prop, out var v) ? v.GetString() ?? "" : "";

    private static string? GetStringOrNull(JsonElement el, string prop) =>
        el.ValueKind != JsonValueKind.Undefined && el.TryGetProperty(prop, out var v) && v.ValueKind != JsonValueKind.Null
            ? v.GetString()
            : null;

    public static int? GetNullableInt(JsonElement el, string prop) =>
        el.ValueKind != JsonValueKind.Undefined
        && el.TryGetProperty(prop, out var v)
        && v.ValueKind == JsonValueKind.Number
        && v.TryGetInt32(out var i)
            ? i
            : null;

    private static int GetInt(JsonElement el, string prop) =>
        el.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i) ? i : 0;

    private static bool GetBool(JsonElement el, string prop) =>
        el.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.True;

    private static List<string> MapStringList(JsonElement el, string prop) =>
        el.TryGetProperty(prop, out var arr) && arr.ValueKind == JsonValueKind.Array
            ? MapStringListFromElement(arr)
            : [];

    private static List<string> MapStringListFromElement(JsonElement arr) =>
        arr.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => x.Length > 0).ToList();

    private static List<SpeciesRef> MapRefList(JsonElement el, string prop) =>
        el.TryGetProperty(prop, out var arr) && arr.ValueKind == JsonValueKind.Array
            ? MapRefListFromElement(arr)
            : [];

    private static List<SpeciesRef>? MapRefListOrNull(JsonElement el, string prop) =>
        el.TryGetProperty(prop, out var arr) && arr.ValueKind == JsonValueKind.Array
            ? MapRefListFromElement(arr)
            : null;

    private static List<SpeciesRef> MapRefListFromElement(JsonElement arr) =>
        arr.EnumerateArray().Select(r => new SpeciesRef(
            GetString(r, "id"), GetString(r, "label"))).ToList();

    private static List<LanguageRef> MapLanguageRefListFromElement(JsonElement arr) =>
        arr.ValueKind == JsonValueKind.Array
            ? arr.EnumerateArray().Select(r => new LanguageRef(
                GetString(r, "id"), GetString(r, "label"))).ToList()
            : [];

    private static List<RoleRef> MapRoleRefList(JsonElement el, string prop) =>
        el.TryGetProperty(prop, out var arr) && arr.ValueKind == JsonValueKind.Array
            ? arr.EnumerateArray().Select(r => new RoleRef(GetString(r, "id"), GetString(r, "label"))).ToList()
            : [];

    private static List<WritingSystemRef> MapWritingRefList(JsonElement arr) =>
        arr.ValueKind == JsonValueKind.Array
            ? arr.EnumerateArray().Select(w => new WritingSystemRef(
                GetString(w, "id"), GetString(w, "label"))).ToList()
            : [];
}
