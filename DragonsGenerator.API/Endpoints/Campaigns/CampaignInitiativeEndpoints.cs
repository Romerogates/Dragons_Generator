using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;

public class GetInitiativeBoardEndpoint(AppDbContext db) : EndpointWithoutRequest<InitiativeBoardDto>
{
    public override void Configure() => Get("/me/campaigns/{id}/initiative");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<Guid>("id");
        var (campaign, membership, isOwner) = await CampaignAccess.LoadAsync(db, id, userId.Value, ct);
        if (campaign is null || !CampaignAccess.CanView(isOwner, membership))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var board = CampaignJsonHelpers.TryReadInitiativeBoard(campaign.JsonData);
        if (board is null)
        {
            await Send.OkAsync(new InitiativeBoardDto(false, null, null, []), ct);
            return;
        }

        await Send.OkAsync(new InitiativeBoardDto(
            board.Open,
            board.Code,
            board.Label,
            board.Combatants.Select(c => new InitiativeCombatantDto(
                c.Id, c.Name, c.Kind, c.InitiativeBonus, c.HasRoll, c.MemberUserId)).ToList()), ct);
    }
}

public class SubmitInitiativeEndpoint(AppDbContext db) : Endpoint<SubmitInitiativeRequest>
{
    public override void Configure() => Post("/me/campaigns/{id}/initiative/submit");

    public override async Task HandleAsync(SubmitInitiativeRequest req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<Guid>("id");
        if (string.IsNullOrWhiteSpace(req.Code) || string.IsNullOrWhiteSpace(req.CombatantId))
        {
            AddError("Code et combattant requis.");
            await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
            return;
        }

        string? lastError = null;
        for (var attempt = 0; attempt < 3; attempt++)
        {
            var (campaign, membership, isOwner) = await CampaignAccess.LoadAsync(db, id, userId.Value, ct);
            if (campaign is null || !CampaignAccess.CanView(isOwner, membership))
            {
                await Send.NotFoundAsync(ct);
                return;
            }

            var newJson = CampaignJsonHelpers.TryApplyInitiativeRoll(
                campaign.JsonData,
                req.Code,
                req.CombatantId,
                req.Roll,
                isOwner ? null : userId,
                out lastError);

            if (newJson is null)
            {
                AddError(lastError ?? "Impossible d'enregistrer le jet.");
                await Send.ErrorsAsync(StatusCodes.Status409Conflict, ct);
                return;
            }

            campaign.JsonData = newJson;
            campaign.UpdatedAt = DateTimeOffset.UtcNow;
            try
            {
                await db.SaveChangesAsync(ct);
                await Send.NoContentAsync(ct);
                return;
            }
            catch (DbUpdateConcurrencyException)
            {
                foreach (var entry in db.ChangeTracker.Entries())
                    await entry.ReloadAsync(ct);
            }
        }

        AddError(lastError ?? "Impossible d'enregistrer le jet (concurrence).");
        await Send.ErrorsAsync(StatusCodes.Status409Conflict, ct);
    }
}

public record SubmitInitiativeRequest(string Code, string CombatantId, int Roll);

public record InitiativeBoardDto(
    bool Open,
    string? Code,
    string? Label,
    IReadOnlyList<InitiativeCombatantDto> Combatants);

public record InitiativeCombatantDto(
    string Id,
    string Name,
    string Kind,
    int InitiativeBonus,
    bool HasRoll,
    string? MemberUserId);
