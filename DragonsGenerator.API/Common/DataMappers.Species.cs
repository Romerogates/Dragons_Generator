using System.Text.Json;
using DragonsGenerator.API.Models;

namespace DragonsGenerator.API.Common;

public static partial class DataMappers
{
    public static Species ToSpecies(JsonElement detail)
    {
        var flavorEl = detail.TryGetProperty("flavor", out var f) ? f : default;
        var flavor = new Flavor(
            Summary: GetStringOrNull(flavorEl, "summary") ?? "",
            Culture: GetStringOrNull(flavorEl, "culture"),
            Origins: GetStringOrNull(flavorEl, "origins"),
            LoreNotes: flavorEl.ValueKind != JsonValueKind.Undefined && flavorEl.TryGetProperty("lore_notes", out var ln) && ln.ValueKind == JsonValueKind.Array
                ? MapStringListFromElement(ln)
                : null);

        var baseStatsEl = detail.TryGetProperty("base_stats", out var bs) ? bs : default;
        var speedM = 0.0;
        if (baseStatsEl.TryGetProperty("speed", out var speed))
        {
            if (speed.TryGetProperty("base_m", out var bm))
                speedM = bm.GetDouble();
            else if (speed.TryGetProperty("speed_m", out var sm))
                speedM = sm.GetDouble();
        }
        else if (baseStatsEl.TryGetProperty("speed_m", out var directSpeed))
        {
            speedM = directSpeed.GetDouble();
        }

        var ageEl = baseStatsEl.TryGetProperty("age", out var age) ? age : default;
        var alignmentEl = baseStatsEl.TryGetProperty("alignment", out var align) ? align : default;

        var baseStats = new BaseStats(
            AbilityScoreIncrease: baseStatsEl.TryGetProperty("ability_score_increase", out var asi) && asi.ValueKind == JsonValueKind.Object
                ? asi.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.GetInt32())
                : [],
            SpeedM: speedM,
            Size: GetStringOrNull(baseStatsEl, "size") ?? "M",
            DarkvisionM: baseStatsEl.TryGetProperty("darkvision_m", out var dv) ? dv.GetDouble() : 0,
            Height: MapHeight(baseStatsEl),
            Weight: MapWeight(baseStatsEl),
            Age: new Age(
                MaturityYears: ageEl.TryGetProperty("maturity_years", out var my) ? my.GetInt32() : 0,
                LifespanYears: ageEl.TryGetProperty("lifespan_years", out var ly) ? ly.GetInt32() : 0,
                Desc: GetStringOrNull(ageEl, "flavor") ?? GetStringOrNull(ageEl, "desc") ?? "",
                AdulthoodCulturalYears: ageEl.TryGetProperty("adulthood_cultural_years", out var acy) ? acy.GetInt32() : null,
                LifespanMaxYears: ageEl.TryGetProperty("lifespan_max_years", out var lmy) ? lmy.GetInt32() : null),
            Alignment: new Alignment(
                GetStringOrNull(alignmentEl, "tendency") ?? "",
                GetStringOrNull(alignmentEl, "flavor") ?? GetStringOrNull(alignmentEl, "desc") ?? ""),
            FlexibleAsi: null,
            SpeedNotes: GetStringOrNull(baseStatsEl, "speed_notes"),
            SpeedNotReducedByHeavyArmor: baseStatsEl.TryGetProperty("speed", out var sp) &&
                sp.TryGetProperty("not_reduced_by_heavy_armor", out var nrh) && nrh.GetBoolean());

        var traits = detail.TryGetProperty("traits", out var traitsEl) && traitsEl.ValueKind == JsonValueKind.Array
            ? traitsEl.EnumerateArray().Select(MapTrait).ToList()
            : [];

        var creationChoices = detail.TryGetProperty("creation_choices", out var cc) && cc.ValueKind == JsonValueKind.Array
            ? cc.EnumerateArray().Select(MapCreationChoice).ToList()
            : [];

        var languagesEl = detail.TryGetProperty("languages", out var langEl) ? langEl : default;
        var choiceCount = 0;
        if (languagesEl.TryGetProperty("choices", out var choices) && choices.ValueKind == JsonValueKind.Array)
        {
            choiceCount = choices.EnumerateArray()
                .Sum(c => c.TryGetProperty("quantity", out var q) ? q.GetInt32() : 1);
        }
        else if (languagesEl.TryGetProperty("choice_count", out var cc2))
        {
            choiceCount = cc2.GetInt32();
        }

        var languages = new Languages(
            Fixed: MapStringList(languagesEl, "fixed"),
            ChoiceCount: choiceCount,
            Notes: GetStringOrNull(languagesEl, "notes"),
            GrantsFromChoice: languagesEl.TryGetProperty("grants_from_choice", out var gfc) ? gfc.Clone() : null);

        var subspecies = detail.TryGetProperty("subspecies", out var subEl) && subEl.ValueKind == JsonValueKind.Array
            ? subEl.EnumerateArray().Select(MapSubspecies).ToList()
            : [];

        var optionalRules = detail.TryGetProperty("optional_rules", out var orEl) && orEl.ValueKind == JsonValueKind.Array
            ? orEl.EnumerateArray().Select(MapOptionalRule).ToList()
            : [];

        var civLinks = detail.TryGetProperty("civilization_links", out var clEl) && clEl.ValueKind == JsonValueKind.Array
            ? clEl.EnumerateArray().Select(c => new CivilizationLink(
                GetString(c, "id"), GetString(c, "name"), GetString(c, "desc"))).ToList()
            : null;

        return new Species(
            Id: GetString(detail, "id"),
            Name: GetString(detail, "name"),
            NameAlt: MapStringList(detail, "name_alt"),
            Source: detail.TryGetProperty("source", out var src)
                ? new Models.Source(GetString(src, "book"), GetString(src, "pages"))
                : new Models.Source("", ""),
            Flavor: flavor,
            BaseStats: baseStats,
            Traits: traits,
            CreationChoices: creationChoices,
            Languages: languages,
            Subspecies: subspecies,
            OptionalRules: optionalRules,
            CivilizationLinks: civLinks);
    }

    private static Trait MapTrait(JsonElement t) => new(
        GetString(t, "id"),
        GetString(t, "name"),
        t.TryGetProperty("flavor", out var fl) ? GetStringOrNull(fl, "desc") ?? "" : GetString(t, "desc"),
        t.TryGetProperty("mechanics", out var mech) ? mech.Clone() : null);

    private static CreationChoice MapCreationChoice(JsonElement c) => new(
        Id: GetString(c, "id"),
        Name: GetString(c, "name"),
        Desc: c.TryGetProperty("flavor", out var fl) ? GetStringOrNull(fl, "desc") ?? "" : GetString(c, "desc"),
        Type: GetString(c, "type"),
        ChoiceCount: c.TryGetProperty("quantity", out var q) ? q.GetInt32()
            : c.TryGetProperty("choice_count", out var cc) ? cc.GetInt32() : null,
        Options: c.TryGetProperty("pool", out var pool) ? pool.Clone()
            : c.TryGetProperty("options", out var opts) ? opts.Clone() : null,
        OptionGroups: c.TryGetProperty("option_groups", out var og) ? og.Clone() : null,
        SpellList: GetStringOrNull(c, "spell_list"),
        SpellLevel: c.TryGetProperty("spell_level", out var sl) ? sl.GetInt32() : null,
        SpellcastingAbility: GetStringOrNull(c, "spellcasting_ability"),
        ValuePerChoice: c.TryGetProperty("value_per_choice", out var vpc) ? vpc.GetInt32()
            : c.TryGetProperty("value_per_pick", out var vpp) ? vpp.GetInt32() : null,
        Excluded: c.TryGetProperty("excluded", out var ex) && ex.ValueKind == JsonValueKind.Array
            ? MapStringListFromElement(ex) : null);

    private static Subspecies MapSubspecies(JsonElement s)
    {
        Languages? languages = null;
        if (s.TryGetProperty("languages", out var langEl) && langEl.ValueKind == JsonValueKind.Object)
        {
            var choiceCount = 0;
            if (langEl.TryGetProperty("choices", out var choices) && choices.ValueKind == JsonValueKind.Array)
                choiceCount = choices.EnumerateArray().Sum(c => c.TryGetProperty("quantity", out var q) ? q.GetInt32() : 1);
            else if (langEl.TryGetProperty("choice_count", out var choiceCountEl))
                choiceCount = choiceCountEl.GetInt32();

            languages = new Languages(
                MapStringList(langEl, "fixed"),
                choiceCount,
                GetStringOrNull(langEl, "notes"));
        }

        return new Subspecies(
            Id: GetString(s, "id"),
            Name: GetString(s, "name"),
            Playable: GetBool(s, "playable"),
            Flavor: s.TryGetProperty("flavor", out var fl)
                ? GetStringOrNull(fl, "desc") ?? (fl.ValueKind == JsonValueKind.String ? fl.GetString() ?? "" : "")
                : GetString(s, "desc"),
            AbilityScoreIncrease: s.TryGetProperty("ability_score_increase", out var asi) && asi.ValueKind == JsonValueKind.Object
                ? asi.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.GetInt32())
                : [],
            Traits: s.TryGetProperty("traits", out var traits) && traits.ValueKind == JsonValueKind.Array
                ? traits.EnumerateArray().Select(MapTrait).ToList()
                : [],
            CreationChoices: s.TryGetProperty("creation_choices", out var creationChoicesEl) && creationChoicesEl.ValueKind == JsonValueKind.Array
                ? creationChoicesEl.EnumerateArray().Select(MapCreationChoice).ToList()
                : [],
            PlayableNotes: GetStringOrNull(s, "playable_notes"),
            Languages: languages);
    }

    private static OptionalRule MapOptionalRule(JsonElement r) => new(
        GetString(r, "id"),
        GetString(r, "name"),
        GetString(r, "desc"),
        r.TryGetProperty("mechanics", out var m) ? m.Clone() : null);

    private static Height MapHeight(JsonElement baseStatsEl)
    {
        if (baseStatsEl.TryGetProperty("height", out var h) && h.ValueKind == JsonValueKind.Object)
        {
            return new Height(
                GetStringOrNull(h, "desc") ?? GetStringOrNull(h, "flavor") ?? "",
                GetStringOrNull(h, "range_m") ?? GetStringOrNull(h, "rangeM"));
        }

        if (baseStatsEl.TryGetProperty("height", out var hs) && hs.ValueKind == JsonValueKind.String)
            return new Height(hs.GetString() ?? "", null);

        return new Height(GetStringOrNull(baseStatsEl, "height_desc") ?? "", null);
    }

    private static Weight MapWeight(JsonElement baseStatsEl)
    {
        if (baseStatsEl.TryGetProperty("weight", out var w) && w.ValueKind == JsonValueKind.Object)
        {
            return new Weight(
                GetStringOrNull(w, "desc") ?? GetStringOrNull(w, "flavor") ?? "",
                GetStringOrNull(w, "range_kg") ?? GetStringOrNull(w, "rangeKg"));
        }

        if (baseStatsEl.TryGetProperty("weight", out var ws) && ws.ValueKind == JsonValueKind.String)
            return new Weight(ws.GetString() ?? "", null);

        return new Weight(GetStringOrNull(baseStatsEl, "weight_desc") ?? "", null);
    }
}
