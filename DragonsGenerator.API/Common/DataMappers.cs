using System.Text.Json;
using DragonsGenerator.API.Models;

namespace DragonsGenerator.API.Common;

public static class DataMappers
{
    private static JsonSerializerOptions Options => IndexedDataStore.JsonOptions;

    // -------------------------------------------------------------------------
    // Entités enveloppées { id, name, data }
    // -------------------------------------------------------------------------

    public static CharacterClass ToCharacterClass(JsonElement detail) =>
        new(GetString(detail, "id"), GetString(detail, "name"), ExtractData(detail, "id", "name"));

    public static Background ToBackground(JsonElement detail) =>
        new(GetString(detail, "id"), GetString(detail, "name"), ExtractData(detail, "id", "name"));

    public static Handicap ToHandicap(JsonElement detail) =>
        new(GetString(detail, "id"), GetString(detail, "name"), ExtractData(detail, "id", "name"));

    // -------------------------------------------------------------------------
    // Équipements
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // Sorts
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // Créatures
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // Civilisations
    // -------------------------------------------------------------------------

    public static Civilisation ToCivilisation(JsonElement detail)
    {
        var randomization = detail.TryGetProperty("randomization", out var rand)
            ? new Randomization(
                rand.TryGetProperty("min", out var mn) ? mn.GetInt32() : 0,
                rand.TryGetProperty("max", out var mx) ? mx.GetInt32() : 0)
            : new Randomization(0, 0);

        var demographics = detail.TryGetProperty("demographics", out var demo)
            ? new Demographics(
                PrimarySpecies: MapRefList(demo, "primary_species"),
                SecondarySpecies: MapRefList(demo, "secondary_species"),
                IsCosmopolitan: demo.TryGetProperty("is_cosmopolitan", out var ic) && ic.GetBoolean(),
                CosmopolitanZones: MapStringList(demo, "cosmopolitan_zones"),
                SocialRoles: MapRoleRefList(demo, "social_roles"),
                HostilePopulations: MapRefListOrNull(demo, "hostile_populations"),
                HordeAllies: MapRefListOrNull(demo, "horde_allies"),
                HistoricalRulers: MapRefListOrNull(demo, "historical_rulers"),
                UnderwaterPopulations: MapRefListOrNull(demo, "underwater_populations"))
            : new Demographics([], [], false, [], []);

        var linguistics = new Linguistics(
            OfficialLanguages: detail.TryGetProperty("official_languages", out var langs)
                ? MapLanguageRefListFromElement(langs)
                : [],
            AdditionalLanguagesSpoken: detail.TryGetProperty("multilingual", out var ml) && ml.GetBoolean(),
            WritingSystems: detail.TryGetProperty("writing_systems", out var ws)
                ? MapWritingRefList(ws)
                : [],
            AdditionalWritingSystemsUsed: detail.TryGetProperty("additional_writing_systems", out var aws) && aws.ValueKind == JsonValueKind.True
                ? aws.GetBoolean()
                : null);

        var lore = new Lore(
            FullDescription: GetStringOrNull(detail, "description") ?? "",
            ThreatIds: MapStringList(detail, "threat_ids"),
            GeographyTags: MapStringList(detail, "geography_tags"),
            NotableFeatures: detail.TryGetProperty("notable_features", out var nf) && nf.ValueKind == JsonValueKind.Array
                ? MapStringListFromElement(nf)
                : null);

        return new Civilisation(
            Id: GetString(detail, "id"),
            Name: GetString(detail, "name"),
            Randomization: randomization,
            Demographics: demographics,
            Linguistics: linguistics,
            Lore: lore);
    }

    // -------------------------------------------------------------------------
    // Langues
    // -------------------------------------------------------------------------

    public static Language ToLanguage(JsonElement detail)
    {
        var linguistics = new LanguageLinguistics(
            WritingSystems: detail.TryGetProperty("writing_systems", out var ws) && ws.ValueKind == JsonValueKind.Array
                ? ws.EnumerateArray().Select(w => new LanguageWritingSystem(
                    GetString(w, "id"),
                    GetString(w, "label"),
                    GetString(w, "type"))).ToList()
                : [],
            IsOralOnly: GetBool(detail, "is_oral_only"),
            WritingNotes: GetStringOrNull(detail, "writing_notes"));

        var speakers = new LanguageSpeakers(
            Primary: detail.TryGetProperty("typical_speakers", out var ts) && ts.ValueKind == JsonValueKind.Array
                ? ts.EnumerateArray().Select((s, i) => new SpeakerRef($"speaker-{i}", s.GetString() ?? "")).ToList()
                : [],
            Regions: MapStringList(detail, "regions"),
            IsExtinct: detail.TryGetProperty("is_extinct", out var ext) ? ext.GetBoolean() : null);

        var lore = new LanguageLore(
            FullDescription: GetStringOrNull(detail, "description") ?? "",
            Sonority: GetStringOrNull(detail, "sonority"));

        return new Language(
            Id: GetString(detail, "id"),
            Name: GetString(detail, "name"),
            Category: GetString(detail, "category"),
            Linguistics: linguistics,
            Speakers: speakers,
            Lore: lore);
    }

    // -------------------------------------------------------------------------
    // Espèces
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // Nouvelles entités (schema 2.0)
    // -------------------------------------------------------------------------

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

    public static Deity ToDeity(JsonElement detail) => new(
        Id: GetString(detail, "id"),
        Name: GetString(detail, "name"),
        Tonality: GetStringOrNull(detail, "tonality"),
        Domains: MapStringList(detail, "domains"),
        Description: GetStringOrNull(detail, "description"),
        OtherNames: MapStringList(detail, "other_names"),
        WorshippersNote: GetStringOrNull(detail, "worshippers_note"),
        GrantsPowersTo: MapStringList(detail, "grants_powers_to"),
        Source: GetStringOrNull(detail, "source"));

    public static CombatAction ToCombatAction(JsonElement detail) => new(
        Id: GetString(detail, "id"),
        Name: GetString(detail, "name"),
        ActionCost: GetString(detail, "action_cost"),
        Category: GetString(detail, "category"),
        Description: GetStringOrNull(detail, "description"),
        Mechanics: detail.TryGetProperty("mechanics", out var m) ? m.Clone() : null,
        Source: GetStringOrNull(detail, "source"));

    public static WritingSystem ToWritingSystem(JsonElement detail)
    {
        SignsCountRange? signsRange = null;
        if (detail.TryGetProperty("signs_count_range", out var scr) && scr.ValueKind == JsonValueKind.Object)
        {
            signsRange = new SignsCountRange(
                scr.TryGetProperty("min", out var mn) ? mn.GetInt32() : 0,
                scr.TryGetProperty("max", out var mx) ? mx.GetInt32() : 0);
        }

        ReadingDifficulty? readingDifficulty = null;
        if (detail.TryGetProperty("reading_difficulty", out var rd) && rd.ValueKind == JsonValueKind.Object)
        {
            readingDifficulty = new ReadingDifficulty(
                GetStringOrNull(rd, "rare_words_check"),
                GetStringOrNull(rd, "obscure_passages_check"),
                GetStringOrNull(rd, "decipher_note"));
        }

        return new WritingSystem(
            Id: GetString(detail, "id"),
            Name: GetString(detail, "name"),
            Type: GetString(detail, "type"),
            UsedByLanguages: detail.TryGetProperty("used_by_languages", out var ubl) && ubl.ValueKind == JsonValueKind.Array
                ? ubl.EnumerateArray().Select(l => new LanguageReference(
                    GetString(l, "id"), GetString(l, "label"))).ToList()
                : [],
            Description: GetString(detail, "description"),
            SpecialFeatures: MapStringList(detail, "special_features"),
            SignsCountRange: signsRange,
            ReadingDifficulty: readingDifficulty);
    }

    public static int ParseHitDie(string hitDie)
    {
        if (string.IsNullOrWhiteSpace(hitDie))
            return 0;

        var parts = hitDie.Split('d', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return parts.Length == 2 && int.TryParse(parts[1], out var value) ? value : 0;
    }

    // -------------------------------------------------------------------------
    // Helpers privés
    // -------------------------------------------------------------------------

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
