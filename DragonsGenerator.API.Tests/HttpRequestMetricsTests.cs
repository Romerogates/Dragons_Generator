using DragonsGenerator.API.Common;

namespace DragonsGenerator.API.Tests;

public class HttpRequestMetricsTests
{
    [Theory]
    [InlineData("GET", "/campaigns/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/members", "GET /campaigns/{id}/members")]
    [InlineData("post", "/admin/users/42", "POST /admin/users/{id}")]
    [InlineData("GET", "/characters?x=1", "GET /characters")]
    public void Normalize_strips_ids_and_query(string method, string path, string expected)
    {
        Assert.Equal(expected, HttpPathNormalizer.Normalize(method, path));
    }

    [Fact]
    public void Snapshot_counts_status_classes_and_top_paths()
    {
        var metrics = new HttpRequestMetrics();
        metrics.Begin();
        metrics.Complete("GET", "/characters", 200, 12);
        metrics.Begin();
        metrics.Complete("GET", "/characters", 200, 8);
        metrics.Begin();
        metrics.Complete("POST", "/support/tickets", 500, 40);

        var snap = metrics.Snapshot();
        Assert.Equal(3, snap.RequestsSinceStart);
        Assert.Equal(2, snap.Status2xx);
        Assert.Equal(1, snap.Status5xx);
        Assert.Equal(0, snap.InFlight);
        Assert.Contains(snap.TopPaths, p => p.Path == "GET /characters" && p.Count == 2);
        Assert.Contains(snap.Recent, r => r.Status == 500);
    }

    [Fact]
    public void ParseMeminfo_reads_host_total_and_available()
    {
        const string sample = """
            MemTotal:       2048000 kB
            MemFree:          128000 kB
            MemAvailable:     512000 kB
            """;
        var (total, available) = HostResourceSampler.ParseMeminfo(sample);
        Assert.Equal(2048000L * 1024, total);
        Assert.Equal(512000L * 1024, available);
    }

    [Fact]
    public void ParseLoadavg_reads_three_windows()
    {
        var (a, b, c) = HostResourceSampler.ParseLoadavg("0.52 0.61 0.70 1/234 99");
        Assert.Equal(0.52, a);
        Assert.Equal(0.61, b);
        Assert.Equal(0.70, c);
    }

    [Fact]
    public void Host_snapshot_reports_process_memory()
    {
        var sampler = new HostResourceSampler();
        var a = sampler.Capture();
        Thread.Sleep(20);
        var b = sampler.Capture();
        Assert.True(a.WorkingSetBytes > 0);
        Assert.True(b.ProcessorCount >= 1);
        Assert.True(b.UptimeSeconds >= 0);
        Assert.False(string.IsNullOrWhiteSpace(b.Framework));
    }
}
