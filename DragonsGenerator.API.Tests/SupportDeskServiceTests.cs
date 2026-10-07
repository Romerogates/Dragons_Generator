using System.Net;
using DragonsGenerator.API.Services;

namespace DragonsGenerator.API.Tests;

public class SupportDeskServiceTests
{
    [Fact]
    public void Loopback_ingest_allows_localhost()
    {
        Assert.True(SupportDeskService.IsLoopbackIngest(IPAddress.Loopback, false));
        Assert.True(SupportDeskService.IsLoopbackIngest(IPAddress.IPv6Loopback, false));
        Assert.True(SupportDeskService.IsLoopbackIngest(null, true));
        Assert.False(SupportDeskService.IsLoopbackIngest(IPAddress.Parse("8.8.8.8"), false));
    }

    [Fact]
    public void Support_emails_include_ticket_cta()
    {
        var taken = AuthEmailTemplates.SupportTaken("Bob", "Bug table", "https://dragons-generator.top/support?ticket=1");
        Assert.Contains("consultons", taken, StringComparison.OrdinalIgnoreCase);
        var reply = AuthEmailTemplates.SupportReply("Bob", "Bug table", "On corrige.", "https://x/support");
        Assert.Contains("Lire et répondre", reply, StringComparison.Ordinal);
    }
}
