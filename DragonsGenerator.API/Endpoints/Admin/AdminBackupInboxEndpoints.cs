using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.Extensions.Options;

namespace DragonsGenerator.API.Endpoints.Admin;

public class HostBackupOptions
{
    public string Directory { get; set; } = "/app/host-backups";
}

public record HostBackupFileDto(string Name, long Size, DateTimeOffset Modified);

public class AdminHostBackupsEndpoint(IOptions<HostBackupOptions> options)
    : EndpointWithoutRequest<List<HostBackupFileDto>>
{
    public override void Configure()
    {
        Get("/admin/ops/backups");
        Roles(AppRoles.Admin);
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var dir = HostBackupFiles.ResolveDir(options.Value.Directory);
        if (dir is null)
        {
            await Send.OkAsync([], ct);
            return;
        }

        var list = dir.GetFiles()
            .Where(HostBackupFiles.IsAllowed)
            .OrderByDescending(f => f.LastWriteTimeUtc)
            .Take(40)
            .Select(f => new HostBackupFileDto(
                f.Name,
                f.Length,
                new DateTimeOffset(f.LastWriteTimeUtc, TimeSpan.Zero)))
            .ToList();
        await Send.OkAsync(list, ct);
    }
}

public class AdminDownloadHostBackupEndpoint(IOptions<HostBackupOptions> options) : EndpointWithoutRequest
{
    public override void Configure()
    {
        Get("/admin/ops/backups/{name}");
        Roles(AppRoles.Admin);
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var name = Path.GetFileName(Route<string>("name") ?? "");
        if (!HostBackupFiles.IsAllowedName(name))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var dir = HostBackupFiles.ResolveDir(options.Value.Directory);
        if (dir is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var path = Path.Combine(dir.FullName, name);
        if (!File.Exists(path))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        HttpContext.Response.ContentType = "application/octet-stream";
        HttpContext.Response.Headers.ContentDisposition = $"attachment; filename=\"{name}\"";
        await using var fs = File.OpenRead(path);
        await fs.CopyToAsync(HttpContext.Response.Body, ct);
    }
}

public class AdminImapInboxEndpoint(ImapInboxService imap) : EndpointWithoutRequest<List<InboxMailDto>>
{
    public override void Configure()
    {
        Get("/admin/ops/inbox");
        Roles(AppRoles.Admin);
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        if (!imap.IsConfigured)
        {
            await Send.OkAsync([], ct);
            return;
        }

        try
        {
            await Send.OkAsync(await imap.ListRecentAsync(30, ct), ct);
        }
        catch
        {
            AddError("IMAP indisponible (identifiants ou réseau).");
            await Send.ErrorsAsync(cancellation: ct);
        }
    }
}

internal static class HostBackupFiles
{
    public static DirectoryInfo? ResolveDir(string configured)
    {
        var path = string.IsNullOrWhiteSpace(configured) ? "/app/host-backups" : configured;
        if (!Directory.Exists(path))
            return null;
        return new DirectoryInfo(path);
    }

    public static bool IsAllowed(FileInfo f) => IsAllowedName(f.Name);

    public static bool IsAllowedName(string name) =>
        (name.StartsWith("dragons-", StringComparison.Ordinal)
            || name.StartsWith("uploads-", StringComparison.Ordinal))
        && (name.EndsWith(".db", StringComparison.OrdinalIgnoreCase)
            || name.EndsWith(".tar.gz", StringComparison.OrdinalIgnoreCase)
            || name.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
        && name.IndexOfAny(Path.GetInvalidFileNameChars()) < 0;
}
