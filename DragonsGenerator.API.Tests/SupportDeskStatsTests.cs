using DragonsGenerator.API.Services;

namespace DragonsGenerator.API.Tests;

public class SupportDeskStatsTests
{
    [Fact]
    public void Counts_waiting_staff_vs_player_and_oldest_hours()
    {
        var now = DateTimeOffset.Parse("2026-11-17T12:00:00Z");
        var staff = Guid.NewGuid();
        var player = Guid.NewGuid();
        var closed = Guid.NewGuid();
        var tickets = new List<SupportDeskTicketRow>
        {
            new(staff, "open", "bug", now.AddHours(-10), now.AddHours(-10)),
            new(player, "in_progress", "ia", now.AddHours(-2), now.AddHours(-1)),
            new(closed, "closed", "bug", now.AddDays(-3), now.AddDays(-1)),
        };
        var last = new Dictionary<Guid, bool?>
        {
            [staff] = false,
            [player] = true,
            [closed] = true,
        };

        var snap = SupportDeskStats.From(tickets, last, now);
        Assert.Equal(1, snap.Open);
        Assert.Equal(1, snap.InProgress);
        Assert.Equal(1, snap.Closed);
        Assert.Equal(1, snap.WaitingOnStaff);
        Assert.Equal(1, snap.WaitingOnPlayer);
        Assert.Equal(10, snap.OldestWaitingHours);
        Assert.Contains(snap.ByCategory, c => c.Category == "bug" && c.WaitingOnStaff == 1);
    }
}
