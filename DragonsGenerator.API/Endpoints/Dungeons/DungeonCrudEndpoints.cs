using System.Text.Json;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Dungeons;

public record DungeonSummaryDto(Guid Id, string Name, DateTimeOffset UpdatedAt);

public record DungeonDto(Guid Id, string Name, JsonElement Data, DateTimeOffset UpdatedAt);

public record UpsertDungeonRequest(string? Name, JsonElement Data);

public class ListMyDungeonsEndpoint(AppDbContext db) : EndpointWithoutRequest<List<DungeonSummaryDto>>
{
    public override void Configure() => Get("/me/dungeons");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var list = await db.Dungeons.AsNoTracking()
            .Where(d => d.UserId == userId)
            .Select(d => new DungeonSummaryDto(d.Id, d.Name, d.UpdatedAt))
            .ToListAsync(ct);

        await Send.OkAsync(list.OrderByDescending(d => d.UpdatedAt).ToList(), ct);
    }
}

public class GetMyDungeonEndpoint(AppDbContext db) : EndpointWithoutRequest<DungeonDto>
{
    public override void Configure() => Get("/me/dungeons/{id}");

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

        using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(row.JsonData) ? "{}" : row.JsonData);
        await Send.OkAsync(new DungeonDto(row.Id, row.Name, doc.RootElement.Clone(), row.UpdatedAt), ct);
    }
}

public class CreateMyDungeonEndpoint(AppDbContext db) : Endpoint<UpsertDungeonRequest, DungeonSummaryDto>
{
    public const int MaxDungeonsPerUser = 40;

    public override void Configure() => Post("/me/dungeons");

    public override async Task HandleAsync(UpsertDungeonRequest req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var count = await db.Dungeons.CountAsync(d => d.UserId == userId.Value, ct);
        if (count >= MaxDungeonsPerUser)
        {
            AddError($"Limite atteinte : maximum {MaxDungeonsPerUser} donjons par compte.");
            await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
            return;
        }

        var json = req.Data.ValueKind == JsonValueKind.Undefined
            ? "{}"
            : req.Data.GetRawText();
        var name = string.IsNullOrWhiteSpace(req.Name)
            ? TryExtractName(json) ?? "Sans nom"
            : req.Name.Trim();

        var row = new DungeonRecord
        {
            UserId = userId.Value,
            Name = name,
            JsonData = json,
        };
        db.Dungeons.Add(row);
        await db.SaveChangesAsync(ct);
        HttpContext.Response.StatusCode = StatusCodes.Status201Created;
        await Send.OkAsync(new DungeonSummaryDto(row.Id, row.Name, row.UpdatedAt), ct);
    }

    private static string? TryExtractName(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("name", out var n))
                return n.GetString();
        }
        catch
        {
            /* ignore */
        }

        return null;
    }
}

public class UpdateMyDungeonEndpoint(AppDbContext db) : Endpoint<UpsertDungeonRequest, DungeonSummaryDto>
{
    public override void Configure() => Put("/me/dungeons/{id}");

    public override async Task HandleAsync(UpsertDungeonRequest req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<Guid>("id");
        var row = await db.Dungeons.FirstOrDefaultAsync(d => d.Id == id && d.UserId == userId, ct);
        if (row is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (req.Data.ValueKind != JsonValueKind.Undefined)
            row.JsonData = req.Data.GetRawText();
        if (!string.IsNullOrWhiteSpace(req.Name))
            row.Name = req.Name.Trim();
        else
        {
            try
            {
                using var doc = JsonDocument.Parse(row.JsonData);
                if (doc.RootElement.TryGetProperty("name", out var n) && n.GetString() is { } nm)
                    row.Name = nm;
            }
            catch
            {
                /* ignore */
            }
        }

        row.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await Send.OkAsync(new DungeonSummaryDto(row.Id, row.Name, row.UpdatedAt), ct);
    }
}

public class DeleteMyDungeonEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Delete("/me/dungeons/{id}");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<Guid>("id");
        var row = await db.Dungeons.FirstOrDefaultAsync(d => d.Id == id && d.UserId == userId, ct);
        if (row is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        db.Dungeons.Remove(row);
        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
