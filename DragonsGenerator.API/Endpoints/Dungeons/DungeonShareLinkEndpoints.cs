using System.Security.Cryptography;
using System.Text.Json;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Dungeons;

public record DungeonShareLinkDto(string? Token, bool Enabled, DateTimeOffset? CreatedAt);

public record DungeonSharePreviewDto(
    Guid DungeonId,
    string Name,
    string OwnerDisplayName,
    bool IsOwner);

public record DungeonSharedDetailDto(
    Guid Id,
    string Name,
    string OwnerDisplayName,
    JsonElement Data,
    DateTimeOffset UpdatedAt);

public class GetDungeonShareLinkEndpoint(AppDbContext db) : EndpointWithoutRequest<DungeonShareLinkDto>
{
    public override void Configure() => Get("/me/dungeons/{id}/share-link");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<Guid>("id");
        var row = await db.Dungeons.AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == id && d.UserId == userId, ct);
        if (row is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(
            new DungeonShareLinkDto(
                row.ShareEnabled ? row.ShareToken : null,
                row.ShareEnabled && !string.IsNullOrWhiteSpace(row.ShareToken),
                row.ShareTokenCreatedAt),
            ct);
    }
}

public class UpsertDungeonShareLinkEndpoint(AppDbContext db) : EndpointWithoutRequest<DungeonShareLinkDto>
{
    public override void Configure() => Post("/me/dungeons/{id}/share-link");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<Guid>("id");
        var row = await db.Dungeons
            .FirstOrDefaultAsync(d => d.Id == id && d.UserId == userId, ct);
        if (row is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        row.ShareToken = GenerateToken();
        row.ShareTokenCreatedAt = DateTimeOffset.UtcNow;
        row.ShareEnabled = true;
        row.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        await Send.OkAsync(
            new DungeonShareLinkDto(row.ShareToken, true, row.ShareTokenCreatedAt),
            ct);
    }

    internal static string GenerateToken()
    {
        Span<byte> bytes = stackalloc byte[24];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }
}

public class RevokeDungeonShareLinkEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Delete("/me/dungeons/{id}/share-link");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<Guid>("id");
        var row = await db.Dungeons
            .FirstOrDefaultAsync(d => d.Id == id && d.UserId == userId, ct);
        if (row is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        row.ShareToken = null;
        row.ShareTokenCreatedAt = null;
        row.ShareEnabled = false;
        row.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}

public class PreviewDungeonShareEndpoint(AppDbContext db) : EndpointWithoutRequest<DungeonSharePreviewDto>
{
    public override void Configure()
    {
        Get("/dungeons/shared/{token}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var token = Route<string>("token")?.Trim();
        if (string.IsNullOrWhiteSpace(token))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var row = await db.Dungeons.AsNoTracking()
            .Include(d => d.User)
            .FirstOrDefaultAsync(d => d.ShareEnabled && d.ShareToken == token, ct);
        if (row is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var viewerId = AuthHelpers.GetUserId(User);
        await Send.OkAsync(
            new DungeonSharePreviewDto(
                row.Id,
                row.Name,
                row.User.DisplayName,
                viewerId is not null && viewerId == row.UserId),
            ct);
    }
}

public class GetSharedDungeonEndpoint(AppDbContext db) : EndpointWithoutRequest<DungeonSharedDetailDto>
{
    public override void Configure()
    {
        Get("/dungeons/shared/{token}/data");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var token = Route<string>("token")?.Trim();
        if (string.IsNullOrWhiteSpace(token))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var row = await db.Dungeons.AsNoTracking()
            .Include(d => d.User)
            .FirstOrDefaultAsync(d => d.ShareEnabled && d.ShareToken == token, ct);
        if (row is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(row.JsonData) ? "{}" : row.JsonData);
        await Send.OkAsync(
            new DungeonSharedDetailDto(
                row.Id,
                row.Name,
                row.User.DisplayName,
                doc.RootElement.Clone(),
                row.UpdatedAt),
            ct);
    }
}

public class ImportDungeonFromShareEndpoint(AppDbContext db) : EndpointWithoutRequest<DungeonSummaryDto>
{
    public override void Configure() => Post("/me/dungeons/from-share/{token}");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var token = Route<string>("token")?.Trim();
        if (string.IsNullOrWhiteSpace(token))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var source = await db.Dungeons.AsNoTracking()
            .FirstOrDefaultAsync(d => d.ShareEnabled && d.ShareToken == token, ct);
        if (source is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (source.UserId == userId)
        {
            await Send.OkAsync(new DungeonSummaryDto(source.Id, source.Name, source.UpdatedAt), ct);
            return;
        }

        var count = await db.Dungeons.CountAsync(d => d.UserId == userId.Value, ct);
        if (count >= CreateMyDungeonEndpoint.MaxDungeonsPerUser)
        {
            AddError($"Limite de {CreateMyDungeonEndpoint.MaxDungeonsPerUser} donjons atteinte.");
            await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
            return;
        }

        var copy = new DungeonRecord
        {
            UserId = userId.Value,
            Name = string.IsNullOrWhiteSpace(source.Name) ? "Donjon partagé" : $"{source.Name} (copie)",
            JsonData = source.JsonData,
        };
        db.Dungeons.Add(copy);
        await db.SaveChangesAsync(ct);

        await Send.OkAsync(new DungeonSummaryDto(copy.Id, copy.Name, copy.UpdatedAt), ct);
    }
}

public record DungeonGalleryItemDto(
    string Token,
    string Name,
    string OwnerDisplayName,
    DateTimeOffset UpdatedAt);

/// <summary>Galerie publique : donjons avec lien de partage actif.</summary>
public class ListDungeonGalleryEndpoint(AppDbContext db) : EndpointWithoutRequest<List<DungeonGalleryItemDto>>
{
    public override void Configure()
    {
        Get("/dungeons/gallery");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        // SQLite cannot ORDER BY DateTimeOffset in SQL — sort in memory after project.
        var rows = await db.Dungeons.AsNoTracking()
            .Where(d => d.ShareEnabled && d.ShareToken != null && d.ShareToken != "")
            .Select(d => new DungeonGalleryItemDto(
                d.ShareToken!,
                d.Name,
                d.User.DisplayName,
                d.UpdatedAt))
            .ToListAsync(ct);

        await Send.OkAsync(
            rows.OrderByDescending(r => r.UpdatedAt).Take(60).ToList(),
            ct);
    }
}
