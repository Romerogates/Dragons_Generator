using System.Text.Json;
using System.Text.Json.Serialization;
using DragonsGenerator.API.Persistence;

namespace DragonsGenerator.API.Services;

public sealed class UserPreferences
{
    [JsonPropertyName("guideReadNewsIds")]
    public List<string> GuideReadNewsIds { get; set; } = [];

    [JsonPropertyName("guideAudience")]
    public string? GuideAudience { get; set; }
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

    public static string[] NormalizeReadNewsIds(IEnumerable<string>? raw, out string? error)
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
                error = "Identifiant de nouveauté invalide.";
                return [];
            }

            if (seen.Add(id)) list.Add(id);
            if (list.Count > 200)
            {
                error = "Trop de nouveautés lues enregistrées.";
                return [];
            }
        }

        return list.ToArray();
    }

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

    public static void ApplyGuidePreferences(AppUser user, IEnumerable<string> ids, string? audience)
    {
        var prefs = Parse(user.PreferencesJson);
        prefs.GuideReadNewsIds = ids.Distinct(StringComparer.Ordinal).ToList();
        prefs.GuideAudience = audience;
        user.PreferencesJson = Serialize(prefs);
    }

    public static string[] GetReadNewsIds(AppUser user) =>
        Parse(user.PreferencesJson).GuideReadNewsIds.ToArray();

    public static string? GetGuideAudience(AppUser user) =>
        NormalizeGuideAudience(Parse(user.PreferencesJson).GuideAudience, out _);

    public static object GetGuidePreferencesExport(AppUser user)
    {
        var prefs = Parse(user.PreferencesJson);
        return new
        {
            readNewsIds = prefs.GuideReadNewsIds,
            audience = NormalizeGuideAudience(prefs.GuideAudience, out _),
        };
    }
}
