namespace DragonsGenerator.API.Common;

/// <summary>Espace les appels Groq pour respecter ~30 RPM (free tier).</summary>
public sealed class GroqRequestCoordinator
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly IConfiguration _config;
    private DateTime _nextAllowedUtc = DateTime.MinValue;

    public GroqRequestCoordinator(IConfiguration config) => _config = config;

    public async Task WaitTurnAsync(CancellationToken ct)
    {
        var minIntervalMs = _config.GetValue("Groq:MinIntervalMs", 2600);
        await _gate.WaitAsync(ct);
        try
        {
            var now = DateTime.UtcNow;
            if (_nextAllowedUtc > now)
                await Task.Delay(_nextAllowedUtc - now, ct);
            _nextAllowedUtc = DateTime.UtcNow.AddMilliseconds(minIntervalMs);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task DelayForRetryAsync(int delayMs, CancellationToken ct)
    {
        await _gate.WaitAsync(ct);
        try
        {
            var waitUntil = DateTime.UtcNow.AddMilliseconds(delayMs);
            if (waitUntil > _nextAllowedUtc)
                _nextAllowedUtc = waitUntil;
        }
        finally
        {
            _gate.Release();
        }
        await Task.Delay(delayMs, ct);
    }
}
