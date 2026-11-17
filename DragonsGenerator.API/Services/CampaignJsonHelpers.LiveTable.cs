using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace DragonsGenerator.API.Services;

public static partial class CampaignJsonHelpers
{
    /// <summary>
    /// Met à jour pions / carte de soirée (et positions combat) sans remplacer tout le JSON campagne.
    /// </summary>
    public static string? TryPatchLiveTable(
        string json,
        string sessionId,
        JsonElement tablePawns,
        IReadOnlyList<LiveTableCombatantPosition>? combatantPositions,
        string? activeMapId,
        bool clearActiveMapId,
        out string? error)
    {
        error = null;
        if (string.IsNullOrWhiteSpace(sessionId))
        {
            error = "Session requise.";
            return null;
        }

        var hasPawns = tablePawns.ValueKind is JsonValueKind.Array or JsonValueKind.Null;
        var hasPositions = combatantPositions is { Count: > 0 };
        var hasMap = clearActiveMapId || activeMapId is not null;
        if (!hasPawns && !hasPositions && !hasMap)
        {
            error = "Rien à mettre à jour.";
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

            if (tablePawns.ValueKind == JsonValueKind.Null)
                target["tablePawns"] = new JsonArray();
            else if (tablePawns.ValueKind == JsonValueKind.Array)
                target["tablePawns"] = JsonNode.Parse(tablePawns.GetRawText());

            if (clearActiveMapId)
                target["activeMapId"] = null;
            else if (!string.IsNullOrWhiteSpace(activeMapId))
                target["activeMapId"] = activeMapId;

            if (hasPositions)
                ApplyCombatantPositions(target, combatantPositions!);

            return root.ToJsonString();
        }
        catch
        {
            error = "JSON campagne invalide.";
            return null;
        }
    }

    private static void ApplyCombatantPositions(
        JsonObject session,
        IReadOnlyList<LiveTableCombatantPosition> positions)
    {
        if (session["activeCombat"] is not JsonObject combat) return;
        if (combat["combatants"] is not JsonArray combatants) return;

        var byId = new Dictionary<string, LiveTableCombatantPosition>(StringComparer.Ordinal);
        foreach (var pos in positions)
        {
            if (string.IsNullOrWhiteSpace(pos.Id)) continue;
            byId[pos.Id] = pos;
        }
        if (byId.Count == 0) return;

        foreach (var item in combatants)
        {
            if (item is not JsonObject cb) continue;
            var id = cb["id"]?.GetValue<string>();
            if (id is null || !byId.TryGetValue(id, out var pos)) continue;
            if (pos.MapX is int x) cb["mapX"] = x;
            if (pos.MapY is int y) cb["mapY"] = y;
            if (pos.TokenImageUrl is not null) cb["tokenImageUrl"] = pos.TokenImageUrl;
        }
    }
}

public sealed record LiveTableCombatantPosition(
    string Id,
    int? MapX,
    int? MapY,
    string? TokenImageUrl);
