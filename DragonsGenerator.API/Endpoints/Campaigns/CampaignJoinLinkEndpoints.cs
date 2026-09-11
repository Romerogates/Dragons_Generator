using System.Security.Cryptography;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;

public record CampaignJoinLinkDto(string? Token, bool Enabled, DateTimeOffset? CreatedAt);
public record CampaignJoinPreviewDto(Guid CampaignId, string Title, string OwnerDisplayName, bool AlreadyMember);

public class GetCampaignJoinLinkEndpoint(AppDbContext db) : EndpointWithoutRequest<CampaignJoinLinkDto>
{
    public override void Configure() => Get("/me/campaigns/{id}/join-link");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var campaignId = Route<Guid>("id");
        var campaign = await db.Campaigns.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == campaignId && c.OwnerUserId == userId, ct);
        if (campaign is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(
            new CampaignJoinLinkDto(
                campaign.JoinEnabled ? campaign.JoinToken : null,
                campaign.JoinEnabled && !string.IsNullOrWhiteSpace(campaign.JoinToken),
                campaign.JoinTokenCreatedAt),
            ct);
    }
}

public class UpsertCampaignJoinLinkEndpoint(AppDbContext db) : EndpointWithoutRequest<CampaignJoinLinkDto>
{
    public override void Configure() => Post("/me/campaigns/{id}/join-link");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var campaignId = Route<Guid>("id");
        var campaign = await db.Campaigns
            .FirstOrDefaultAsync(c => c.Id == campaignId && c.OwnerUserId == userId, ct);
        if (campaign is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        campaign.JoinToken = GenerateToken();
        campaign.JoinTokenCreatedAt = DateTimeOffset.UtcNow;
        campaign.JoinEnabled = true;
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        await Send.OkAsync(
            new CampaignJoinLinkDto(campaign.JoinToken, true, campaign.JoinTokenCreatedAt),
            ct);
    }

    private static string GenerateToken()
    {
        Span<byte> bytes = stackalloc byte[24];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }
}

public class RevokeCampaignJoinLinkEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Delete("/me/campaigns/{id}/join-link");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var campaignId = Route<Guid>("id");
        var campaign = await db.Campaigns
            .FirstOrDefaultAsync(c => c.Id == campaignId && c.OwnerUserId == userId, ct);
        if (campaign is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        campaign.JoinToken = null;
        campaign.JoinTokenCreatedAt = null;
        campaign.JoinEnabled = false;
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}

public class PreviewCampaignJoinEndpoint(AppDbContext db) : EndpointWithoutRequest<CampaignJoinPreviewDto>
{
    public override void Configure()
    {
        Get("/join/{token}");
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

        var campaign = await db.Campaigns.AsNoTracking()
            .Include(c => c.Owner)
            .FirstOrDefaultAsync(c => c.JoinEnabled && c.JoinToken == token, ct);
        if (campaign is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var viewerId = AuthHelpers.GetUserId(User);
        var alreadyMember = viewerId is not null && (
            campaign.OwnerUserId == viewerId
            || await db.CampaignMembers.AsNoTracking()
                .AnyAsync(m => m.CampaignId == campaign.Id && m.UserId == viewerId, ct));

        await Send.OkAsync(
            new CampaignJoinPreviewDto(
                campaign.Id,
                campaign.Title,
                campaign.Owner.DisplayName,
                alreadyMember),
            ct);
    }
}

public class JoinCampaignByTokenEndpoint(AppDbContext db) : EndpointWithoutRequest<CampaignSummaryDto>
{
    public override void Configure() => Post("/me/join/{token}");

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

        var campaign = await db.Campaigns
            .Include(c => c.Members)
            .FirstOrDefaultAsync(c => c.JoinEnabled && c.JoinToken == token, ct);
        if (campaign is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (campaign.OwnerUserId == userId)
        {
            await Send.OkAsync(
                new CampaignSummaryDto(
                    campaign.Id,
                    campaign.Title,
                    CampaignMemberRoles.Dm,
                    campaign.UpdatedAt,
                    campaign.Members.Count(m => m.Role == CampaignMemberRoles.Player),
                    CampaignJsonHelpers.RegionNameFromJson(campaign.JsonData)),
                ct);
            return;
        }

        var existing = campaign.Members.FirstOrDefault(m => m.UserId == userId);
        if (existing is null)
        {
            db.CampaignMembers.Add(new CampaignMember
            {
                CampaignId = campaign.Id,
                UserId = userId.Value,
                Role = CampaignMemberRoles.Player,
                ProposalStatus = CharacterProposalStatuses.None,
            });
            campaign.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);

            await CampaignActivityService.LogAsync(
                db, campaign.Id, userId.Value, CampaignActivityKinds.InviteAccepted,
                new { via = "join-link", campaignTitle = campaign.Title }, ct);
        }

        var playerCount = await db.CampaignMembers.AsNoTracking()
            .CountAsync(m => m.CampaignId == campaign.Id && m.Role == CampaignMemberRoles.Player, ct);

        await Send.OkAsync(
            new CampaignSummaryDto(
                campaign.Id,
                campaign.Title,
                CampaignMemberRoles.Player,
                campaign.UpdatedAt,
                playerCount,
                CampaignJsonHelpers.RegionNameFromJson(campaign.JsonData)),
            ct);
    }
}
