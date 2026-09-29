using System.Text.Json;
using System.Text.Json.Serialization;
using DragonsGenerator.API.Persistence;

namespace DragonsGenerator.API.Services;

public sealed class UserPreferences
{
    [JsonPropertyName("guideReadNewsIds")]
    public List<string> GuideReadNewsIds { get; set; } = [];

    [JsonPropertyName("guideReadSectionIds")]
    public List<string> GuideReadSectionIds { get; set; } = [];

    [JsonPropertyName("guideAudience")]
    public string? GuideAudience { get; set; }

    /// <summary>Dernier changement de pseudo (cooldown 7 jours).</summary>
    [JsonPropertyName("displayNameChangedAt")]
    public DateTimeOffset? DisplayNameChangedAt { get; set; }

    [JsonPropertyName("hideAllBanners")]
    public bool HideAllBanners { get; set; }

    [JsonPropertyName("dismissedBannerIds")]
    public List<string> DismissedBannerIds { get; set; } = [];

    /// <summary>BYOK : utiliser la clé API de l’utilisateur.</summary>
    [JsonPropertyName("aiEnabled")]
    public bool AiEnabled { get; set; }

    [JsonPropertyName("aiProvider")]
    public string? AiProvider { get; set; }

    [JsonPropertyName("aiModel")]
    public string? AiModel { get; set; }

    /// <summary>Clé API chiffrée (Data Protection) — jamais renvoyée en clair.</summary>
    [JsonPropertyName("aiApiKeyProtected")]
    public string? AiApiKeyProtected { get; set; }

    /// <summary>Dates agenda personnelles (hors campagne) — liées à un héros ou libres.</summary>
    [JsonPropertyName("personalScheduleEvents")]
    public List<PersonalScheduleEvent> PersonalScheduleEvents { get; set; } = [];
}

public sealed class PersonalScheduleEvent
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("title")]
    public string Title { get; set; } = "";

    [JsonPropertyName("startsAt")]
    public string StartsAt { get; set; } = "";

    [JsonPropertyName("endsAt")]
    public string? EndsAt { get; set; }

    [JsonPropertyName("allDay")]
    public bool AllDay { get; set; }

    [JsonPropertyName("kind")]
    public string Kind { get; set; } = "game";

    [JsonPropertyName("location")]
    public string? Location { get; set; }

    [JsonPropertyName("notes")]
    public string? Notes { get; set; }

    [JsonPropertyName("characterId")]
    public string? CharacterId { get; set; }

    [JsonPropertyName("characterName")]
    public string? CharacterName { get; set; }
}

public static class UserPreferencesHelper
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static UserPreferences Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new UserPreferences();
        try
        {
            return JsonSerializer.Deserialize<UserPreferences>(json, JsonOptions) ?? new UserPreferences();
        }
        catch
        {
            return new UserPreferences();
        }
    }

    public static string Serialize(UserPreferences prefs) =>
        JsonSerializer.Serialize(prefs, JsonOptions);

    public static string[] NormalizeGuideIds(IEnumerable<string>? raw, out string? error, int maxCount = 200)
    {
        error = null;
        if (raw is null) return [];

        var seen = new HashSet<string>(StringComparer.Ordinal);
        var list = new List<string>();
        foreach (var item in raw)
        {
            var id = (item ?? "").Trim();
            if (id.Length is 0 or > 64) continue;
            if (!id.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_'))
            {
                error = "Identifiant guide invalide.";
                return [];
            }

            if (seen.Add(id)) list.Add(id);
            if (list.Count > maxCount)
            {
                error = "Trop d'entrées guide enregistrées.";
                return [];
            }
        }

        return list.ToArray();
    }

    public static string[] NormalizeReadNewsIds(IEnumerable<string>? raw, out string? error) =>
        NormalizeGuideIds(raw, out error);

    public static string[] NormalizeReadSectionIds(IEnumerable<string>? raw, out string? error) =>
        NormalizeGuideIds(raw, out error, maxCount: 100);

    public static string? NormalizeGuideAudience(string? raw, out string? error)
    {
        error = null;
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var v = raw.Trim().ToLowerInvariant();
        return v switch
        {
            "all" or "dm" or "player" => v,
            _ => null,
        };
    }

    public static void ApplyGuidePreferences(
        AppUser user,
        IEnumerable<string> newsIds,
        IEnumerable<string> sectionIds,
        string? audience
    )
    {
        var prefs = Parse(user.PreferencesJson);
        prefs.GuideReadNewsIds = newsIds.Distinct(StringComparer.Ordinal).ToList();
        prefs.GuideReadSectionIds = sectionIds.Distinct(StringComparer.Ordinal).ToList();
        prefs.GuideAudience = audience;
        user.PreferencesJson = Serialize(prefs);
    }

    public static string[] GetReadNewsIds(AppUser user) =>
        Parse(user.PreferencesJson).GuideReadNewsIds.ToArray();

    public static string[] GetReadSectionIds(AppUser user) =>
        Parse(user.PreferencesJson).GuideReadSectionIds.ToArray();

    public static string? GetGuideAudience(AppUser user) =>
        NormalizeGuideAudience(Parse(user.PreferencesJson).GuideAudience, out _);

    public static object GetGuidePreferencesExport(AppUser user)
    {
        var prefs = Parse(user.PreferencesJson);
        return new
        {
            readNewsIds = prefs.GuideReadNewsIds,
            readSectionIds = prefs.GuideReadSectionIds,
            audience = NormalizeGuideAudience(prefs.GuideAudience, out _),
        };
    }

    public static bool GetHideAllBanners(AppUser user) => Parse(user.PreferencesJson).HideAllBanners;

    public static string[] GetDismissedBannerIds(AppUser user) =>
        Parse(user.PreferencesJson).DismissedBannerIds.ToArray();

    public static string[] NormalizeDismissedBannerIds(IEnumerable<string>? raw, out string? error, int maxCount = 80)
    {
        error = null;
        if (raw is null) return [];
        var list = new List<string>();
        foreach (var id in raw)
        {
            if (string.IsNullOrWhiteSpace(id)) continue;
            var trimmed = id.Trim();
            if (trimmed.Length > 64)
            {
                error = "Identifiant de bannière trop long.";
                return [];
            }
            if (!list.Contains(trimmed, StringComparer.Ordinal)) list.Add(trimmed);
            if (list.Count > maxCount)
            {
                error = $"Trop de bannières masquées (max {maxCount}).";
                return [];
            }
        }
        return list.ToArray();
    }

    public static void ApplyUiBannerPreferences(AppUser user, bool hideAllBanners, IEnumerable<string> dismissedIds)
    {
        var prefs = Parse(user.PreferencesJson);
        prefs.HideAllBanners = hideAllBanners;
        prefs.DismissedBannerIds = dismissedIds.Distinct(StringComparer.Ordinal).ToList();
        user.PreferencesJson = Serialize(prefs);
    }

    public static object GetUiBannerPreferencesExport(AppUser user)
    {
        var prefs = Parse(user.PreferencesJson);
        return new
        {
            hideAllBanners = prefs.HideAllBanners,
            dismissedBannerIds = prefs.DismissedBannerIds,
        };
    }

    public static object GetAiSettingsExport(AppUser user)
    {
        var prefs = Parse(user.PreferencesJson);
        return new
        {
            enabled = prefs.AiEnabled,
            provider = prefs.AiProvider,
            model = prefs.AiModel,
            hasApiKey = !string.IsNullOrWhiteSpace(prefs.AiApiKeyProtected),
        };
    }

    public static void ApplyAiSettings(
        AppUser user,
        bool enabled,
        string? provider,
        string? model,
        string? apiKeyProtectedOrNullToKeep,
        bool clearApiKey
    )
    {
        var prefs = Parse(user.PreferencesJson);
        prefs.AiEnabled = enabled;
        prefs.AiProvider = provider;
        prefs.AiModel = model;
        if (clearApiKey)
            prefs.AiApiKeyProtected = null;
        else if (apiKeyProtectedOrNullToKeep is not null)
            prefs.AiApiKeyProtected = apiKeyProtectedOrNullToKeep;
        user.PreferencesJson = Serialize(prefs);
    }

    public static void ClearAiSettings(AppUser user)
    {
        var prefs = Parse(user.PreferencesJson);
        prefs.AiEnabled = false;
        prefs.AiProvider = null;
        prefs.AiModel = null;
        prefs.AiApiKeyProtected = null;
        user.PreferencesJson = Serialize(prefs);
    }
}
