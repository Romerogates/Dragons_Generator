using System.Text.Json;
using DragonsGenerator.API.Models;

namespace DragonsGenerator.API.Common;

public static partial class DataMappers
{
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
}
