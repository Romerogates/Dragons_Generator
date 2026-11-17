namespace DragonsGenerator.API.Services;

public readonly record struct SupportDeskTicketRow(
    Guid Id,
    string Status,
    string Category,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record SupportDeskCategoryStat(string Category, int Total, int WaitingOnStaff);

public sealed record SupportDeskSnapshot(
    int Open,
    int InProgress,
    int Closed,
    int WaitingOnStaff,
    int WaitingOnPlayer,
    int? OldestWaitingHours,
    List<SupportDeskCategoryStat> ByCategory);

public static class SupportDeskStats
{
    public static SupportDeskSnapshot From(
        IReadOnlyList<SupportDeskTicketRow> tickets,
        IReadOnlyDictionary<Guid, bool?> lastFromStaff,
        DateTimeOffset now)
    {
        var open = 0;
        var wip = 0;
        var closed = 0;
        var waitingStaff = 0;
        var waitingPlayer = 0;
        DateTimeOffset? oldest = null;
        var byCat = new Dictionary<string, (int Total, int Waiting)>(StringComparer.Ordinal);

        foreach (var t in tickets)
        {
            var status = string.IsNullOrWhiteSpace(t.Status) ? "open" : t.Status;
            if (status == "closed") closed++;
            else if (status == "in_progress") wip++;
            else open++;

            var cat = SupportTicketRules.NormalizeCategory(t.Category);
            lastFromStaff.TryGetValue(t.Id, out var last);
            var staffWait = SupportTicketRules.WaitingOnStaff(status, last);
            if (staffWait) waitingStaff++;
            else if (status != "closed") waitingPlayer++;

            byCat.TryGetValue(cat, out var bucket);
            byCat[cat] = (bucket.Total + 1, bucket.Waiting + (staffWait ? 1 : 0));

            if (staffWait)
            {
                var at = t.UpdatedAt == default ? t.CreatedAt : t.UpdatedAt;
                if (oldest is null || at < oldest) oldest = at;
            }
        }

        int? hours = null;
        if (oldest is { } o)
            hours = (int)Math.Max(0, Math.Floor((now - o).TotalHours));

        var categories = byCat
            .OrderByDescending(kv => kv.Value.Waiting)
            .ThenBy(kv => kv.Key)
            .Select(kv => new SupportDeskCategoryStat(kv.Key, kv.Value.Total, kv.Value.Waiting))
            .ToList();

        return new SupportDeskSnapshot(open, wip, closed, waitingStaff, waitingPlayer, hours, categories);
    }
}
