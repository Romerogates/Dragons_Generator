using System.Text.Json;
using DragonsGenerator.API.Models;

namespace DragonsGenerator.API.Common;

public static partial class DataMappers
{
    public static Creature ToCreature(JsonElement detail)
    {
        var abilities = new Dictionary<string, CreatureAbility>();
        if (detail.TryGetProperty("abilities", out var ab) && ab.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in ab.EnumerateObject())
            {
                if (prop.Value.ValueKind != JsonValueKind.Object)
                    continue;

                abilities[prop.Name] = new CreatureAbility(
                    prop.Value.TryGetProperty("score", out var s) && s.TryGetInt32(out var score) ? score : 0,
                    GetStringOrNull(prop.Value, "modifier") ?? "+0");
            }
        }

        return new Creature(
            Id: GetString(detail, "id"),
            Name: GetString(detail, "name"),
            Category: GetString(detail, "category"),
            Part: GetStringOrNull(detail, "part"),
            Section: GetStringOrNull(detail, "section"),
            Type: GetStringOrNull(detail, "type") ?? "",
            ArmorClass: GetInt(detail, "armor_class"),
            ArmorNote: GetStringOrNull(detail, "armor_note"),
            HitPoints: GetStringOrNull(detail, "hit_points") ?? "",
            WoundThreshold: GetNullableInt(detail, "wound_threshold"),
            Speed: GetStringOrNull(detail, "speed") ?? "",
            Abilities: abilities,
            SavingThrows: GetStringOrNull(detail, "saving_throws"),
            Skills: GetStringOrNull(detail, "skills"),
            Senses: GetStringOrNull(detail, "senses"),
            Languages: GetStringOrNull(detail, "languages"),
            ChallengeRating: GetStringOrNull(detail, "challenge_rating") ?? "0",
            Xp: GetInt(detail, "xp"),
            Traits: MapNamedEntries(detail, "traits"),
            Actions: MapNamedEntries(detail, "actions"),
            Reactions: MapNamedEntries(detail, "reactions"),
            LegendaryActions: MapNamedEntries(detail, "legendary_actions"),
            Description: GetStringOrNull(detail, "description") ?? "");
    }

    private static List<CreatureNamedEntry> MapNamedEntries(JsonElement detail, string prop) =>
        detail.TryGetProperty(prop, out var arr) && arr.ValueKind == JsonValueKind.Array
            ? arr.EnumerateArray().Select(o => new CreatureNamedEntry(
                GetString(o, "name"),
                GetString(o, "description"))).ToList()
            : [];
}
