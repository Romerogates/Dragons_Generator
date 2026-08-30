using DragonsGenerator.API.Services;

namespace DragonsGenerator.API.Tests;

public class SessionReminderRulesTests
{
    [Theory]
    [InlineData(24, true, "24h")]
    [InlineData(23.4, false, "24h")]
    [InlineData(24.6, false, "24h")]
    [InlineData(60, true, "1h")]
    [InlineData(54, false, "1h")]
    [InlineData(66, false, "1h")]
    public void ShouldSend_respects_reminder_window(double minutesOrHoursFromNow, bool expected, string kind)
    {
        var now = DateTimeOffset.UtcNow;
        var sessionAt = kind == "24h"
            ? now.AddHours(minutesOrHoursFromNow)
            : now.AddMinutes(minutesOrHoursFromNow);

        Assert.Equal(expected, SessionReminderRules.ShouldSend(sessionAt, now, kind));
    }

    [Fact]
    public void ListUpcomingPlannedSessions_skips_past_and_played()
    {
        var now = DateTimeOffset.UtcNow;
        var json = $$"""
        {
          "sessions": [
            { "id": "past", "title": "Passée", "scheduledAt": "{{now.AddHours(-2):O}}", "status": "planned" },
            { "id": "ok", "title": "OK", "scheduledAt": "{{now.AddDays(2):O}}", "status": "planned", "location": "Taverne" },
            { "id": "played", "title": "Jouée", "scheduledAt": "{{now.AddDays(1):O}}", "status": "played" }
          ]
        }
        """;

        var list = CampaignJsonHelpers.ListUpcomingPlannedSessions(json, now);
        Assert.Single(list);
        Assert.Equal("ok", list[0].Id);
        Assert.Equal("Taverne", list[0].Location);
    }
}
