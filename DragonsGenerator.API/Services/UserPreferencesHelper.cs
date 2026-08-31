using System.Text.Json;
using System.Text.Json.Serialization;
using DragonsGenerator.API.Persistence;

namespace DragonsGenerator.API.Services;

public sealed class UserPreferences
{
    [JsonPropertyName("guideReadNewsIds")]
    public List<string> GuideReadNewsIds { get; set; } = [];
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

    public static void ApplyReadNewsIds(AppUser user, IEnumerable<string> ids)
    {
        var prefs = Parse(user.PreferencesJson);
        prefs.GuideReadNewsIds = ids.Distinct(StringComparer.Ordinal).ToList();
        user.PreferencesJson = Serialize(prefs);
    }

    public static string[] GetReadNewsIds(AppUser user) =>
        Parse(user.PreferencesJson).GuideReadNewsIds.ToArray();
}
