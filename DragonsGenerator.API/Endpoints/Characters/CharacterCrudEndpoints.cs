using System.Text.Json;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Characters;

public record CharacterSummaryDto(Guid Id, string Name, DateTimeOffset UpdatedAt);
public record CharacterDto(Guid Id, string Name, JsonElement Data, DateTimeOffset UpdatedAt);
public record UpsertCharacterRequest(string? Name, JsonElement Data);

public class ListMyCharactersEndpoint(AppDbContext db) : EndpointWithoutRequest<List<CharacterSummaryDto>>
{
    public override void Configure() => Get("/me/characters");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var list = await db.Characters.AsNoTracking()
            .Where(c => c.UserId == userId)
            .Select(c => new CharacterSummaryDto(c.Id, c.Name, c.UpdatedAt))
            .ToListAsync(ct);

        await Send.OkAsync(list.OrderByDescending(c => c.UpdatedAt).ToList(), ct);
    }
}

public class GetMyCharacterEndpoint(AppDbContext db) : EndpointWithoutRequest<CharacterDto>
{
    public override void Configure() => Get("/me/characters/{id}");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }
        var id = Route<Guid>("id");
        var row = await db.Characters.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId, ct);
        if (row is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(row.JsonData) ? "{}" : row.JsonData);
        await Send.OkAsync(new CharacterDto(row.Id, row.Name, doc.RootElement.Clone(), row.UpdatedAt), ct);
    }
}

public class CreateMyCharacterEndpoint(AppDbContext db) : Endpoint<UpsertCharacterRequest, CharacterSummaryDto>
{
    public const int MaxCharactersPerUser = 10;

    public override void Configure() => Post("/me/characters");

    public override async Task HandleAsync(UpsertCharacterRequest req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var count = await db.Characters.CountAsync(c => c.UserId == userId.Value, ct);
        if (count >= MaxCharactersPerUser)
        {
            AddError($"Limite atteinte : maximum {MaxCharactersPerUser} personnages par compte.");
            await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
            return;
        }

        var json = req.Data.ValueKind == JsonValueKind.Undefined
            ? "{}"
            : req.Data.GetRawText();
        var name = string.IsNullOrWhiteSpace(req.Name)
            ? TryExtractName(json) ?? "Sans nom"
            : req.Name.Trim();

        var row = new CharacterRecord
        {
            UserId = userId.Value,
            Name = name,
            JsonData = json,
        };
        db.Characters.Add(row);
        await db.SaveChangesAsync(ct);
        HttpContext.Response.StatusCode = StatusCodes.Status201Created;
        await Send.OkAsync(new CharacterSummaryDto(row.Id, row.Name, row.UpdatedAt), ct);
    }

    private static string? TryExtractName(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("name", out var n))
                return n.GetString();
        }
        catch { /* ignore */ }
        return null;
    }
}

public class UpdateMyCharacterEndpoint(AppDbContext db) : Endpoint<UpsertCharacterRequest, CharacterSummaryDto>
{
    public override void Configure() => Put("/me/characters/{id}");

    public override async Task HandleAsync(UpsertCharacterRequest req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }
        var id = Route<Guid>("id");
        var row = await db.Characters.FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId, ct);
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
            catch { /* ignore */ }
        }
        row.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await Send.OkAsync(new CharacterSummaryDto(row.Id, row.Name, row.UpdatedAt), ct);
    }
}

public class DeleteMyCharacterEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Delete("/me/characters/{id}");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }
        var id = Route<Guid>("id");
        var row = await db.Characters.FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId, ct);
        if (row is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }
        db.Characters.Remove(row);
        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
