using System.Text.Json;
using DragonsGenerator.API.Models;

namespace DragonsGenerator.API.Common;

public static partial class DataMappers
{
    public static Spell ToSpell(JsonElement detail)
    {
        var castingTime = detail.TryGetProperty("casting_time", out var ct)
            ? new CastingTime(
                ct.TryGetProperty("value", out var val) && val.ValueKind != JsonValueKind.Null
                    ? JsonSerializer.SerializeToElement(val, Options)
                    : null,
                GetStringOrNull(ct, "unit"))
            : new CastingTime(null, null);

        var range = MapSpellRange(detail);
        var duration = MapSpellDuration(detail);

        var components = detail.TryGetProperty("components", out var c)
            ? new SpellComponents(
                c.TryGetProperty("v", out var v) && v.GetBoolean(),
                c.TryGetProperty("s", out var s) && s.GetBoolean(),
                GetStringOrNull(c, "m"))
            : new SpellComponents(false, false, null);

        return new Spell(
            Id: GetString(detail, "id"),
            Name: GetString(detail, "name"),
            Level: GetInt(detail, "level"),
            School: GetString(detail, "school"),
            CastingTime: castingTime,
            Range: range,
            Duration: duration,
            Components: components,
            IsRitual: GetBool(detail, "is_ritual"),
            IsConcentration: GetBool(detail, "is_concentration"),
            IsCorrupted: GetBool(detail, "is_corrupted"),
            Description: GetString(detail, "description"),
            ModularOptions: detail.TryGetProperty("modular_options", out var mo) && mo.ValueKind == JsonValueKind.Array
                ? mo.EnumerateArray().Select(o => new ModularOption(
                    GetString(o, "name"),
                    GetString(o, "description"))).ToList()
                : [],
            Classes: detail.TryGetProperty("classes", out var cls) && cls.ValueKind == JsonValueKind.Array
                ? cls.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => x.Length > 0).ToList()
                : [],
            HigherLevels: GetStringOrNull(detail, "higher_levels"));
    }

    private static SpellRange MapSpellRange(JsonElement detail)
    {
        if (!detail.TryGetProperty("range", out var r) || r.ValueKind != JsonValueKind.Object)
            return new SpellRange(null, null);

        var type = GetStringOrNull(r, "type");

        if (r.TryGetProperty("distance_m", out var dist) && dist.ValueKind == JsonValueKind.Number)
        {
            return new SpellRange(
                JsonSerializer.SerializeToElement(dist.GetDouble(), Options),
                "m");
        }

        // contact / personnelle / etc. → amount pour l'UI
        if (!string.IsNullOrEmpty(type) &&
            (type is "contact" or "personnelle" or "personnel" or "spéciale" or "speciale"))
        {
            return new SpellRange(JsonSerializer.SerializeToElement(type, Options), null);
        }

        // type "normal" sans distance : fallback lisible
        if (!string.IsNullOrEmpty(type))
            return new SpellRange(null, type);

        return new SpellRange(null, null);
    }

    private static SpellDuration MapSpellDuration(JsonElement detail)
    {
        if (!detail.TryGetProperty("duration", out var d) || d.ValueKind != JsonValueKind.Object)
            return new SpellDuration(null, null);

        var type = GetStringOrNull(d, "type");
        var unit = GetStringOrNull(d, "unit");

        if (d.TryGetProperty("value", out var dv) && dv.ValueKind != JsonValueKind.Null)
        {
            var amount = dv.ValueKind == JsonValueKind.Number
                ? JsonSerializer.SerializeToElement(dv.GetInt32(), Options)
                : JsonSerializer.SerializeToElement(dv.GetString(), Options);
            return new SpellDuration(amount, unit ?? type);
        }

        // instantane / jusqu'à dissipation / etc.
        if (!string.IsNullOrEmpty(type))
            return new SpellDuration(JsonSerializer.SerializeToElement(type, Options), null);

        return new SpellDuration(null, unit);
    }
}
