using System.Diagnostics;
using System.Runtime.InteropServices;

namespace DragonsGenerator.API.Common;

public sealed record HostResourceSnapshot(
    string MachineName,
    string Framework,
    string OsDescription,
    DateTimeOffset StartedAt,
    int UptimeSeconds,
    double CpuProcessPercent,
    int ThreadCount,
    int ProcessorCount,
    long WorkingSetBytes,
    long PrivateMemoryBytes,
    long GcHeapBytes,
    long? AvailableMemoryBytes,
    long? ContainerMemoryBytes,
    long? ContainerMemoryLimitBytes,
    long? HostMemoryTotalBytes,
    long? HostMemoryAvailableBytes,
    long? HostDiskTotalBytes,
    long? HostDiskAvailableBytes,
    double? Load1,
    double? Load5,
    double? Load15);

public sealed class HostResourceSampler
{
    private readonly DateTimeOffset _startedAt = DateTimeOffset.UtcNow;
    private readonly object _cpuLock = new();
    private long _lastStampMs = Environment.TickCount64;
    private TimeSpan _lastCpu = Process.GetCurrentProcess().TotalProcessorTime;
    private double _cpuPercent;

    public HostResourceSnapshot Capture()
    {
        var process = Process.GetCurrentProcess();
        var cpu = SampleCpu(process);
        var gc = GC.GetGCMemoryInfo();
        var (cgroupUsed, cgroupLimit) = ReadCgroupMemory();
        var (hostTotal, hostAvailable) = ReadHostMemory();
        var (diskTotal, diskFree) = ReadHostDisk();
        var (load1, load5, load15) = ReadLoadavg();
        var available = gc.TotalAvailableMemoryBytes > 0 ? gc.TotalAvailableMemoryBytes : (long?)null;

        return new HostResourceSnapshot(
            Environment.MachineName,
            RuntimeInformation.FrameworkDescription,
            RuntimeInformation.OSDescription,
            _startedAt,
            (int)Math.Min(int.MaxValue, (DateTimeOffset.UtcNow - _startedAt).TotalSeconds),
            cpu,
            process.Threads.Count,
            Environment.ProcessorCount,
            process.WorkingSet64,
            process.PrivateMemorySize64,
            GC.GetTotalMemory(false),
            available,
            cgroupUsed,
            cgroupLimit,
            hostTotal,
            hostAvailable,
            diskTotal,
            diskFree,
            load1,
            load5,
            load15);
    }

    private double SampleCpu(Process process)
    {
        lock (_cpuLock)
        {
            var now = Environment.TickCount64;
            var cpu = process.TotalProcessorTime;
            var dtMs = now - _lastStampMs;
            if (dtMs >= 250)
            {
                var dCpuMs = (cpu - _lastCpu).TotalMilliseconds;
                var cores = Math.Max(1, Environment.ProcessorCount);
                _cpuPercent = Math.Clamp(100.0 * dCpuMs / (dtMs * cores), 0, 100);
                _lastStampMs = now;
                _lastCpu = cpu;
            }

            return Math.Round(_cpuPercent, 1);
        }
    }

    internal static (long? Total, long? Available) ReadHostDisk()
    {
        try
        {
            if (OperatingSystem.IsLinux())
            {
                var root = new DriveInfo("/");
                if (root.IsReady && root.TotalSize > 0)
                    return (root.TotalSize, root.AvailableFreeSpace);
            }

            foreach (var drive in DriveInfo.GetDrives())
            {
                if (!drive.IsReady || drive.TotalSize <= 0) continue;
                return (drive.TotalSize, drive.AvailableFreeSpace);
            }
        }
        catch (IOException)
        {
        }
        catch (UnauthorizedAccessException)
        {
        }
        catch (ArgumentException)
        {
        }

        return (null, null);
    }

    internal static (double? Load1, double? Load5, double? Load15) ReadLoadavg()
    {
        if (!File.Exists("/proc/loadavg")) return (null, null, null);
        try
        {
            return ParseLoadavg(File.ReadAllText("/proc/loadavg"));
        }
        catch (IOException)
        {
            return (null, null, null);
        }
        catch (UnauthorizedAccessException)
        {
            return (null, null, null);
        }
    }

    internal static (double? Load1, double? Load5, double? Load15) ParseLoadavg(string text)
    {
        var parts = text.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length < 3) return (null, null, null);
        if (!TryLoad(parts[0], out var a) || !TryLoad(parts[1], out var b) || !TryLoad(parts[2], out var c))
            return (null, null, null);
        return (a, b, c);
    }

    private static bool TryLoad(string raw, out double value)
    {
        value = 0;
        if (!double.TryParse(raw, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var n)
            || n < 0)
            return false;
        value = Math.Round(n, 2);
        return true;
    }

    internal static (long? Total, long? Available) ReadHostMemory()
    {
        if (!File.Exists("/proc/meminfo")) return (null, null);
        try
        {
            return ParseMeminfo(File.ReadAllText("/proc/meminfo"));
        }
        catch (IOException)
        {
            return (null, null);
        }
        catch (UnauthorizedAccessException)
        {
            return (null, null);
        }
    }

    /// <summary>
    /// MemTotal / MemAvailable de /proc/meminfo : sur Docker Linux c’est la RAM de l’hôte (VPS), pas le plafond cgroup.
    /// </summary>
    internal static (long? Total, long? Available) ParseMeminfo(string text)
    {
        long? total = null;
        long? available = null;
        foreach (var rawLine in text.Split(['\n', '\r'], StringSplitOptions.RemoveEmptyEntries))
        {
            var line = rawLine.Trim();
            if (line.StartsWith("MemTotal:", StringComparison.Ordinal))
                total = ParseMeminfoKb(line);
            else if (line.StartsWith("MemAvailable:", StringComparison.Ordinal))
                available = ParseMeminfoKb(line);
        }

        return (total, available);
    }

    private static long? ParseMeminfoKb(string line)
    {
        var parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length < 2) return null;
        if (!long.TryParse(parts[1], out var kb) || kb <= 0) return null;
        return kb * 1024;
    }

    internal static (long? Used, long? Limit) ReadCgroupMemory()
    {
        var used = ReadLongFile(
            "/sys/fs/cgroup/memory.current",
            "/sys/fs/cgroup/memory/memory.usage_in_bytes");
        var limit = ReadMemoryMax(
            "/sys/fs/cgroup/memory.max",
            "/sys/fs/cgroup/memory/memory.limit_in_bytes");
        return (used, limit);
    }

    private static long? ReadLongFile(params string[] paths)
    {
        foreach (var path in paths)
        {
            if (!File.Exists(path)) continue;
            try
            {
                var raw = File.ReadAllText(path).Trim();
                if (long.TryParse(raw, out var n) && n >= 0) return n;
            }
            catch (IOException)
            {
            }
            catch (UnauthorizedAccessException)
            {
            }
        }

        return null;
    }

    private static long? ReadMemoryMax(params string[] paths)
    {
        foreach (var path in paths)
        {
            if (!File.Exists(path)) continue;
            try
            {
                var raw = File.ReadAllText(path).Trim();
                if (raw.Equals("max", StringComparison.OrdinalIgnoreCase)) return null;
                if (long.TryParse(raw, out var n) && n > 0 && n < (1L << 62)) return n;
            }
            catch (IOException)
            {
            }
            catch (UnauthorizedAccessException)
            {
            }
        }

        return null;
    }
}
