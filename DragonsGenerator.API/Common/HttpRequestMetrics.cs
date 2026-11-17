using System.Collections.Concurrent;

namespace DragonsGenerator.API.Common;

public sealed record HttpPathStat(string Path, int Count, int Errors, int AvgDurationMs);

public sealed record HttpRecentCall(string Method, string Path, int Status, int DurationMs, DateTimeOffset At);

public sealed record HttpTrafficSnapshot(
    int RequestsSinceStart,
    int Status2xx,
    int Status4xx,
    int Status5xx,
    int InFlight,
    List<HttpPathStat> TopPaths,
    List<HttpRecentCall> Recent);

public sealed class HttpRequestMetrics
{
    private const int RecentCap = 40;
    private const int TopCap = 15;
    private long _requests;
    private long _s2;
    private long _s4;
    private long _s5;
    private int _inFlight;
    private readonly ConcurrentDictionary<string, PathBucket> _paths = new(StringComparer.Ordinal);
    private readonly ConcurrentQueue<HttpRecentCall> _recent = new();

    public void Begin() => Interlocked.Increment(ref _inFlight);

    public void Complete(string method, string? path, int status, int durationMs)
    {
        Interlocked.Decrement(ref _inFlight);
        Interlocked.Increment(ref _requests);
        if (status is >= 200 and < 400) Interlocked.Increment(ref _s2);
        else if (status is >= 400 and < 500) Interlocked.Increment(ref _s4);
        else if (status >= 500) Interlocked.Increment(ref _s5);

        var key = HttpPathNormalizer.Normalize(method, path);
        var bucket = _paths.GetOrAdd(key, static _ => new PathBucket());
        bucket.Add(status, durationMs);

        if (ShouldKeepRecent(path))
        {
            _recent.Enqueue(new HttpRecentCall(
                method.ToUpperInvariant(),
                key.Contains(' ', StringComparison.Ordinal) ? key[(key.IndexOf(' ') + 1)..] : (path ?? "/"),
                status,
                durationMs,
                DateTimeOffset.UtcNow));
            while (_recent.Count > RecentCap && _recent.TryDequeue(out _))
            {
            }
        }
    }

    public HttpTrafficSnapshot Snapshot()
    {
        var top = _paths
            .Select(kv => kv.Value.ToStat(kv.Key))
            .OrderByDescending(s => s.Count)
            .Take(TopCap)
            .ToList();
        var recent = _recent.ToArray();
        Array.Reverse(recent);
        return new HttpTrafficSnapshot(
            (int)Math.Min(int.MaxValue, Interlocked.Read(ref _requests)),
            (int)Math.Min(int.MaxValue, Interlocked.Read(ref _s2)),
            (int)Math.Min(int.MaxValue, Interlocked.Read(ref _s4)),
            (int)Math.Min(int.MaxValue, Interlocked.Read(ref _s5)),
            Math.Max(0, _inFlight),
            top,
            recent.Take(RecentCap).ToList());
    }

    private static bool ShouldKeepRecent(string? path)
    {
        if (string.IsNullOrEmpty(path)) return true;
        return !path.StartsWith("/admin/stats", StringComparison.OrdinalIgnoreCase)
            && !path.StartsWith("/swagger", StringComparison.OrdinalIgnoreCase);
    }

    private sealed class PathBucket
    {
        private long _count;
        private long _errors;
        private long _duration;

        public void Add(int status, int durationMs)
        {
            Interlocked.Increment(ref _count);
            if (status >= 400) Interlocked.Increment(ref _errors);
            Interlocked.Add(ref _duration, Math.Max(0, durationMs));
        }

        public HttpPathStat ToStat(string path)
        {
            var count = (int)Math.Min(int.MaxValue, Interlocked.Read(ref _count));
            var errors = (int)Math.Min(int.MaxValue, Interlocked.Read(ref _errors));
            var duration = Interlocked.Read(ref _duration);
            var avg = count == 0 ? 0 : (int)Math.Min(int.MaxValue, duration / count);
            return new HttpPathStat(path, count, errors, avg);
        }
    }
}
