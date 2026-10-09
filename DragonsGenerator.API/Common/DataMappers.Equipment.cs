using System.Text.Json;
using DragonsGenerator.API.Models;

namespace DragonsGenerator.API.Common;

public static partial class DataMappers
{
    public static Equipment ToEquipment(JsonElement detail)
    {
        var cost = detail.TryGetProperty("cost", out var costEl)
            ? new Cost(GetNullableInt(costEl, "value"), GetStringOrNull(costEl, "unit") ?? "po")
            : new Cost(null, "po");

        double? weight = detail.TryGetProperty("weight_kg", out var w)
            && w.ValueKind == JsonValueKind.Number
            && w.TryGetDouble(out var wd)
                ? wd
                : null;

        return new Equipment(
            Id: GetString(detail, "id"),
            Name: GetString(detail, "name"),
            Type: GetStringOrNull(detail, "category") ?? GetStringOrNull(detail, "type") ?? "unknown",
            Cost: cost,
            Data: ExtractData(detail, "id", "name", "category", "type", "cost", "weight_kg", "subcategory"),
            Subtype: GetStringOrNull(detail, "subcategory"),
            WKg: weight);
    }
}
