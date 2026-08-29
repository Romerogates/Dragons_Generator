using System.Text.Json;
using System.Text.Json.Nodes;

namespace DragonsGenerator.API.Services;

public static class CampaignJsonHelpers
{
    public static string? RegionNameFromJson(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json);
            if (doc.RootElement.TryGetProperty("regionName", out var rn))
            {
                var name = rn.GetString();
                return string.IsNullOrWhiteSpace(name) ? null : name;
            }
        }
        catch { /* ignore malformed JSON */ }

        return null;
    }

    public static JsonElement FilterForPlayerView(JsonElement data)
    {
        var node = JsonNode.Parse(data.GetRawText()) as JsonObject ?? new JsonObject();
        node["adventure"] = "";
        node["notes"] = "";

        if (node["pregenCharacters"] is JsonArray pregens)
        {
            foreach (var item in pregens)
            {
                if (item is not JsonObject pregen) continue;
                pregen["dmBackstory"] = "";
                pregen["dmSecrets"] = "";
            }
        }

        using var doc = JsonDocument.Parse(node.ToJsonString());
        return doc.RootElement.Clone();
    }

    public static JsonElement StripDmOnlyFieldsFromUpdate(JsonElement incoming, string existingJson, bool isOwner)
    {
        if (isOwner) return incoming;

        var existing = JsonNode.Parse(string.IsNullOrWhiteSpace(existingJson) ? "{}" : existingJson) as JsonObject
            ?? new JsonObject();
        var update = JsonNode.Parse(incoming.GetRawText()) as JsonObject ?? new JsonObject();

        foreach (var prop in update.ToList())
        {
            if (prop.Key is "adventure" or "notes") continue;
            existing[prop.Key] = prop.Value?.DeepClone();
        }

        using var doc = JsonDocument.Parse(existing.ToJsonString());
        return doc.RootElement.Clone();
    }

    public static DateTimeOffset? NextSessionFromJson(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json);
            if (!doc.RootElement.TryGetProperty("sessions", out var sessions) || sessions.ValueKind != JsonValueKind.Array)
                return null;

            DateTimeOffset? next = null;
            foreach (var session in sessions.EnumerateArray())
            {
                if (!session.TryGetProperty("status", out var st) || st.GetString() != "planned")
                    continue;
                if (!session.TryGetProperty("scheduledAt", out var at))
                    continue;
                if (!DateTimeOffset.TryParse(at.GetString(), out var when))
                    continue;
                if (when < DateTimeOffset.UtcNow)
                    continue;
                if (next is null || when < next)
                    next = when;
            }

            return next;
        }
        catch
        {
            return null;
        }
    }

    public static bool HasSessionChanges(string oldJson, string newJson)
    {
        try
        {
            using var oldDoc = JsonDocument.Parse(string.IsNullOrWhiteSpace(oldJson) ? "{}" : oldJson);
            using var newDoc = JsonDocument.Parse(string.IsNullOrWhiteSpace(newJson) ? "{}" : newJson);
            var oldSessions = oldDoc.RootElement.TryGetProperty("sessions", out var os) ? os.GetRawText() : "[]";
            var newSessions = newDoc.RootElement.TryGetProperty("sessions", out var ns) ? ns.GetRawText() : "[]";
            return oldSessions != newSessions;
        }
        catch
        {
            return false;
        }
    }
}
