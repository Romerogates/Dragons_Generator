using DragonsGenerator.API.Services;

namespace DragonsGenerator.API.Tests;

public class SupportTicketRulesTests
{
    [Theory]
    [InlineData(null, "autre")]
    [InlineData("BUG", "bug")]
    [InlineData("ia", "ia")]
    [InlineData("inconnu", "autre")]
    public void NormalizeCategory_maps_known_or_autre(string? raw, string expected)
    {
        Assert.Equal(expected, SupportTicketRules.NormalizeCategory(raw));
    }

    [Fact]
    public void WaitingOnStaff_when_no_staff_reply()
    {
        Assert.True(SupportTicketRules.WaitingOnStaff("open", null));
        Assert.True(SupportTicketRules.WaitingOnStaff("in_progress", false));
        Assert.False(SupportTicketRules.WaitingOnStaff("in_progress", true));
        Assert.False(SupportTicketRules.WaitingOnStaff("closed", false));
    }
}
