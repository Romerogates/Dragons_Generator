using System.Text.Json;
using System.Text.Json.Nodes;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;


public class SetCampaignArchivedEndpoint(AppDbContext db) : Endpoint<SetCampaignArchivedRequest>
{
    public override void Configure() => Put("/me/campaigns/{id}/archive");

    public override async Task HandleAsync(SetCampaignArchivedRequest req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<Guid>("id");
        var (campaign, membership, isOwner) = await CampaignAccess.LoadAsync(db, id, userId.Value, ct);
        if (campaign is null || !CampaignAccess.CanView(isOwner, membership) || CampaignAccess.IsSupportInspect(membership))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (CampaignHistoryHelpers.IsHistoryView(campaign, membership))
        {
            AddError("Campagne en historique — archivage indisponible.");
            await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
            return;
        }

        var member = membership;
        if (member is null && isOwner)
        {
            member = campaign.Members.FirstOrDefault(m => m.UserId == userId.Value);
            if (member is null)
            {
                member = new CampaignMember
                {
                    UserId = userId.Value,
                    Role = CampaignMemberRoles.Dm,
                    ProposalStatus = CharacterProposalStatuses.None,
                };
                campaign.Members.Add(member);
            }
        }

        if (member is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        member.ArchivedAt = req.Archived ? DateTimeOffset.UtcNow : null;
        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
