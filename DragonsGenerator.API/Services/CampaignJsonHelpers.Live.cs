using System.Text.Json;
using System.Text.Json.Nodes;

namespace DragonsGenerator.API.Services;

public static partial class CampaignJsonHelpers
{
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
}
