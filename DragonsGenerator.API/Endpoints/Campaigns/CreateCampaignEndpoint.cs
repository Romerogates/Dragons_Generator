using System.Text.Json;
using System.Text.Json.Nodes;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;


public class CreateCampaignEndpoint(AppDbContext db) : Endpoint<UpsertCampaignRequest, CampaignSummaryDto>
{
    public const int MaxCampaignsPerUser = 20;

    public override void Configure() => Post("/me/campaigns");

    public override async Task HandleAsync(UpsertCampaignRequest req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var ownedCount = await db.Campaigns.CountAsync(c => c.OwnerUserId == userId.Value, ct);
        if (ownedCount >= MaxCampaignsPerUser)
        {
            AddError($"Limite atteinte : maximum {MaxCampaignsPerUser} campagnes par compte.");
            await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
            return;
        }

        var json = req.Data.ValueKind == JsonValueKind.Undefined ? "{}" : req.Data.GetRawText();
        var title = string.IsNullOrWhiteSpace(req.Title) ? "Nouvelle campagne" : req.Title.Trim();

        var campaign = new CampaignRecord
        {
            OwnerUserId = userId.Value,
            Title = title,
            JsonData = json,
        };
        campaign.Members.Add(new CampaignMember
        {
            UserId = userId.Value,
            Role = CampaignMemberRoles.Dm,
            ProposalStatus = CharacterProposalStatuses.None,
        });

        db.Campaigns.Add(campaign);
        await db.SaveChangesAsync(ct);

        HttpContext.Response.StatusCode = StatusCodes.Status201Created;
        await Send.OkAsync(new CampaignSummaryDto(
            campaign.Id,
            campaign.Title,
            CampaignMemberRoles.Dm,
            campaign.UpdatedAt,
            0,
            CampaignJsonHelpers.RegionNameFromJson(json),
            false), ct);
    }
}
