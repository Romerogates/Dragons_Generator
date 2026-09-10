using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;

/// <summary>
/// Persistance d'une résolution d'attaque joueur (PV + journal) sans ouvrir le PUT campagne.
/// </summary>
public class ResolveCombatAttackEndpoint(AppDbContext db) : Endpoint<ResolveCombatAttackRequest>
{
    public override void Configure() => Post("/me/campaigns/{id}/combat/resolve-attack");

    public override async Task HandleAsync(ResolveCombatAttackRequest req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<Guid>("id");
        if (string.IsNullOrWhiteSpace(req.ActorId) || string.IsNullOrWhiteSpace(req.TargetId))
        {
            AddError("Acteur et cible requis.");
            await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
            return;
        }

        if (req.Hit && (req.Damage is null || req.Damage < 0))
        {
            AddError("Dégâts invalides.");
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

            var newJson = CampaignJsonHelpers.TryApplyPlayerCombatAttack(
                campaign.JsonData,
                userId.Value,
                req.ActorId,
                req.TargetId,
                req.Hit,
                req.Hit ? req.Damage ?? 0 : 0,
                req.LogLine,
                out lastError);

            if (newJson is null)
            {
                AddError(lastError ?? "Impossible d'enregistrer l'attaque.");
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

        AddError(lastError ?? "Impossible d'enregistrer l'attaque (concurrence).");
        await Send.ErrorsAsync(StatusCodes.Status409Conflict, ct);
    }
}

public record ResolveCombatAttackRequest(
    string ActorId,
    string TargetId,
    bool Hit,
    int? Damage,
    string? LogLine);
