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
                session["activeCombat"] = null;
                session["combatHistory"] = new JsonArray();
            }
        }

        node["activeSessionId"] = null;

        if (node["handouts"] is JsonArray handouts)
        {
            var visibleHandouts = new JsonArray();
            foreach (var item in handouts)
            {
                if (item is not JsonObject handout) continue;
                if (handout["published"]?.GetValue<bool>() != true) continue;
                visibleHandouts.Add(handout.DeepClone());
            }

            node["handouts"] = visibleHandouts;
        }

        node["dungeonMaps"] = new JsonArray();

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
            if (prop.Key is "adventure" or "notes" or "creatures" or "encounters" or "activeSessionId" or "handouts" or "dungeonMaps") continue;
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

    /// <summary>Sessions planifiées futures (rappels push).</summary>
    public static IReadOnlyList<PlannedSessionInfo> ListUpcomingPlannedSessions(string json, DateTimeOffset now)
    {
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json);
            if (!doc.RootElement.TryGetProperty("sessions", out var sessions) || sessions.ValueKind != JsonValueKind.Array)
                return [];

            var list = new List<PlannedSessionInfo>();
            foreach (var session in sessions.EnumerateArray())
            {
                if (!session.TryGetProperty("status", out var st) || st.GetString() != "planned")
                    continue;
                if (!session.TryGetProperty("scheduledAt", out var at))
                    continue;
                if (!DateTimeOffset.TryParse(at.GetString(), out var when) || when <= now)
                    continue;

                var id = session.TryGetProperty("id", out var idEl) ? idEl.GetString() ?? "" : "";
                if (string.IsNullOrEmpty(id)) continue;
                var title = session.TryGetProperty("title", out var t) ? t.GetString() ?? "Session" : "Session";
                var location = session.TryGetProperty("location", out var loc) ? loc.GetString() : null;
                list.Add(new PlannedSessionInfo(id, title, when, location));
            }

            return list;
        }
        catch
        {
            return [];
        }
    }

    public static bool HasSessionChanges(string oldJson, string newJson) =>
        AnalyzeSessionChanges(oldJson, newJson).Changed;

    public static HandoutChangeInfo AnalyzeHandoutChanges(string oldJson, string newJson)
    {
        try
        {
            using var oldDoc = JsonDocument.Parse(string.IsNullOrWhiteSpace(oldJson) ? "{}" : oldJson);
            using var newDoc = JsonDocument.Parse(string.IsNullOrWhiteSpace(newJson) ? "{}" : newJson);
            var oldPublished = ReadPublishedHandoutIds(oldDoc.RootElement);
            var newHandouts = ReadHandouts(newDoc.RootElement);

            var newlyPublished = newHandouts
                .Where(h => h.Published && !oldPublished.Contains(h.Id))
                .ToList();

            if (newlyPublished.Count == 0)
                return HandoutChangeInfo.None;

            var first = newlyPublished[0];
            var message = newlyPublished.Count == 1
                ? $"Document publié : {first.Title}"
                : $"{newlyPublished.Count} documents publiés";

            return new HandoutChangeInfo(true, first.Title, first.Id, newlyPublished.Count, message);
        }
        catch
        {
            return HandoutChangeInfo.None;
        }
    }

    private static HashSet<string> ReadPublishedHandoutIds(JsonElement root)
    {
        var set = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in ReadHandouts(root))
        {
            if (item.Published && !string.IsNullOrEmpty(item.Id))
                set.Add(item.Id);
        }
        return set;
    }

    private static List<HandoutSnapshot> ReadHandouts(JsonElement root)
    {
        if (!root.TryGetProperty("handouts", out var arr) || arr.ValueKind != JsonValueKind.Array)
            return [];

        var list = new List<HandoutSnapshot>();
        foreach (var item in arr.EnumerateArray())
        {
            var published = item.TryGetProperty("published", out var pub) && pub.ValueKind == JsonValueKind.True;
            list.Add(new HandoutSnapshot(
                Id: item.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "",
                Title: item.TryGetProperty("title", out var t) ? t.GetString() ?? "Document" : "Document",
                Published: published));
        }
        return list;
    }

    private sealed record HandoutSnapshot(string Id, string Title, bool Published);

    /// <summary>
    /// Lit l'état de collecte d'initiative (session active) pour les joueurs.
    /// </summary>
    public static InitiativeBoardInfo? TryReadInitiativeBoard(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json);
            var root = doc.RootElement;
            if (!root.TryGetProperty("activeSessionId", out var activeIdEl))
                return null;
            var activeSessionId = activeIdEl.GetString();
            if (string.IsNullOrWhiteSpace(activeSessionId))
                return null;
            if (!root.TryGetProperty("sessions", out var sessions) || sessions.ValueKind != JsonValueKind.Array)
                return null;

            foreach (var session in sessions.EnumerateArray())
            {
                var sid = session.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
                if (!string.Equals(sid, activeSessionId, StringComparison.Ordinal))
                    continue;
                if (!session.TryGetProperty("activeCombat", out var combat) || combat.ValueKind != JsonValueKind.Object)
                    return null;
                if (!combat.TryGetProperty("collectingInitiative", out var collecting) || collecting.ValueKind != JsonValueKind.True)
                    return null;

                var code = combat.TryGetProperty("initiativeCode", out var codeEl) ? codeEl.GetString() ?? "" : "";
                var label = combat.TryGetProperty("label", out var labelEl) ? labelEl.GetString() : null;
                var combatants = new List<InitiativeCombatantInfo>();
                if (combat.TryGetProperty("combatants", out var arr) && arr.ValueKind == JsonValueKind.Array)
                {
                    foreach (var cb in arr.EnumerateArray())
                    {
                        var kind = cb.TryGetProperty("kind", out var k) ? k.GetString() : null;
                        if (kind is not ("player" or "npc"))
                            continue;
                        combatants.Add(new InitiativeCombatantInfo(
                            Id: cb.TryGetProperty("id", out var cid) ? cid.GetString() ?? "" : "",
                            Name: cb.TryGetProperty("name", out var n) ? n.GetString() ?? "Sans nom" : "Sans nom",
                            Kind: kind,
                            InitiativeBonus: cb.TryGetProperty("initiativeBonus", out var b) && b.TryGetInt32(out var bi) ? bi : 0,
                            HasRoll: cb.TryGetProperty("initiativeRoll", out var roll) && roll.ValueKind == JsonValueKind.Number,
                            MemberUserId: cb.TryGetProperty("memberUserId", out var m) ? m.GetString() : null));
                    }
                }

                return new InitiativeBoardInfo(true, code, label, combatants);
            }

            return null;
        }
        catch
        {
            return null;
        }
    }

    public static InitiativeBoardInfo FilterInitiativeBoardForViewer(
        InitiativeBoardInfo board,
        Guid userId,
        bool isOwner)
    {
        if (isOwner) return board;
        var mine = board.Combatants
            .Where(c => Guid.TryParse(c.MemberUserId, out var linked) && linked == userId)
            .ToList();
        return board with { Combatants = mine };
    }

    /// <summary>
    /// Applique un jet d'initiative joueur dans le JSON campagne. Retourne le nouveau JSON ou null si échec.
    /// </summary>
    public static string? TryApplyInitiativeRoll(
        string json,
        string code,
        string combatantId,
        int roll,
        Guid? preferredUserId,
        out string? error)
    {
        error = null;
        if (roll is < 1 or > 30)
        {
            error = "Le jet doit être entre 1 et 30.";
            return null;
        }

        try
        {
            var node = JsonNode.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json) as JsonObject ?? new JsonObject();
            var activeSessionId = node["activeSessionId"]?.GetValue<string>();
            if (string.IsNullOrWhiteSpace(activeSessionId))
            {
                error = "Aucune session de jeu en cours.";
                return null;
            }

            if (node["sessions"] is not JsonArray sessions)
            {
                error = "Session introuvable.";
                return null;
            }

            JsonObject? combat = null;
            foreach (var item in sessions)
            {
                if (item is not JsonObject session) continue;
                if (session["id"]?.GetValue<string>() != activeSessionId) continue;
                combat = session["activeCombat"] as JsonObject;
                break;
            }

            if (combat is null)
            {
                error = "Aucun combat actif.";
                return null;
            }

            if (combat["collectingInitiative"]?.GetValue<bool>() != true)
            {
                error = "La collecte d'initiative est fermée.";
                return null;
            }

            var expectedCode = combat["initiativeCode"]?.GetValue<string>() ?? "";
            if (!string.Equals(expectedCode, code.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                error = "Code invalide.";
                return null;
            }

            if (combat["combatants"] is not JsonArray combatants)
            {
                error = "Combattant introuvable.";
                return null;
            }

            JsonObject? target = null;
            foreach (var item in combatants)
            {
                if (item is not JsonObject cb) continue;
                if (cb["id"]?.GetValue<string>() != combatantId) continue;
                var kind = cb["kind"]?.GetValue<string>();
                if (kind is not ("player" or "npc"))
                {
                    error = "Ce combattant n'accepte pas de jet joueur.";
                    return null;
                }
                target = cb;
                break;
            }

            if (target is null)
            {
                error = "Combattant introuvable.";
                return null;
            }

            if (target["playerSubmitted"]?.GetValue<bool>() == true)
            {
                error = "Initiative déjà enregistrée pour ce personnage.";
                return null;
            }

            if (preferredUserId is not null)
            {
                var linked = target["memberUserId"]?.GetValue<string>();
                if (string.IsNullOrWhiteSpace(linked)
                    || !Guid.TryParse(linked, out var linkedId)
                    || linkedId != preferredUserId.Value)
                {
                    error = "Ce personnage n'est pas lié à votre compte.";
                    return null;
                }
            }
            else if (target["memberUserId"] is not null
                     && !string.IsNullOrWhiteSpace(target["memberUserId"]?.GetValue<string>()))
            {
                error = "Connexion requise pour enregistrer l'initiative.";
                return null;
            }

            target["initiativeRoll"] = roll;
            target["playerSubmitted"] = true;
            return node.ToJsonString();
        }
        catch
        {
            error = "Données de campagne invalides.";
            return null;
        }
    }

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
    /// Conserve les jets d'initiative déjà saisis (joueur) quand un PUT MJ réécrit le blob combat.
    /// Les PV / conditions du JSON entrant (MJ) restent autoritaires.
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

public sealed record HandoutChangeInfo(
    bool Changed,
    string? Title,
    string? HandoutId,
    int Count,
    string Message)
{
    public static HandoutChangeInfo None { get; } = new(false, null, null, 0, "");
}

public sealed record InitiativeCollectionChangeInfo(
    bool Changed,
    string? Code,
    string? Label,
    string Message)
{
    public static InitiativeCollectionChangeInfo None { get; } = new(false, null, null, "");
}

public sealed record InitiativeBoardInfo(
    bool Open,
    string Code,
    string? Label,
    IReadOnlyList<InitiativeCombatantInfo> Combatants);

public sealed record InitiativeCombatantInfo(
    string Id,
    string Name,
    string Kind,
    int InitiativeBonus,
    bool HasRoll,
    string? MemberUserId);

public sealed record PlannedSessionInfo(
    string Id,
    string Title,
    DateTimeOffset ScheduledAt,
    string? Location);
