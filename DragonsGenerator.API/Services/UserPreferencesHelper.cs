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
}
