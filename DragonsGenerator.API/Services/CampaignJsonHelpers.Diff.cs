using System.Text.Json;
using System.Text.Json.Nodes;

namespace DragonsGenerator.API.Services;

public static partial class CampaignJsonHelpers
{
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

    /// <summary>Détecte l'ouverture de la collecte d'initiative (false → true sur la session active).</summary>
    public static InitiativeCollectionChangeInfo AnalyzeInitiativeCollectionOpened(string oldJson, string newJson)
    {
        try
        {
            if (ReadActiveCombatInitiativeState(oldJson).Open)
                return InitiativeCollectionChangeInfo.None;

            var state = ReadActiveCombatInitiativeState(newJson);
            if (!state.Open || string.IsNullOrWhiteSpace(state.Code))
                return InitiativeCollectionChangeInfo.None;

            var labelPart = string.IsNullOrWhiteSpace(state.Label) ? "" : $" — {state.Label}";
            return new InitiativeCollectionChangeInfo(
                Changed: true,
                Code: state.Code,
                Label: state.Label,
                Message: $"Collecte d'initiative ouverte{labelPart}");
        }
        catch
        {
            return InitiativeCollectionChangeInfo.None;
        }
    }

    /// <summary>
    /// Détecte la fin d’un combat : activeCombat passé à null + nouvelle entrée combatHistory.
    /// </summary>
    public static CombatEndedChangeInfo AnalyzeCombatEnded(string oldJson, string newJson)
    {
        try
        {
            using var oldDoc = JsonDocument.Parse(string.IsNullOrWhiteSpace(oldJson) ? "{}" : oldJson);
            using var newDoc = JsonDocument.Parse(string.IsNullOrWhiteSpace(newJson) ? "{}" : newJson);
            var oldSessions = IndexSessionCombatSnapshots(oldDoc.RootElement);
            var newSessions = IndexSessionCombatSnapshots(newDoc.RootElement);

            foreach (var (sessionId, neu) in newSessions)
            {
                if (!oldSessions.TryGetValue(sessionId, out var old))
                    continue;
                if (!old.HadActiveCombat || neu.HadActiveCombat)
                    continue;
                if (neu.HistoryCount <= old.HistoryCount)
                    continue;

                var label = string.IsNullOrWhiteSpace(neu.LastHistoryLabel)
                    ? "Combat"
                    : neu.LastHistoryLabel!;
                var roundPart = neu.LastHistoryRound is int r && r > 0 ? $" · tour {r}" : "";
                return new CombatEndedChangeInfo(
                    Changed: true,
                    SessionId: sessionId,
                    HistoryId: neu.LastHistoryId,
                    Label: label,
                    Round: neu.LastHistoryRound,
                    Message: $"Combat terminé — {label}{roundPart}");
            }

            return CombatEndedChangeInfo.None;
        }
        catch
        {
            return CombatEndedChangeInfo.None;
        }
    }

    private static Dictionary<string, SessionCombatSnapshot> IndexSessionCombatSnapshots(JsonElement root)
    {
        var map = new Dictionary<string, SessionCombatSnapshot>(StringComparer.Ordinal);
        if (!root.TryGetProperty("sessions", out var sessions) || sessions.ValueKind != JsonValueKind.Array)
            return map;
        foreach (var session in sessions.EnumerateArray())
        {
            var sid = session.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
            if (string.IsNullOrWhiteSpace(sid)) continue;
            var hadCombat = session.TryGetProperty("activeCombat", out var combat)
                && combat.ValueKind == JsonValueKind.Object;
            var historyCount = 0;
            string? lastId = null;
            string? lastLabel = null;
            int? lastRound = null;
            if (session.TryGetProperty("combatHistory", out var hist) && hist.ValueKind == JsonValueKind.Array)
            {
                historyCount = hist.GetArrayLength();
                if (historyCount > 0)
                {
                    var last = hist[historyCount - 1];
                    lastId = last.TryGetProperty("id", out var hid) ? hid.GetString() : null;
                    lastLabel = last.TryGetProperty("label", out var lab) ? lab.GetString() : null;
                    if (last.TryGetProperty("round", out var rnd) && rnd.TryGetInt32(out var rv))
                        lastRound = rv;
                }
            }
            map[sid!] = new SessionCombatSnapshot(hadCombat, historyCount, lastId, lastLabel, lastRound);
        }
        return map;
    }

    private sealed record SessionCombatSnapshot(
        bool HadActiveCombat,
        int HistoryCount,
        string? LastHistoryId,
        string? LastHistoryLabel,
        int? LastHistoryRound);

    private static ActiveCombatInitiativeState ReadActiveCombatInitiativeState(string json)
    {
        using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json);
        var root = doc.RootElement;
        if (!root.TryGetProperty("activeSessionId", out var activeIdEl))
            return new ActiveCombatInitiativeState(false, null, null);
        var activeSessionId = activeIdEl.GetString();
        if (string.IsNullOrWhiteSpace(activeSessionId))
            return new ActiveCombatInitiativeState(false, null, null);
        if (!root.TryGetProperty("sessions", out var sessions) || sessions.ValueKind != JsonValueKind.Array)
            return new ActiveCombatInitiativeState(false, null, null);

        foreach (var session in sessions.EnumerateArray())
        {
            var sid = session.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
            if (!string.Equals(sid, activeSessionId, StringComparison.Ordinal))
                continue;
            if (!session.TryGetProperty("activeCombat", out var combat) || combat.ValueKind != JsonValueKind.Object)
                return new ActiveCombatInitiativeState(false, null, null);
            if (!combat.TryGetProperty("collectingInitiative", out var collecting) || collecting.ValueKind != JsonValueKind.True)
                return new ActiveCombatInitiativeState(false, null, null);
            var code = combat.TryGetProperty("initiativeCode", out var codeEl) ? codeEl.GetString() : null;
            var label = combat.TryGetProperty("label", out var labelEl) ? labelEl.GetString() : null;
            return new ActiveCombatInitiativeState(true, code, label);
        }

        return new ActiveCombatInitiativeState(false, null, null);
    }

    private sealed record ActiveCombatInitiativeState(bool Open, string? Code, string? Label);

    private static string SessionSchedulingKey(SessionSnapshot s) =>
        $"{s.Id}|{s.Title}|{s.ScheduledAt}|{s.Location}|{s.Status}|{s.Notes}";

    private static bool SessionsEqual(List<SessionSnapshot> a, List<SessionSnapshot> b)
    {
        if (a.Count != b.Count) return false;
        for (var i = 0; i < a.Count; i++)
        {
            if (SessionSchedulingKey(a[i]) != SessionSchedulingKey(b[i])) return false;
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
            if (SessionSchedulingKey(prev) != SessionSchedulingKey(s))
                return s;
        }
        return newSessions.LastOrDefault() ?? oldSessions.LastOrDefault();
    }

    /// <summary>
    /// Conserve les jets d'initiative joueur et les PV/journal plus avancés (dégâts joueur)
    /// quand un PUT MJ réécrit le blob combat.
    /// </summary>
    public static string MergeLiveCombatIntoIncoming(string incomingJson, string storedJson)
    {
        try
        {
            var incoming = JsonNode.Parse(string.IsNullOrWhiteSpace(incomingJson) ? "{}" : incomingJson) as JsonObject
                ?? new JsonObject();
            var stored = JsonNode.Parse(string.IsNullOrWhiteSpace(storedJson) ? "{}" : storedJson) as JsonObject
                ?? new JsonObject();
            if (incoming["sessions"] is not JsonArray inSessions || stored["sessions"] is not JsonArray stSessions)
                return incoming.ToJsonString();

            var storedById = new Dictionary<string, JsonObject>(StringComparer.Ordinal);
            foreach (var item in stSessions)
            {
                if (item is not JsonObject session) continue;
                var id = session["id"]?.GetValue<string>();
                if (!string.IsNullOrWhiteSpace(id)) storedById[id] = session;
            }

            foreach (var item in inSessions)
            {
                if (item is not JsonObject session) continue;
                var id = session["id"]?.GetValue<string>();
                if (string.IsNullOrWhiteSpace(id) || !storedById.TryGetValue(id, out var storedSession))
                    continue;
                MergeCombatantRolls(
                    session["activeCombat"] as JsonObject,
                    storedSession["activeCombat"] as JsonObject);
                MergeCombatantHp(
                    session["activeCombat"] as JsonObject,
                    storedSession["activeCombat"] as JsonObject);
                MergeCombatLog(session, storedSession);
                MergeTableChat(session, storedSession);
            }

            return incoming.ToJsonString();
        }
        catch
        {
            return incomingJson;
        }
    }

    private static void MergeCombatantRolls(JsonObject? incomingCombat, JsonObject? storedCombat)
    {
        if (incomingCombat is null || storedCombat is null) return;
        if (incomingCombat["combatants"] is not JsonArray inList || storedCombat["combatants"] is not JsonArray stList)
            return;

        var storedById = new Dictionary<string, JsonObject>(StringComparer.Ordinal);
        foreach (var item in stList)
        {
            if (item is not JsonObject cb) continue;
            var id = cb["id"]?.GetValue<string>();
            if (!string.IsNullOrWhiteSpace(id)) storedById[id] = cb;
        }

        foreach (var item in inList)
        {
            if (item is not JsonObject incoming) continue;
            var id = incoming["id"]?.GetValue<string>();
            if (string.IsNullOrWhiteSpace(id) || !storedById.TryGetValue(id, out var stored))
                continue;
            var storedSubmitted = stored["playerSubmitted"]?.GetValue<bool>() == true;
            var incomingSubmitted = incoming["playerSubmitted"]?.GetValue<bool>() == true;
            if (!storedSubmitted || incomingSubmitted) continue;
            incoming["playerSubmitted"] = true;
            if (stored["initiativeRoll"] is JsonNode roll)
                incoming["initiativeRoll"] = roll.DeepClone();
        }
    }

    /// <summary>Si le stocké a moins de PV (dégâts joueur), on les conserve face à un PUT MJ stale.</summary>
    private static void MergeCombatantHp(JsonObject? incomingCombat, JsonObject? storedCombat)
    {
        if (incomingCombat is null || storedCombat is null) return;
        if (incomingCombat["combatants"] is not JsonArray inList || storedCombat["combatants"] is not JsonArray stList)
            return;

        var storedById = new Dictionary<string, JsonObject>(StringComparer.Ordinal);
        foreach (var item in stList)
        {
            if (item is not JsonObject cb) continue;
            var id = cb["id"]?.GetValue<string>();
            if (!string.IsNullOrWhiteSpace(id)) storedById[id] = cb;
        }

        foreach (var item in inList)
        {
            if (item is not JsonObject incoming) continue;
            var id = incoming["id"]?.GetValue<string>();
            if (string.IsNullOrWhiteSpace(id) || !storedById.TryGetValue(id, out var stored))
                continue;

            var inHp = ReadNullableInt(incoming, "currentHp");
            var stHp = ReadNullableInt(stored, "currentHp");
            if (stHp is null) continue;
            if (inHp is null || stHp.Value < inHp.Value)
            {
                incoming["currentHp"] = stHp.Value;
                if (stored["defeated"] is JsonNode def)
                    incoming["defeated"] = def.DeepClone();
                else if (stHp.Value <= 0)
                    incoming["defeated"] = true;
            }
        }
    }

    private static void MergeCombatLog(JsonObject incomingSession, JsonObject storedSession)
    {
        var inLog = incomingSession["combatLog"] as JsonArray;
        var stLog = storedSession["combatLog"] as JsonArray;
        if (stLog is null || stLog.Count == 0) return;
        if (inLog is null || stLog.Count > inLog.Count)
            incomingSession["combatLog"] = stLog.DeepClone();
    }

    private static void MergeTableChat(JsonObject incomingSession, JsonObject storedSession)
    {
        var inChat = incomingSession["tableChat"] as JsonArray;
        var stChat = storedSession["tableChat"] as JsonArray;
        if (stChat is null || stChat.Count == 0) return;
        if (inChat is null || stChat.Count > inChat.Count)
            incomingSession["tableChat"] = stChat.DeepClone();
    }

    /// <summary>Ajoute un message au fil de table de la session (cap 100).</summary>
    public static string? TryAppendTableChat(
        string json,
        string sessionId,
        string authorUserId,
        string authorName,
        string body,
        out string? error)
    {
        error = null;
        var trimmed = (body ?? "").Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            error = "Message vide.";
            return null;
        }
        if (trimmed.Length > 500)
        {
            error = "Message trop long (500 caractères max).";
            return null;
        }

        try
        {
            var root = JsonNode.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json) as JsonObject
                ?? new JsonObject();
            if (root["sessions"] is not JsonArray sessions)
            {
                error = "Aucune session.";
                return null;
            }

            JsonObject? target = null;
            foreach (var item in sessions)
            {
                if (item is not JsonObject session) continue;
                if (session["id"]?.GetValue<string>() == sessionId)
                {
                    target = session;
                    break;
                }
            }

            if (target is null)
            {
                error = "Session introuvable.";
                return null;
            }

            var chat = target["tableChat"] as JsonArray ?? new JsonArray();
            chat.Add(new JsonObject
            {
                ["id"] = Guid.NewGuid().ToString("N"),
                ["at"] = DateTimeOffset.UtcNow.ToString("O"),
                ["authorUserId"] = authorUserId,
                ["authorName"] = string.IsNullOrWhiteSpace(authorName) ? "Joueur" : authorName.Trim(),
                ["body"] = trimmed,
            });
            while (chat.Count > 100)
                chat.RemoveAt(0);
            target["tableChat"] = chat;
            return root.ToJsonString();
        }
        catch
        {
            error = "JSON campagne invalide.";
            return null;
        }
    }

    private static int? ReadNullableInt(JsonObject obj, string prop)
    {
        if (obj[prop] is not JsonNode node) return null;
        return node.AsValue().TryGetValue<int>(out var v) ? v : null;
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
