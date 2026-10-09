using System.Text.Json;
using System.Text.Json.Nodes;

namespace DragonsGenerator.API.Services;

public static partial class CampaignJsonHelpers
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

    public static JsonElement FilterForPlayerView(
        JsonElement data,
        Guid playerUserId,
        IReadOnlyDictionary<Guid, JsonObject>? libraryGeometries = null)
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
                var clone = handout.DeepClone()!.AsObject();
                clone.Remove("dmNotes");
                if (clone["pages"] is JsonArray pages)
                {
                    var visiblePages = new JsonArray();
                    foreach (var pageItem in pages)
                    {
                        if (pageItem is not JsonObject page) continue;
                        if (page["published"]?.GetValue<bool>() != true) continue;
                        visiblePages.Add(page.DeepClone());
                    }
                    clone["pages"] = visiblePages;
                    if (visiblePages.Count > 0)
                    {
                        var bodies = new List<string>();
                        foreach (var pageItem in visiblePages)
                        {
                            if (pageItem is not JsonObject page) continue;
                            var title = page["title"]?.GetValue<string>();
                            var body = page["body"]?.GetValue<string>() ?? "";
                            bodies.Add(string.IsNullOrWhiteSpace(title) ? body : $"## {title}\n\n{body}");
                        }
                        clone["body"] = string.Join("\n\n---\n\n", bodies);
                    }
                }
                visibleHandouts.Add(clone);
            }

            node["handouts"] = visibleHandouts;
        }

        // Carte live de la session active seulement (fog), sans spoilers MJ.
        node["dungeonMaps"] = BuildPlayerLiveDungeonMaps(node, libraryGeometries);

        using var doc = JsonDocument.Parse(node.ToJsonString());
        return doc.RootElement.Clone();
    }

    /// <summary>Collecte les libraryDungeonId de la carte active (sans tiles) pour hydrate joueur.</summary>
    public static List<Guid> CollectActiveLibraryDungeonIds(JsonElement data)
    {
        var node = JsonNode.Parse(data.GetRawText()) as JsonObject ?? new JsonObject();
        var liveMapId = ResolveActiveSessionMapId(node);
        if (string.IsNullOrWhiteSpace(liveMapId) || node["dungeonMaps"] is not JsonArray maps)
            return [];

        foreach (var item in maps)
        {
            if (item is not JsonObject map) continue;
            var id = map["id"]?.GetValue<string>();
            if (!string.Equals(id, liveMapId, StringComparison.Ordinal)) continue;
            if (map["tiles"] is JsonArray { Count: > 0 }) return [];
            var libRaw = map["libraryDungeonId"]?.GetValue<string>();
            if (Guid.TryParse(libRaw, out var libId)) return [libId];
            return [];
        }

        return [];
    }

    private static JsonArray BuildPlayerLiveDungeonMaps(
        JsonObject node,
        IReadOnlyDictionary<Guid, JsonObject>? libraryGeometries)
    {
        var liveMapId = ResolveActiveSessionMapId(node);
        if (string.IsNullOrWhiteSpace(liveMapId) || node["dungeonMaps"] is not JsonArray maps)
            return new JsonArray();

        foreach (var item in maps)
        {
            if (item is not JsonObject map) continue;
            var id = map["id"]?.GetValue<string>();
            if (!string.Equals(id, liveMapId, StringComparison.Ordinal)) continue;
            var hydrated = HydrateMapFromLibraryIfNeeded(map, libraryGeometries);
            return new JsonArray { SanitizeDungeonMapForPlayer(hydrated) };
        }

        return new JsonArray();
    }

    private static JsonObject HydrateMapFromLibraryIfNeeded(
        JsonObject map,
        IReadOnlyDictionary<Guid, JsonObject>? libraryGeometries)
    {
        if (map["tiles"] is JsonArray { Count: > 0 })
            return map.DeepClone()!.AsObject();

        var libRaw = map["libraryDungeonId"]?.GetValue<string>();
        if (!Guid.TryParse(libRaw, out var libId)
            || libraryGeometries is null
            || !libraryGeometries.TryGetValue(libId, out var lib))
        {
            return map.DeepClone()!.AsObject();
        }

        var merged = lib.DeepClone()!.AsObject();
        merged["id"] = map["id"]?.DeepClone();
        merged["libraryDungeonId"] = map["libraryDungeonId"]?.DeepClone();
        if (map["name"] is JsonNode nameNode) merged["name"] = nameNode.DeepClone();
        if (map["handoutId"] is JsonNode handout) merged["handoutId"] = handout.DeepClone();
        if (map["fogOfWarEnabled"] is JsonNode fog) merged["fogOfWarEnabled"] = fog.DeepClone();
        if (map["revealedRoomIds"] is JsonNode revealed) merged["revealedRoomIds"] = revealed.DeepClone();

        if (map["rooms"] is JsonArray overlayRooms && merged["rooms"] is JsonArray libRooms)
        {
            var overlayById = new Dictionary<string, JsonObject>(StringComparer.Ordinal);
            foreach (var r in overlayRooms)
            {
                if (r is not JsonObject ro) continue;
                var rid = ro["id"]?.GetValue<string>();
                if (!string.IsNullOrWhiteSpace(rid)) overlayById[rid] = ro;
            }

            foreach (var r in libRooms)
            {
                if (r is not JsonObject room) continue;
                var rid = room["id"]?.GetValue<string>();
                if (rid is null || !overlayById.TryGetValue(rid, out var ov)) continue;
                if (ov["encounterId"] is JsonNode enc) room["encounterId"] = enc.DeepClone();
                if (ov["notes"] is JsonNode notes) room["notes"] = notes.DeepClone();
            }
        }

        return merged;
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
}
