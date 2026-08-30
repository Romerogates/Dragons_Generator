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

    public static JsonElement FilterForPlayerView(JsonElement data, Guid playerUserId)
    {
        var node = JsonNode.Parse(data.GetRawText()) as JsonObject ?? new JsonObject();
        node["adventure"] = "";
        node["notes"] = "";
        // PNJ / créatures / rencontres : secrets du MJ à découvrir en jeu
        node["creatures"] = new JsonArray();
        node["encounters"] = new JsonArray();

        if (node["pregenCharacters"] is JsonArray pregens)
        {
            var visiblePregens = new JsonArray();
            foreach (var item in pregens)
            {
                if (item is not JsonObject pregen) continue;
                pregen["dmBackstory"] = "";
                pregen["dmSecrets"] = "";

                var assignedRaw = pregen["assignedUserId"]?.GetValue<string>();
                if (string.IsNullOrWhiteSpace(assignedRaw)
                    || !Guid.TryParse(assignedRaw, out var assignedId)
                    || assignedId != playerUserId)
                {
                    continue;
                }

                visiblePregens.Add(pregen.DeepClone());
            }

            node["pregenCharacters"] = visiblePregens;
        }

        if (node["sessions"] is JsonArray sessions)
        {
            foreach (var item in sessions)
            {
                if (item is not JsonObject session) continue;
                session["notes"] = "";
                session["playNotes"] = "";
            }
        }

        node["activeSessionId"] = null;

        using var doc = JsonDocument.Parse(node.ToJsonString());
        return doc.RootElement.Clone();
    }

    private static readonly HashSet<string> ActivitySpoilerKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "creatureName",
        "customName",
        "backstory",
        "encounterName",
        "adventure",
        "notes",
        "dmBackstory",
        "dmSecrets",
        "creatures",
        "encounters",
        "userId",
        "characterName",
        "publicHook",
    };

    public static bool IsActivityVisibleToPlayer(string kind) =>
        kind != CampaignActivityKinds.InviteSent;

    public static string FilterActivityPayloadForPlayer(string kind, string payloadJson)
    {
        if (kind == CampaignActivityKinds.InviteSent)
            return "{}";

        try
        {
            var node = JsonNode.Parse(string.IsNullOrWhiteSpace(payloadJson) ? "{}" : payloadJson) as JsonObject
                ?? new JsonObject();
            foreach (var key in ActivitySpoilerKeys)
                node.Remove(key);
            return node.ToJsonString();
        }
        catch
        {
            return "{}";
        }
    }

    public static JsonElement StripDmOnlyFieldsFromUpdate(JsonElement incoming, string existingJson, bool isOwner)
    {
        if (isOwner) return incoming;

        var existing = JsonNode.Parse(string.IsNullOrWhiteSpace(existingJson) ? "{}" : existingJson) as JsonObject
            ?? new JsonObject();
        var update = JsonNode.Parse(incoming.GetRawText()) as JsonObject ?? new JsonObject();

        foreach (var prop in update.ToList())
        {
            if (prop.Key is "adventure" or "notes" or "creatures" or "encounters" or "activeSessionId") continue;
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

    public static bool HasSessionChanges(string oldJson, string newJson) =>
        AnalyzeSessionChanges(oldJson, newJson).Changed;

    /// <summary>
    /// Compare les tableaux sessions et résume le changement pour activité + push.
    /// </summary>
    public static SessionChangeInfo AnalyzeSessionChanges(string oldJson, string newJson)
    {
        try
        {
            using var oldDoc = JsonDocument.Parse(string.IsNullOrWhiteSpace(oldJson) ? "{}" : oldJson);
            using var newDoc = JsonDocument.Parse(string.IsNullOrWhiteSpace(newJson) ? "{}" : newJson);
            var oldSessions = ReadSessions(oldDoc.RootElement);
            var newSessions = ReadSessions(newDoc.RootElement);

            if (SessionsEqual(oldSessions, newSessions))
                return SessionChangeInfo.None;

            var isNew = newSessions.Count > oldSessions.Count;
            var focus = FindFocusSession(oldSessions, newSessions);
            var title = focus?.Title ?? "Session";
            var message = isNew
                ? $"Session planifiée : {title}"
                : $"Session mise à jour : {title}";

            return new SessionChangeInfo(
                Changed: true,
                IsNewSession: isNew,
                Title: title,
                ScheduledAt: focus?.ScheduledAt,
                Location: focus?.Location,
                Message: message);
        }
        catch
        {
            return SessionChangeInfo.None;
        }
    }

    private static List<SessionSnapshot> ReadSessions(JsonElement root)
    {
        if (!root.TryGetProperty("sessions", out var arr) || arr.ValueKind != JsonValueKind.Array)
            return [];

        var list = new List<SessionSnapshot>();
        foreach (var item in arr.EnumerateArray())
        {
            list.Add(new SessionSnapshot(
                Id: item.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "",
                Title: item.TryGetProperty("title", out var t) ? t.GetString() ?? "Session" : "Session",
                ScheduledAt: item.TryGetProperty("scheduledAt", out var s) ? s.GetString() : null,
                Location: item.TryGetProperty("location", out var loc) ? loc.GetString() : null,
                Status: item.TryGetProperty("status", out var st) ? st.GetString() : null,
                Notes: item.TryGetProperty("notes", out var n) ? n.GetString() : null,
                Raw: item.GetRawText()));
        }
        return list;
    }

    private static bool SessionsEqual(List<SessionSnapshot> a, List<SessionSnapshot> b)
    {
        if (a.Count != b.Count) return false;
        for (var i = 0; i < a.Count; i++)
        {
            if (a[i].Raw != b[i].Raw) return false;
        }
        return true;
    }

    private static SessionSnapshot? FindFocusSession(List<SessionSnapshot> oldSessions, List<SessionSnapshot> newSessions)
    {
        var oldById = oldSessions.Where(s => !string.IsNullOrEmpty(s.Id)).ToDictionary(s => s.Id);
        foreach (var s in newSessions)
        {
            if (string.IsNullOrEmpty(s.Id) || !oldById.TryGetValue(s.Id, out var prev))
                return s;
            if (prev.Raw != s.Raw)
                return s;
        }
        return newSessions.LastOrDefault() ?? oldSessions.LastOrDefault();
    }

    private sealed record SessionSnapshot(
        string Id,
        string Title,
        string? ScheduledAt,
        string? Location,
        string? Status,
        string? Notes,
        string Raw);
}

public sealed record SessionChangeInfo(
    bool Changed,
    bool IsNewSession,
    string? Title,
    string? ScheduledAt,
    string? Location,
    string Message)
{
    public static SessionChangeInfo None { get; } = new(false, false, null, null, null, "");
}
