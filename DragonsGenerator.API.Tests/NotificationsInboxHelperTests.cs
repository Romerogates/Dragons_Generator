using DragonsGenerator.API.Endpoints.Notifications;

namespace DragonsGenerator.API.Tests;

public class NotificationsInboxHelperTests
{
    [Fact]
    public void TryGetMemberUserId_parses_guid_string()
    {
        var id = Guid.Parse("11111111-1111-1111-1111-111111111111");
        Assert.True(NotificationsInboxHelper.TryGetMemberUserId(
            $$"""{"memberUserId":"{{id}}"}""", out var parsed));
        Assert.Equal(id, parsed);
    }

    [Fact]
    public void TryGetMemberUserId_rejects_missing_or_invalid()
    {
        Assert.False(NotificationsInboxHelper.TryGetMemberUserId("{}", out _));
        Assert.False(NotificationsInboxHelper.TryGetMemberUserId("""{"memberUserId":123}""", out _));
        Assert.False(NotificationsInboxHelper.TryGetMemberUserId("not-json", out _));
    }

    [Fact]
    public void TryGetString_reads_named_property()
    {
        Assert.Equal("Aria", NotificationsInboxHelper.TryGetString("""{"characterName":"Aria"}""", "characterName"));
        Assert.Null(NotificationsInboxHelper.TryGetString("""{"characterName":9}""", "characterName"));
        Assert.Null(NotificationsInboxHelper.TryGetString("broken", "characterName"));
    }

    [Fact]
    public void Preview_truncates_with_ellipsis()
    {
        Assert.Equal("abc", NotificationsInboxHelper.Preview("abc", 10));
        Assert.Equal("hello w…", NotificationsInboxHelper.Preview("hello world extra", 10));
    }

    [Fact]
    public void CountActionBadges_ignores_info_kinds()
    {
        var items = new List<NotificationItemDto>
        {
            new("1", "friend_request", "t", "m", "/", DateTimeOffset.UtcNow),
            new("2", "friend_message", "t", "m", "/", DateTimeOffset.UtcNow),
            new("3", "campaign_invite", "t", "m", "/", DateTimeOffset.UtcNow),
            new("4", "proposal_approved", "t", "m", "/", DateTimeOffset.UtcNow),
            new("5", "support_reply", "t", "m", "/", DateTimeOffset.UtcNow),
            new("6", "xp_awarded", "t", "m", "/", DateTimeOffset.UtcNow),
        };

        var (friends, campaigns, support, total) = NotificationsInboxHelper.CountActionBadges(items);
        Assert.Equal(2, friends);
        Assert.Equal(1, campaigns);
        Assert.Equal(1, support);
        Assert.Equal(4, total);
    }
}
