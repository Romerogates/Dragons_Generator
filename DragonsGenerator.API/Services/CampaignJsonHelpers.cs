using System.Text.Json;
using System.Text.Json.Nodes;

namespace DragonsGenerator.API.Services;

public static class CampaignJsonHelpers
{
    /// <summary>
    /// Niveau personnage depuis le JSON export (totalLevel prioritaire, puis level, puis somme des classes).
    /// </summary>
    public static int? LevelFromCharacterJson(string? json)
    {
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json);
            var root = doc.RootElement;
            if (root.TryGetProperty("totalLevel", out var totalEl)
                && totalEl.TryGetInt32(out var total)
                && total > 0)
                return total;
            if (root.TryGetProperty("level", out var levelEl)
                && levelEl.TryGetInt32(out var level)
                && level > 0)
                return level;
            if (root.TryGetProperty("classes", out var classes) && classes.ValueKind == JsonValueKind.Array)
            {
                var sum = 0;
                foreach (var c in classes.EnumerateArray())
                {
                    if (c.TryGetProperty("level", out var cl) && cl.TryGetInt32(out var cli) && cli > 0)
                        sum += cli;
                }
                if (sum > 0) return sum;
            }
        }
        catch
        {
            /* ignore malformed JSON */
        }

        return null;
    }

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

                var status = pregen["status"]?.GetValue<string>() ?? "";
                var assignedRaw = pregen["assignedUserId"]?.GetValue<string>();
                var assignedToMe = !string.IsNullOrWhiteSpace(assignedRaw)
                    && Guid.TryParse(assignedRaw, out var assignedId)
                    && assignedId == playerUserId;

                // Joueurs : pool ready (consultation) + les leurs assignés / revendiqués.
                if ((status is "ready" or "assigned" or "claimed") || assignedToMe)
                {
                    visiblePregens.Add(pregen.DeepClone());
                }
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
                session["playNotebook"] = null;
                session["playPads"] = new JsonArray();
                // Garder activeCombat pour le battlefield joueur (face-à-face).
                session["combatHistory"] = new JsonArray();
                // Run sheet MJ — secrets de préparation
                session["objectives"] = "";
                session["scenes"] = "";
                session["prepChecklist"] = "";
                // playerRecap + activeMapId conservés pour les joueurs.
            }
        }

        // activeSessionId conservé pour que les joueurs voient la table en cours.

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

        // Carte live de la session active seulement (fog), sans spoilers MJ.
        node["dungeonMaps"] = BuildPlayerLiveDungeonMaps(node);

        using var doc = JsonDocument.Parse(node.ToJsonString());
        return doc.RootElement.Clone();
    }

    private static JsonArray BuildPlayerLiveDungeonMaps(JsonObject node)
    {
        var liveMapId = ResolveActiveSessionMapId(node);
        if (string.IsNullOrWhiteSpace(liveMapId) || node["dungeonMaps"] is not JsonArray maps)
            return new JsonArray();

        foreach (var item in maps)
        {
            if (item is not JsonObject map) continue;
            var id = map["id"]?.GetValue<string>();
            if (!string.Equals(id, liveMapId, StringComparison.Ordinal)) continue;
            return new JsonArray { SanitizeDungeonMapForPlayer(map) };
        }

        return new JsonArray();
    }

    private static string? ResolveActiveSessionMapId(JsonObject node)
    {
        var activeSessionId = node["activeSessionId"]?.GetValue<string>();
        if (string.IsNullOrWhiteSpace(activeSessionId) || node["sessions"] is not JsonArray sessions)
            return null;

        foreach (var item in sessions)
        {
            if (item is not JsonObject session) continue;
            if (!string.Equals(session["id"]?.GetValue<string>(), activeSessionId, StringComparison.Ordinal))
                continue;
            var mapId = session["activeMapId"]?.GetValue<string>();
            return string.IsNullOrWhiteSpace(mapId) ? null : mapId;
        }

        return null;
    }

    private static JsonObject SanitizeDungeonMapForPlayer(JsonObject source)
    {
        var map = source.DeepClone()!.AsObject();
        if (map["rooms"] is JsonArray rooms)
        {
            foreach (var item in rooms)
            {
                if (item is not JsonObject room) continue;
                room["notes"] = "";
                room["encounterId"] = null;
                room.Remove("randomEncounter");
            }
        }

        if (map["markers"] is JsonArray markers)
        {
            foreach (var item in markers)
            {
                if (item is not JsonObject marker) continue;
                marker["notes"] = "";
            }
        }

        return map;
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
    /// Applique une résolution d'attaque du joueur (dégâts + journal) sur le combat actif.
    /// </summary>
    public static string? TryApplyPlayerCombatAttack(
        string json,
        Guid userId,
        string actorId,
        string targetId,
        bool hit,
        int damage,
        string? logLine,
        out string? error)
    {
        error = null;
        if (hit && damage < 0)
        {
            error = "Dégâts invalides.";
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

            JsonObject? sessionObj = null;
            JsonObject? combat = null;
            foreach (var item in sessions)
            {
                if (item is not JsonObject session) continue;
                if (session["id"]?.GetValue<string>() != activeSessionId) continue;
                sessionObj = session;
                combat = session["activeCombat"] as JsonObject;
                break;
            }

            if (sessionObj is null || combat is null)
            {
                error = "Aucun combat actif.";
                return null;
            }

            var flow = combat["flowPhase"]?.GetValue<string>();
            if (!string.IsNullOrWhiteSpace(flow) && flow != "fight")
            {
                error = "Le combat n'est pas en phase de combat.";
                return null;
            }

            if (combat["combatants"] is not JsonArray combatants)
            {
                error = "Combattants introuvables.";
                return null;
            }

            JsonObject? actor = null;
            JsonObject? target = null;
            foreach (var item in combatants)
            {
                if (item is not JsonObject cb) continue;
                var id = cb["id"]?.GetValue<string>();
                if (id == actorId) actor = cb;
                if (id == targetId) target = cb;
            }

            if (actor is null || target is null)
            {
                error = "Acteur ou cible introuvable.";
                return null;
            }

            var linked = actor["memberUserId"]?.GetValue<string>();
            if (!Guid.TryParse(linked, out var linkedId) || linkedId != userId)
            {
                error = "Ce n'est pas votre personnage.";
                return null;
            }

            if (!IsCurrentTurnCombatant(combat, combatants, actorId))
            {
                error = "Ce n'est pas votre tour.";
                return null;
            }

            if (hit && damage > 0)
            {
                ApplyHpDeltaNode(target, -damage);
            }

            if (!string.IsNullOrWhiteSpace(logLine))
            {
                var log = sessionObj["combatLog"] as JsonArray ?? new JsonArray();
                log.Add(logLine.Trim());
                while (log.Count > 40)
                    log.RemoveAt(0);
                sessionObj["combatLog"] = log;
            }

            return node.ToJsonString();
        }
        catch
        {
            error = "Données de campagne invalides.";
            return null;
        }
    }

    private static bool IsCurrentTurnCombatant(JsonObject combat, JsonArray combatants, string actorId)
    {
        var alive = new List<(string Id, int? Total, string Name)>();
        foreach (var item in combatants)
        {
            if (item is not JsonObject cb) continue;
            var id = cb["id"]?.GetValue<string>();
            if (string.IsNullOrWhiteSpace(id)) continue;
            if (IsDefeatedNode(cb)) continue;
            int? total = null;
            if (cb["initiativeRoll"] is JsonNode rollNode && rollNode.AsValue().TryGetValue<int>(out var roll))
            {
                var bonus = cb["initiativeBonus"]?.GetValue<int>() ?? 0;
                total = roll + bonus;
            }
            var name = cb["name"]?.GetValue<string>() ?? "";
            alive.Add((id, total, name));
        }

        alive.Sort((a, b) =>
        {
            if (a.Total is null && b.Total is null) return string.Compare(a.Name, b.Name, StringComparison.Ordinal);
            if (a.Total is null) return 1;
            if (b.Total is null) return -1;
            var cmp = b.Total.Value.CompareTo(a.Total.Value);
            return cmp != 0 ? cmp : string.Compare(a.Name, b.Name, StringComparison.Ordinal);
        });

        if (alive.Count == 0) return false;
        var turnIndex = combat["turnIndex"]?.GetValue<int>() ?? 0;
        turnIndex = Math.Clamp(turnIndex, 0, alive.Count - 1);
        return alive[turnIndex].Id == actorId;
    }

    private static bool IsDefeatedNode(JsonObject cb)
    {
        if (cb["defeated"]?.GetValue<bool>() == true) return true;
        if (cb["currentHp"] is JsonNode hpNode && hpNode.AsValue().TryGetValue<int>(out var hp) && hp <= 0)
            return true;
        return false;
    }

    private static void ApplyHpDeltaNode(JsonObject cb, int delta)
    {
        int? current = cb["currentHp"] is JsonNode curNode && curNode.AsValue().TryGetValue<int>(out var c) ? c : null;
        int? max = cb["maxHp"] is JsonNode maxNode && maxNode.AsValue().TryGetValue<int>(out var m) ? m : null;

        if (current is null && max is null)
        {
            cb["currentHp"] = Math.Max(0, delta);
            if (delta <= 0) cb["defeated"] = true;
            return;
        }

        var cap = max ?? current ?? 0;
        var cur = current ?? cap;
        var next = Math.Max(0, Math.Min(cap, cur + delta));
        cb["currentHp"] = next;
        if (next <= 0) cb["defeated"] = true;
        else if (cb["defeated"]?.GetValue<bool>() == true) cb["defeated"] = false;
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
