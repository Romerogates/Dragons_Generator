using System.Text.Json;
using DragonsGenerator.API.Models;

namespace DragonsGenerator.API.Common;

public static partial class DataMappers
{
    public static Skill ToSkill(JsonElement detail) => new(
        Id: GetString(detail, "id"),
        Name: GetString(detail, "name"),
        Ability: GetString(detail, "ability"),
        Description: GetString(detail, "description"),
        Examples: MapStringList(detail, "examples"),
        PassiveCheck: GetBool(detail, "passive_check"),
        Source: GetStringOrNull(detail, "source"));

    public static Feat ToFeat(JsonElement detail) => new(
        Id: GetString(detail, "id"),
        Name: GetString(detail, "name"),
        RequiresMagic: GetBool(detail, "requires_magic"),
        Category: GetStringOrNull(detail, "category"),
        Description: GetStringOrNull(detail, "description"),
        Repeatable: GetBool(detail, "repeatable"),
        Tags: MapStringList(detail, "tags"),
        Data: ExtractData(detail, "id", "name"));

    public static CombatAction ToCombatAction(JsonElement detail) => new(
        Id: GetString(detail, "id"),
        Name: GetString(detail, "name"),
        ActionCost: GetString(detail, "action_cost"),
        Category: GetString(detail, "category"),
        Description: GetStringOrNull(detail, "description"),
        Mechanics: detail.TryGetProperty("mechanics", out var m) ? m.Clone() : null,
        Source: GetStringOrNull(detail, "source"));
}
