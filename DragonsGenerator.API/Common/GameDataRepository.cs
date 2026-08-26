using System.Text.Json;
using DragonsGenerator.API.Models;

namespace DragonsGenerator.API.Common;

/// <summary>
/// Point d'accès unique aux données de jeu, basé sur index + fichiers détaillés.
/// </summary>
public sealed class GameDataRepository
{
    private readonly IndexedDataStore _store;

    public GameDataRepository(IndexedDataStore store) => _store = store;

    // =========================================================================
    // CATALOGUES — chemins index / propriété des entrées
    // =========================================================================

    private const string ClassesIndex = "index/classes.json";
    private const string SpeciesIndex = "index/species.json";
    private const string BackgroundsIndex = "index/backgrounds.json";
    private const string CivilisationsIndex = "index/civilisations.json";
    private const string EquipmentsIndex = "index/equipments.json";
    private const string SpellsIndex = "index/spells.json";
    private const string LanguagesIndex = "index/languages.json";
    private const string HandicapsIndex = "index/handicaps.json";
    private const string SkillsIndex = "index/skills.json";
    private const string FeatsIndex = "index/feats.json";
    private const string DeitiesIndex = "index/deities.json";
    private const string CombatActionsIndex = "index/combat-actions.json";

    // =========================================================================
    // CLASSES
    // =========================================================================

    public async Task<List<CharacterClass>> GetClassesAsync(CancellationToken ct = default)
    {
        var details = await _store.LoadAllDetailsFromIndexAsync(ClassesIndex, "classes", ct);
        return details.Select(DataMappers.ToCharacterClass).ToList();
    }

    public async Task<CharacterClass?> GetClassByIdAsync(string id, CancellationToken ct = default)
    {
        var detail = await _store.LoadDetailByIdFromIndexAsync(ClassesIndex, "classes", id, ct);
        return detail is null ? null : DataMappers.ToCharacterClass(detail.Value);
    }

    public async Task<List<ClassSummaryDto>> GetClassesSummaryAsync(CancellationToken ct = default)
    {
        var entries = await _store.GetIndexEntriesAsync(ClassesIndex, "classes", ct);
        return entries.Select(e => new ClassSummaryDto(
            Id: GetEntryString(e, "id"),
            Name: GetEntryString(e, "name"),
            HitDie: DataMappers.ParseHitDie(GetEntryString(e, "hit_die")),
            PrimaryAbilities: e.TryGetProperty("primary_abilities", out var pa) && pa.ValueKind == JsonValueKind.Array
                ? pa.EnumerateArray().Select(x => x.GetString() ?? "").ToList()
                : [],
            HasSpellcasting: e.TryGetProperty("spellcasting_ability", out var sc) &&
                sc.ValueKind != JsonValueKind.Null &&
                !string.IsNullOrWhiteSpace(sc.GetString())
        )).ToList();
    }

    // =========================================================================
    // ESPÈCES
    // =========================================================================

    public async Task<List<Species>> GetSpeciesAsync(CancellationToken ct = default)
    {
        var details = await _store.LoadAllDetailsFromIndexAsync(SpeciesIndex, "species", ct);
        return details.Select(DataMappers.ToSpecies).ToList();
    }

    public async Task<Species?> GetSpeciesByIdAsync(string id, CancellationToken ct = default)
    {
        var detail = await _store.LoadDetailByIdFromIndexAsync(SpeciesIndex, "species", id, ct);
        return detail is null ? null : DataMappers.ToSpecies(detail.Value);
    }

    public Task<SpeciesCodesDto> GetSpeciesCodesAsync(CancellationToken ct = default)
    {
        _ = ct;
        return Task.FromResult(SpeciesCodesDto.Default);
    }

    public async Task<List<SpeciesSummaryDto>> GetSpeciesSummaryAsync(CancellationToken ct = default)
    {
        var entries = await _store.GetIndexEntriesAsync(SpeciesIndex, "species", ct);
        return entries.Select(e =>
        {
            var speedM = 0.0;
            if (e.TryGetProperty("speed_m", out var sm))
                speedM = sm.GetDouble();

            var subspeciesCount = 0;
            if (e.TryGetProperty("subspecies_count", out var sc))
                subspeciesCount = sc.GetInt32();
            else if (e.TryGetProperty("subspecies_ids", out var ids) && ids.ValueKind == JsonValueKind.Array)
                subspeciesCount = ids.GetArrayLength();

            return new SpeciesSummaryDto(
                Id: GetEntryString(e, "id"),
                Name: GetEntryString(e, "name"),
                Size: GetEntryString(e, "size"),
                SpeedM: speedM,
                DarkvisionM: e.TryGetProperty("darkvision_m", out var dv) ? dv.GetDouble() : 0,
                PlayableSubspeciesCount: subspeciesCount);
        }).ToList();
    }

    // =========================================================================
    // HISTORIQUES
    // =========================================================================

    public async Task<List<Background>> GetBackgroundsAsync(CancellationToken ct = default)
    {
        var details = await _store.LoadAllDetailsFromIndexAsync(BackgroundsIndex, "backgrounds", ct);
        return details.Select(DataMappers.ToBackground).ToList();
    }

    public async Task<Background?> GetBackgroundByIdAsync(string id, CancellationToken ct = default)
    {
        var detail = await _store.LoadDetailByIdFromIndexAsync(BackgroundsIndex, "backgrounds", id, ct);
        return detail is null ? null : DataMappers.ToBackground(detail.Value);
    }

    public async Task<List<BackgroundSummaryDto>> GetBackgroundsSummaryAsync(CancellationToken ct = default)
    {
        var details = await _store.LoadAllDetailsFromIndexAsync(BackgroundsIndex, "backgrounds", ct);
        return details.Select(d =>
        {
            var summary = "";
            if (d.TryGetProperty("flavor", out var flavor) &&
                flavor.TryGetProperty("summary", out var s))
            {
                summary = s.GetString() ?? "";
            }

            return new BackgroundSummaryDto(
                Id: GetEntryString(d, "id"),
                Name: GetEntryString(d, "name"),
                Preset: d.TryGetProperty("preset", out var p) && p.GetBoolean(),
                Summary: summary);
        }).ToList();
    }

    // =========================================================================
    // CIVILISATIONS
    // =========================================================================

    public async Task<List<Civilisation>> GetCivilisationsAsync(CancellationToken ct = default)
    {
        var details = await _store.LoadAllDetailsFromIndexAsync(CivilisationsIndex, "civilisations", ct);
        return details.Select(DataMappers.ToCivilisation).ToList();
    }

    public async Task<Civilisation?> GetCivilisationByIdAsync(string id, CancellationToken ct = default)
    {
        var detail = await _store.LoadDetailByIdFromIndexAsync(CivilisationsIndex, "civilisations", id, ct);
        return detail is null ? null : DataMappers.ToCivilisation(detail.Value);
    }

    public async Task<Civilisation?> GetRandomCivilisationAsync(CancellationToken ct = default)
    {
        var all = await GetCivilisationsAsync(ct);
        if (all.Count == 0) return null;
        return all[Random.Shared.Next(all.Count)];
    }

    public async Task<List<CivilisationSummaryDto>> GetCivilisationsSummaryAsync(CancellationToken ct = default)
    {
        var entries = await _store.GetIndexEntriesAsync(CivilisationsIndex, "civilisations", ct);
        var summaries = new List<CivilisationSummaryDto>();

        foreach (var entry in entries)
        {
            var detail = await _store.LoadDetailFromEntryAsync(entry, ct);
            if (detail is null) continue;

            var mapped = DataMappers.ToCivilisation(detail.Value);
            summaries.Add(new CivilisationSummaryDto(
                Id: mapped.Id,
                Name: mapped.Name,
                DiceMin: mapped.Randomization.DiceMin,
                DiceMax: mapped.Randomization.DiceMax,
                IsCosmopolitan: mapped.Demographics.IsCosmopolitan,
                PrimarySpecies: mapped.Demographics.PrimarySpecies.Select(s => s.Label).ToList()));
        }

        return summaries;
    }

    // =========================================================================
    // ÉQUIPEMENTS
    // =========================================================================

    public async Task<List<Equipment>> GetEquipmentsAsync(CancellationToken ct = default)
    {
        var details = await _store.LoadAllDetailsFromIndexAsync(EquipmentsIndex, "items", ct);
        return details.Select(DataMappers.ToEquipment).ToList();
    }

    public async Task<Equipment?> GetEquipmentByIdAsync(string id, CancellationToken ct = default)
    {
        var detail = await _store.LoadDetailByIdFromIndexAsync(EquipmentsIndex, "items", id, ct);
        return detail is null ? null : DataMappers.ToEquipment(detail.Value);
    }

    public async Task<List<EquipmentSummaryDto>> GetEquipmentsSummaryAsync(CancellationToken ct = default)
    {
        var entries = await _store.GetIndexEntriesAsync(EquipmentsIndex, "items", ct);
        return entries.Select(e =>
        {
            var cost = e.TryGetProperty("cost", out var c)
                ? new Cost(
                    DataMappers.GetNullableInt(c, "value"),
                    c.TryGetProperty("unit", out var u) && u.ValueKind != System.Text.Json.JsonValueKind.Null
                        ? u.GetString() ?? "po"
                        : "po")
                : new Cost(null, "po");

            return new EquipmentSummaryDto(
                Id: GetEntryString(e, "id"),
                Name: GetEntryString(e, "name"),
                Type: GetEntryString(e, "category"),
                Subtype: e.TryGetProperty("subcategory", out var sub) ? sub.GetString() : null,
                Cost: cost,
                WKg: e.TryGetProperty("weight_kg", out var w) && w.TryGetDouble(out var wd) ? wd : null);
        }).ToList();
    }

    // =========================================================================
    // SORTS
    // =========================================================================

    public async Task<List<Spell>> GetSpellsAsync(CancellationToken ct = default)
    {
        var details = await _store.LoadAllDetailsFromIndexAsync(SpellsIndex, "spells", ct);
        return details.Select(DataMappers.ToSpell).ToList();
    }

    public async Task<Spell?> GetSpellByIdAsync(string id, CancellationToken ct = default)
    {
        var detail = await _store.LoadDetailByIdFromIndexAsync(SpellsIndex, "spells", id, ct);
        return detail is null ? null : DataMappers.ToSpell(detail.Value);
    }

    public async Task<List<SpellSummaryDto>> GetSpellsSummaryAsync(CancellationToken ct = default)
    {
        var entries = await _store.GetIndexEntriesAsync(SpellsIndex, "spells", ct);
        return entries.Select(e => new SpellSummaryDto(
            Id: GetEntryString(e, "id"),
            Name: GetEntryString(e, "name"),
            Level: e.TryGetProperty("level", out var l) ? l.GetInt32() : 0,
            School: GetEntryString(e, "school"),
            IsRitual: e.TryGetProperty("is_ritual", out var ir) && ir.GetBoolean(),
            IsConcentration: e.TryGetProperty("is_concentration", out var ic) && ic.GetBoolean(),
            IsCorrupted: e.TryGetProperty("is_corrupted", out var icr) && icr.GetBoolean()
        )).ToList();
    }

    // =========================================================================
    // LANGUES
    // =========================================================================

    public async Task<List<Language>> GetLanguagesAsync(CancellationToken ct = default)
    {
        var details = await _store.LoadAllDetailsFromIndexAsync(LanguagesIndex, "languages", ct);
        return details.Select(DataMappers.ToLanguage).ToList();
    }

    public async Task<Language?> GetLanguageByIdAsync(string id, CancellationToken ct = default)
    {
        var detail = await _store.LoadDetailByIdFromIndexAsync(LanguagesIndex, "languages", id, ct);
        return detail is null ? null : DataMappers.ToLanguage(detail.Value);
    }

    public async Task<List<LanguageSummaryDto>> GetLanguagesSummaryAsync(CancellationToken ct = default)
    {
        var entries = await _store.GetIndexEntriesAsync(LanguagesIndex, "languages", ct);
        var summaries = new List<LanguageSummaryDto>();

        foreach (var entry in entries)
        {
            var detail = await _store.LoadDetailFromEntryAsync(entry, ct);
            var writingCount = 0;
            var isOralOnly = false;

            if (detail is not null)
            {
                if (detail.Value.TryGetProperty("writing_systems", out var ws) && ws.ValueKind == JsonValueKind.Array)
                    writingCount = ws.GetArrayLength();
                if (detail.Value.TryGetProperty("is_oral_only", out var io))
                    isOralOnly = io.GetBoolean();
            }

            summaries.Add(new LanguageSummaryDto(
                Id: GetEntryString(entry, "id"),
                Name: GetEntryString(entry, "name"),
                Category: GetEntryString(entry, "category"),
                IsOralOnly: isOralOnly,
                WritingSystemsCount: writingCount));
        }

        return summaries;
    }

    // =========================================================================
    // HANDICAPS
    // =========================================================================

    public async Task<List<Handicap>> GetHandicapsAsync(CancellationToken ct = default)
    {
        var details = await _store.LoadAllDetailsFromIndexAsync(HandicapsIndex, "handicaps", ct);
        return details.Select(DataMappers.ToHandicap).ToList();
    }

    public async Task<Handicap?> GetHandicapByIdAsync(string id, CancellationToken ct = default)
    {
        var detail = await _store.LoadDetailByIdFromIndexAsync(HandicapsIndex, "handicaps", id, ct);
        return detail is null ? null : DataMappers.ToHandicap(detail.Value);
    }

    public async Task<JsonElement> GetHandicapRulesAsync(CancellationToken ct = default) =>
        await _store.LoadFileAsync("index/handicap-rules.json", ct);

    // =========================================================================
    // SYSTÈMES D'ÉCRITURE
    // =========================================================================

    public async Task<List<WritingSystem>> GetWritingSystemsAsync(CancellationToken ct = default)
    {
        var root = await _store.LoadFileAsync("properties/writing-systems.json", ct);
        if (root.ValueKind != JsonValueKind.Array)
            return [];

        return root.EnumerateArray().Select(DataMappers.ToWritingSystem).ToList();
    }

    public async Task<WritingSystem?> GetWritingSystemByIdAsync(string id, CancellationToken ct = default)
    {
        var all = await GetWritingSystemsAsync(ct);
        return all.FirstOrDefault(w => string.Equals(w.Id, id, StringComparison.OrdinalIgnoreCase));
    }

    // =========================================================================
    // COMPÉTENCES, DONs, DIVINITÉS, ACTIONS DE COMBAT
    // =========================================================================

    public async Task<List<Skill>> GetSkillsAsync(CancellationToken ct = default)
    {
        var details = await _store.LoadAllDetailsFromIndexAsync(SkillsIndex, "entries", ct);
        return details.Select(DataMappers.ToSkill).ToList();
    }

    public async Task<Skill?> GetSkillByIdAsync(string id, CancellationToken ct = default)
    {
        var detail = await _store.LoadDetailByIdFromIndexAsync(SkillsIndex, "entries", id, ct);
        if (detail is null)
        {
            // Alias skill-* ↔ ski-* (classes/backgrounds vs index skills)
            var altId = id.StartsWith("skill-", StringComparison.OrdinalIgnoreCase)
                ? "ski-" + id["skill-".Length..]
                : id.StartsWith("ski-", StringComparison.OrdinalIgnoreCase)
                    ? "skill-" + id["ski-".Length..]
                    : null;
            if (altId is not null)
                detail = await _store.LoadDetailByIdFromIndexAsync(SkillsIndex, "entries", altId, ct);
        }
        return detail is null ? null : DataMappers.ToSkill(detail.Value);
    }

    public async Task<List<Feat>> GetFeatsAsync(CancellationToken ct = default)
    {
        var details = await _store.LoadAllDetailsFromIndexAsync(FeatsIndex, "feats", ct);
        return details.Select(DataMappers.ToFeat).ToList();
    }

    public async Task<Feat?> GetFeatByIdAsync(string id, CancellationToken ct = default)
    {
        var detail = await _store.LoadDetailByIdFromIndexAsync(FeatsIndex, "feats", id, ct);
        return detail is null ? null : DataMappers.ToFeat(detail.Value);
    }

    public async Task<List<Deity>> GetDeitiesAsync(CancellationToken ct = default)
    {
        var details = await _store.LoadAllDetailsFromIndexAsync(DeitiesIndex, "deities", ct);
        return details.Select(DataMappers.ToDeity).ToList();
    }

    public async Task<Deity?> GetDeityByIdAsync(string id, CancellationToken ct = default)
    {
        var detail = await _store.LoadDetailByIdFromIndexAsync(DeitiesIndex, "deities", id, ct);
        return detail is null ? null : DataMappers.ToDeity(detail.Value);
    }

    public async Task<List<CombatAction>> GetCombatActionsAsync(CancellationToken ct = default)
    {
        var details = await _store.LoadAllDetailsFromIndexAsync(CombatActionsIndex, "actions", ct);
        return details.Select(DataMappers.ToCombatAction).ToList();
    }

    public async Task<CombatAction?> GetCombatActionByIdAsync(string id, CancellationToken ct = default)
    {
        var detail = await _store.LoadDetailByIdFromIndexAsync(CombatActionsIndex, "actions", id, ct);
        return detail is null ? null : DataMappers.ToCombatAction(detail.Value);
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private static string GetEntryString(JsonElement entry, string prop) =>
        entry.TryGetProperty(prop, out var v) ? v.GetString() ?? "" : "";
}

// DTOs partagés entre repository et endpoints
public record ClassSummaryDto(string Id, string Name, int HitDie, List<string> PrimaryAbilities, bool HasSpellcasting);
public record SpeciesSummaryDto(string Id, string Name, string Size, double SpeedM, double DarkvisionM, int PlayableSubspeciesCount);
public record SpeciesCodesDto(Dictionary<string, string> SizeCodes, Dictionary<string, string> AbilityCodes)
{
    public static SpeciesCodesDto Default { get; } = new(
        new Dictionary<string, string>
        {
            ["P"] = "Petite",
            ["M"] = "Moyenne",
            ["G"] = "Grande",
            ["TG"] = "Très grande"
        },
        new Dictionary<string, string>
        {
            ["str"] = "Force",
            ["dex"] = "Dextérité",
            ["con"] = "Constitution",
            ["int"] = "Intelligence",
            ["wis"] = "Sagesse",
            ["cha"] = "Charisme"
        });
}
public record BackgroundSummaryDto(string Id, string Name, bool Preset, string Summary);
public record CivilisationSummaryDto(string Id, string Name, int DiceMin, int DiceMax, bool IsCosmopolitan, List<string> PrimarySpecies);
public record EquipmentSummaryDto(string Id, string Name, string Type, string? Subtype, Cost Cost, double? WKg);
public record SpellSummaryDto(string Id, string Name, int Level, string School, bool IsRitual, bool IsConcentration, bool IsCorrupted);
public record LanguageSummaryDto(string Id, string Name, string Category, bool IsOralOnly, int WritingSystemsCount);
