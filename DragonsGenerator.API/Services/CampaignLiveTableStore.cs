using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using DragonsGenerator.API.Persistence;

namespace DragonsGenerator.API.Services;

/// <summary>
/// Colonne Campaigns.LiveTableJson : pions / carte / combat par session,
/// hors du blob JsonData (hydraté à la lecture).
/// </summary>
public static class CampaignLiveTableStore
{
    public const string EmptyJson = "{}";

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public static bool IsEmpty(string? liveJson) =>
        string.IsNullOrWhiteSpace(liveJson)
        || liveJson.Trim() is "{}" or "null";

    public static string Read(CampaignRecord campaign) =>
        Hydrate(campaign.JsonData, campaign.LiveTableJson);

    public static void Write(CampaignRecord campaign, string json)
    {
        campaign.JsonData = json;
        campaign.LiveTableJson = Extract(json);
    }

    public static string Extract(string? campaignJson)
    {
        try
        {
            var root = JsonNode.Parse(string.IsNullOrWhiteSpace(campaignJson) ? "{}" : campaignJson) as JsonObject;
            if (root?["sessions"] is not JsonArray sessions)
                return EmptyJson;

            var liveSessions = new JsonObject();
            foreach (var item in sessions)
            {
                if (item is not JsonObject session) continue;
                var id = session["id"]?.GetValue<string>();
                if (string.IsNullOrWhiteSpace(id)) continue;

                var slice = new JsonObject();
                CopyNode(session, slice, "tablePawns");
                CopyNode(session, slice, "activeMapId");
                CopyNode(session, slice, "activeCombat");
                if (slice.Count == 0) continue;
                liveSessions[id] = slice;
            }

            if (liveSessions.Count == 0) return EmptyJson;
            return new JsonObject { ["sessions"] = liveSessions }.ToJsonString(JsonOpts);
        }
        catch
        {
            return EmptyJson;
        }
    }

    public static string Hydrate(string? campaignJson, string? liveJson)
    {
        var raw = string.IsNullOrWhiteSpace(campaignJson) ? "{}" : campaignJson;
        if (IsEmpty(liveJson)) return raw;

        try
        {
            var root = JsonNode.Parse(raw) as JsonObject ?? new JsonObject();
            if (JsonNode.Parse(liveJson!) is not JsonObject live)
                return raw;
            if (live["sessions"] is not JsonObject liveSessions)
                return raw;
            if (root["sessions"] is not JsonArray sessions)
                return root.ToJsonString(JsonOpts);

            foreach (var item in sessions)
            {
                if (item is not JsonObject session) continue;
                var id = session["id"]?.GetValue<string>();
                if (string.IsNullOrWhiteSpace(id) || liveSessions[id] is not JsonObject slice)
                    continue;
                CopyNode(slice, session, "tablePawns");
                CopyNode(slice, session, "activeMapId");
                CopyNode(slice, session, "activeCombat");
            }

            return root.ToJsonString(JsonOpts);
        }
        catch
        {
            return raw;
        }
    }

    private static void CopyNode(JsonObject from, JsonObject to, string key)
    {
        if (!from.ContainsKey(key)) return;
        var node = from[key];
        to[key] = node?.DeepClone();
    }
}
