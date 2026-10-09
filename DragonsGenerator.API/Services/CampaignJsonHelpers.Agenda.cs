using System.Text.Json;
using System.Text.Json.Nodes;

namespace DragonsGenerator.API.Services;

public static partial class CampaignJsonHelpers
{
    public static DateTimeOffset? NextSessionFromJson(string json)
    {
        try
        {
            var now = DateTimeOffset.UtcNow;
            DateTimeOffset? next = null;

            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json);
            if (doc.RootElement.TryGetProperty("sessions", out var sessions) && sessions.ValueKind == JsonValueKind.Array)
            {
                foreach (var session in sessions.EnumerateArray())
                {
                    if (!session.TryGetProperty("status", out var st) || st.GetString() != "planned")
                        continue;
                    if (!session.TryGetProperty("scheduledAt", out var at))
                        continue;
                    if (!DateTimeOffset.TryParse(at.GetString(), out var when))
                        continue;
                    if (when < now)
                        continue;
                    if (next is null || when < next)
                        next = when;
                }
            }

            foreach (var ev in ListUpcomingScheduleEvents(json, now))
            {
                if (next is null || ev.ScheduledAt < next)
                    next = ev.ScheduledAt;
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

    /// <summary>
    /// Prochaines dates libres (scheduleEvents), y compris occurrences RRULE simples
    /// (FREQ=WEEKLY|MONTHLY). Ids préfixés <c>sched:</c> pour la dédup des rappels.
    /// </summary>
    public static IReadOnlyList<PlannedSessionInfo> ListUpcomingScheduleEvents(string json, DateTimeOffset now)
    {
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json);
            if (!doc.RootElement.TryGetProperty("scheduleEvents", out var schedule)
                || schedule.ValueKind != JsonValueKind.Array)
                return [];

            var list = new List<PlannedSessionInfo>();
            var horizon = now.AddMonths(6);

            foreach (var ev in schedule.EnumerateArray())
            {
                var id = ev.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
                if (string.IsNullOrWhiteSpace(id)) continue;
                if (!ev.TryGetProperty("startsAt", out var startsEl)
                    || !DateTimeOffset.TryParse(startsEl.GetString(), out var starts))
                    continue;

                var title = ev.TryGetProperty("title", out var t) ? t.GetString() ?? "Date" : "Date";
                var location = ev.TryGetProperty("location", out var loc) ? loc.GetString() : null;
                var rrule = ev.TryGetProperty("rrule", out var rr) ? rr.GetString() : null;

                foreach (var when in EnumerateScheduleOccurrences(starts, rrule, now, horizon))
                {
                    list.Add(new PlannedSessionInfo($"sched:{id}", title, when, location));
                }
            }

            return list;
        }
        catch
        {
            return [];
        }
    }

    private static IEnumerable<DateTimeOffset> EnumerateScheduleOccurrences(
        DateTimeOffset seed,
        string? rrule,
        DateTimeOffset from,
        DateTimeOffset until)
    {
        if (string.IsNullOrWhiteSpace(rrule))
        {
            if (seed > from) yield return seed;
            yield break;
        }

        var parts = rrule.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(p => p.Split('=', 2))
            .Where(p => p.Length == 2)
            .ToDictionary(p => p[0].ToUpperInvariant(), p => p[1], StringComparer.OrdinalIgnoreCase);

        if (!parts.TryGetValue("FREQ", out var freqRaw))
        {
            if (seed > from) yield return seed;
            yield break;
        }

        var freq = freqRaw.ToUpperInvariant();
        if (freq is not ("WEEKLY" or "MONTHLY"))
        {
            if (seed > from) yield return seed;
            yield break;
        }

        var interval = 1;
        if (parts.TryGetValue("INTERVAL", out var intervalRaw)
            && int.TryParse(intervalRaw, out var parsedInterval)
            && parsedInterval > 0)
            interval = parsedInterval;

        var cursor = seed;
        var guard = 0;
        while (cursor < from.AddDays(-7) && guard++ < 500)
        {
            var next = AdvanceSchedule(cursor, freq, interval);
            if (next <= cursor) yield break;
            cursor = next;
            if (cursor > until) yield break;
        }

        for (var i = 0; i < 80; i++)
        {
            if (cursor > until) yield break;
            if (cursor > from) yield return cursor;
            var advanced = AdvanceSchedule(cursor, freq, interval);
            if (advanced <= cursor) yield break;
            cursor = advanced;
        }
    }

    private static DateTimeOffset AdvanceSchedule(DateTimeOffset from, string freq, int interval) =>
        freq == "WEEKLY" ? from.AddDays(7 * interval) : from.AddMonths(interval);

    /// <summary>
    /// Agrège sessions + scheduleEvents pour l’agenda global.
    /// Joueurs : sessions non annulées uniquement ; MJ : tout.
    /// </summary>
    public static IReadOnlyList<CampaignAgendaEventInfo> ExtractAgendaEvents(
        string json,
        Guid campaignId,
        string campaignTitle,
        bool isOwner)
    {
        var list = new List<CampaignAgendaEventInfo>();
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json);
            var root = doc.RootElement;

            if (root.TryGetProperty("scheduleEvents", out var schedule) && schedule.ValueKind == JsonValueKind.Array)
            {
                foreach (var ev in schedule.EnumerateArray())
                {
                    var id = ev.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
                    if (string.IsNullOrWhiteSpace(id)) continue;
                    if (!ev.TryGetProperty("startsAt", out var startsEl)
                        || !DateTimeOffset.TryParse(startsEl.GetString(), out var starts))
                        continue;

                    DateTimeOffset? ends = null;
                    if (ev.TryGetProperty("endsAt", out var endsEl)
                        && endsEl.ValueKind != JsonValueKind.Null
                        && DateTimeOffset.TryParse(endsEl.GetString(), out var endsParsed))
                        ends = endsParsed;

                    var allDay = ev.TryGetProperty("allDay", out var allDayEl)
                        && allDayEl.ValueKind == JsonValueKind.True;
                    var title = ev.TryGetProperty("title", out var t) ? t.GetString() : null;
                    var kind = ev.TryGetProperty("kind", out var k) ? k.GetString() : null;
                    var location = ev.TryGetProperty("location", out var loc) ? loc.GetString() : null;
                    CountScheduleRsvps(ev, out var rsvpYes, out var rsvpNo, out var rsvpMaybe);

                    list.Add(new CampaignAgendaEventInfo(
                        Id: $"{campaignId}:schedule:{id}",
                        CampaignId: campaignId,
                        CampaignTitle: campaignTitle,
                        Source: "schedule",
                        Title: string.IsNullOrWhiteSpace(title) ? "Date" : title!,
                        StartsAt: starts,
                        EndsAt: ends,
                        AllDay: allDay,
                        Kind: kind,
                        Status: null,
                        Location: location,
                        RsvpYes: rsvpYes,
                        RsvpNo: rsvpNo,
                        RsvpMaybe: rsvpMaybe));
                }
            }

            if (root.TryGetProperty("sessions", out var sessions) && sessions.ValueKind == JsonValueKind.Array)
            {
                foreach (var session in sessions.EnumerateArray())
                {
                    var id = session.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
                    if (string.IsNullOrWhiteSpace(id)) continue;
                    var status = session.TryGetProperty("status", out var st) ? st.GetString() ?? "planned" : "planned";
                    if (!isOwner && status == "cancelled") continue;
                    if (!session.TryGetProperty("scheduledAt", out var at)
                        || !DateTimeOffset.TryParse(at.GetString(), out var starts))
                        continue;

                    var title = session.TryGetProperty("title", out var t) ? t.GetString() : null;
                    var location = session.TryGetProperty("location", out var loc) ? loc.GetString() : null;
                    var ends = starts.AddHours(3);

                    list.Add(new CampaignAgendaEventInfo(
                        Id: $"{campaignId}:session:{id}",
                        CampaignId: campaignId,
                        CampaignTitle: campaignTitle,
                        Source: "session",
                        Title: string.IsNullOrWhiteSpace(title) ? "Session" : title!,
                        StartsAt: starts,
                        EndsAt: ends,
                        AllDay: false,
                        Kind: null,
                        Status: status,
                        Location: location));
                }
            }
        }
        catch
        {
            return list;
        }

        return list;
    }

    private static void CountScheduleRsvps(JsonElement ev, out int yes, out int no, out int maybe)
    {
        yes = 0;
        no = 0;
        maybe = 0;
        if (!ev.TryGetProperty("rsvps", out var rsvps) || rsvps.ValueKind != JsonValueKind.Array)
            return;
        foreach (var r in rsvps.EnumerateArray())
        {
            var status = r.TryGetProperty("status", out var st) ? st.GetString() : null;
            switch (status)
            {
                case "yes":
                    yes++;
                    break;
                case "no":
                    no++;
                    break;
                case "maybe":
                    maybe++;
                    break;
            }
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
}
