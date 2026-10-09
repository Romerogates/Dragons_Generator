using System.Text.Json;
using System.Text.Json.Nodes;
using DragonsGenerator.API.Endpoints.Characters;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;

internal static class CampaignPregenHelpers
{
    public static JsonObject ParseDataObject(string json)
    {
        try
        {
            return JsonNode.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json)?.AsObject()
                   ?? new JsonObject();
        }
        catch
        {
            return new JsonObject();
        }
    }

    public static JsonObject? FindPregen(JsonObject data, Guid pregenId)
    {
        if (data["pregenCharacters"] is not JsonArray arr) return null;
        foreach (var node in arr)
        {
            if (node is not JsonObject obj) continue;
            if (obj["id"]?.GetValue<string>() is { } idStr
                && Guid.TryParse(idStr, out var id)
                && id == pregenId)
                return obj;
        }
        return null;
    }

    public static bool UnassignUser(JsonObject data, string userIdStr)
    {
        if (data["pregenCharacters"] is not JsonArray pregenArr) return false;
        var changed = false;
        foreach (var node in pregenArr)
        {
            if (node is not JsonObject obj) continue;
            if (obj["assignedUserId"]?.GetValue<string>() != userIdStr) continue;
            obj.Remove("assignedUserId");
            obj.Remove("assignedDisplayName");
            obj["status"] = "ready";
            changed = true;
        }

        return changed;
    }
}

public class AssignCampaignPregenEndpoint(AppDbContext db) : Endpoint<AssignPregenBody>
{
    public override void Configure() => Post("/me/campaigns/{id}/pregens/{pregenId}/assign");

    public override async Task HandleAsync(AssignPregenBody req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var campaignId = Route<Guid>("id");
        var pregenId = Route<Guid>("pregenId");
        var (campaign, membership, isOwner) = await CampaignAccess.LoadAsync(db, campaignId, userId.Value, ct);
        if (campaign is null || !CampaignAccess.CanEdit(isOwner, membership, campaign))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var data = CampaignPregenHelpers.ParseDataObject(campaign.JsonData);
        var pregen = CampaignPregenHelpers.FindPregen(data, pregenId);
        if (pregen is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        pregen["assignedUserId"] = req.UserId.ToString();
        pregen["assignedDisplayName"] = req.DisplayName.Trim();
        pregen["status"] = "assigned";

        campaign.JsonData = data.ToJsonString();
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}

public class ClaimCampaignPregenEndpoint(AppDbContext db) : EndpointWithoutRequest<CharacterSummaryDto>
{
    public override void Configure() => Post("/me/campaigns/{id}/pregens/{pregenId}/claim");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var campaignId = Route<Guid>("id");
        var pregenId = Route<Guid>("pregenId");
        var (campaign, membership, isOwner) = await CampaignAccess.LoadAsync(db, campaignId, userId.Value, ct);
        if (campaign is null || !CampaignAccess.CanView(isOwner, membership))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var data = CampaignPregenHelpers.ParseDataObject(campaign.JsonData);
        var pregen = CampaignPregenHelpers.FindPregen(data, pregenId);
        if (pregen is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var status = pregen["status"]?.GetValue<string>() ?? "";
        if (status is not ("ready" or "assigned" or "claimed"))
        {
            AddError("Ce pré-tiré n'est pas disponible à la copie.");
            await Send.ErrorsAsync(StatusCodes.Status409Conflict, ct);
            return;
        }

        if (!Guid.TryParse(pregen["characterId"]?.GetValue<string>(), out var sourceCharacterId))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var source = await db.Characters.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == sourceCharacterId && c.UserId == campaign.OwnerUserId, ct);
        if (source is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var ownedJson = await db.Characters.AsNoTracking()
            .Where(c => c.UserId == userId)
            .Select(c => c.JsonData)
            .ToListAsync(ct);
        var ownedCount = ownedJson.Count(j => !CharacterPregenPool.IsPoolRecord(j));
        if (ownedCount >= CreateMyCharacterEndpoint.MaxCharactersPerUser)
        {
            AddError($"Limite atteinte : maximum {CreateMyCharacterEndpoint.MaxCharactersPerUser} personnages par compte.");
            await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
            return;
        }

        var copyName = pregen["characterName"]?.GetValue<string>()?.Trim() ?? source.Name;
        var copy = new CharacterRecord
        {
            UserId = userId.Value,
            Name = $"{copyName} (copie)",
            JsonData = CharacterPregenPool.StripPoolFlag(source.JsonData),
        };
        db.Characters.Add(copy);

        // Copie optionnelle dans Mes héros — n'approuve pas automatiquement à la table.
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        HttpContext.Response.StatusCode = StatusCodes.Status201Created;
        await Send.OkAsync(new CharacterSummaryDto(copy.Id, copy.Name, copy.UpdatedAt), ct);
    }
}

public class UseCampaignPregenAtTableEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Post("/me/campaigns/{id}/pregens/{pregenId}/use-at-table");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var campaignId = Route<Guid>("id");
        var pregenId = Route<Guid>("pregenId");
        var (campaign, membership, isOwner) = await CampaignAccess.LoadAsync(db, campaignId, userId.Value, ct);
        if (campaign is null || !CampaignAccess.CanView(isOwner, membership) || isOwner)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var member = campaign.Members.FirstOrDefault(m => m.UserId == userId && m.Role == CampaignMemberRoles.Player);
        if (member is null)
        {
            await Send.ForbiddenAsync(ct);
            return;
        }

        var data = CampaignPregenHelpers.ParseDataObject(campaign.JsonData);
        var pregen = CampaignPregenHelpers.FindPregen(data, pregenId);
        if (pregen is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var status = pregen["status"]?.GetValue<string>() ?? "";
        if (status is not ("ready" or "assigned"))
        {
            AddError("Ce pré-tiré n'est plus disponible pour la table.");
            await Send.ErrorsAsync(StatusCodes.Status409Conflict, ct);
            return;
        }

        var assignedRaw = pregen["assignedUserId"]?.GetValue<string>();
        if (!string.IsNullOrWhiteSpace(assignedRaw)
            && Guid.TryParse(assignedRaw, out var assignedId)
            && assignedId != userId.Value)
        {
            AddError("Ce pré-tiré est déjà assigné à un autre joueur.");
            await Send.ErrorsAsync(StatusCodes.Status403Forbidden, ct);
            return;
        }

        if (!Guid.TryParse(pregen["characterId"]?.GetValue<string>(), out var sourceCharacterId))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var source = await db.Characters.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == sourceCharacterId && c.UserId == campaign.OwnerUserId, ct);
        if (source is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var displayName = await db.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.DisplayName)
            .FirstAsync(ct);
        var copyName = pregen["characterName"]?.GetValue<string>()?.Trim() ?? source.Name;
        var level = CampaignJsonHelpers.LevelFromCharacterJson(source.JsonData);

        pregen["assignedUserId"] = userId.Value.ToString();
        pregen["assignedDisplayName"] = displayName;
        pregen["status"] = "assigned";
        campaign.JsonData = data.ToJsonString();
        campaign.UpdatedAt = DateTimeOffset.UtcNow;

        // Pointe vers le CharacterRecord du MJ — pas de clone dans le pool joueur.
        member.ApprovedCharacterId = source.Id;
        member.ApprovedCharacterName = copyName;
        member.ApprovedCharacterLevel = level;
        member.ProposalStatus = CharacterProposalStatuses.Approved;
        member.ProposedCharacterId = null;
        member.ProposedCharacterName = null;
        member.ProposedCharacterLevel = null;

        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}

public class GetCampaignPregenCharacterEndpoint(AppDbContext db) : EndpointWithoutRequest<CharacterDto>
{
    public override void Configure() => Get("/me/campaigns/{id}/pregens/{pregenId}/character");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var campaignId = Route<Guid>("id");
        var pregenId = Route<Guid>("pregenId");
        var (campaign, membership, isOwner) = await CampaignAccess.LoadAsync(db, campaignId, userId.Value, ct);
        if (campaign is null || !CampaignAccess.CanView(isOwner, membership))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var data = CampaignPregenHelpers.ParseDataObject(campaign.JsonData);
        var pregen = CampaignPregenHelpers.FindPregen(data, pregenId);
        if (pregen is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (!isOwner)
        {
            var status = pregen["status"]?.GetValue<string>() ?? "";
            var assignedRaw = pregen["assignedUserId"]?.GetValue<string>();
            var assignedToMe = !string.IsNullOrWhiteSpace(assignedRaw)
                && Guid.TryParse(assignedRaw, out var assignedId)
                && assignedId == userId.Value;

            var canView = status == "ready"
                || ((status is "assigned" or "claimed") && assignedToMe);
            if (!canView)
            {
                AddError("Ce pré-tiré n'est pas consultable.");
                await Send.ErrorsAsync(StatusCodes.Status403Forbidden, ct);
                return;
            }
        }

        if (!Guid.TryParse(pregen["characterId"]?.GetValue<string>(), out var sourceCharacterId))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var source = await db.Characters.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == sourceCharacterId && c.UserId == campaign.OwnerUserId, ct);
        if (source is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var displayName = pregen["characterName"]?.GetValue<string>()?.Trim() ?? source.Name;
        using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(source.JsonData) ? "{}" : source.JsonData);
        await Send.OkAsync(new CharacterDto(source.Id, displayName, doc.RootElement.Clone(), source.UpdatedAt), ct);
    }
}

