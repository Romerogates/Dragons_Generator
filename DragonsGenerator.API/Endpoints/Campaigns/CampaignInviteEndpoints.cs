using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;

public class ListCampaignInvitesEndpoint(AppDbContext db) : EndpointWithoutRequest<List<CampaignInviteDto>>
{
    public override void Configure() => Get("/me/campaign-invites");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var rows = await (
            from i in db.CampaignInvites.AsNoTracking()
            join c in db.Campaigns.AsNoTracking() on i.CampaignId equals c.Id
            join u in db.Users.AsNoTracking() on i.InvitedByUserId equals u.Id
            where i.InvitedUserId == userId && i.Status == CampaignInviteStatuses.Pending
            select new { i.Id, i.CampaignId, CampaignTitle = c.Title, InvitedByName = u.DisplayName, i.CreatedAt }
        ).ToListAsync(ct);

        var invites = rows
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new CampaignInviteDto(x.Id, x.CampaignId, x.CampaignTitle, x.InvitedByName, x.CreatedAt))
            .ToList();

        await Send.OkAsync(invites, ct);
    }
}

public class ListCampaignPendingInvitesEndpoint(AppDbContext db) : EndpointWithoutRequest<List<CampaignPendingInviteDto>>
{
    public override void Configure() => Get("/me/campaigns/{id}/invites");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var campaignId = Route<Guid>("id");
        var owns = await db.Campaigns.AsNoTracking()
            .AnyAsync(c => c.Id == campaignId && c.OwnerUserId == userId, ct);
        if (!owns)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var rows = await (
            from i in db.CampaignInvites.AsNoTracking()
            join u in db.Users.AsNoTracking() on i.InvitedUserId equals u.Id
            where i.CampaignId == campaignId && i.Status == CampaignInviteStatuses.Pending
            select new { i.Id, i.InvitedUserId, u.DisplayName, i.CreatedAt }
        ).ToListAsync(ct);

        var invites = rows
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new CampaignPendingInviteDto(x.Id, x.InvitedUserId, x.DisplayName, x.CreatedAt))
            .ToList();

        await Send.OkAsync(invites, ct);
    }
}

public class SendCampaignInviteEndpoint(AppDbContext db, PushNotificationService push) : Endpoint<SendCampaignInviteBody>
{
    public override void Configure() => Post("/me/campaigns/{id}/invites");

    public override async Task HandleAsync(SendCampaignInviteBody req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var campaignId = Route<Guid>("id");
        var campaign = await db.Campaigns.FirstOrDefaultAsync(c => c.Id == campaignId && c.OwnerUserId == userId, ct);
        if (campaign is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (campaign.ClosedAt is not null)
        {
            AddError("Cette campagne est fermée.");
            await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
            return;
        }

        var areFriends = await db.Friendships.AnyAsync(f =>
            f.Status == FriendStatuses.Accepted &&
            ((f.RequesterId == userId && f.AddresseeId == req.UserId) ||
             (f.RequesterId == req.UserId && f.AddresseeId == userId)), ct);
        if (!areFriends)
        {
            AddError("Vous ne pouvez inviter que vos amis.");
            await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
            return;
        }

        var existingMember = await db.CampaignMembers.FirstOrDefaultAsync(
            m => m.CampaignId == campaignId && m.UserId == req.UserId, ct);
        if (existingMember is not null
            && existingMember.LeftAt is null
            && existingMember.RemovedAt is null)
        {
            AddError("Ce joueur fait déjà partie de la campagne.");
            await Send.ErrorsAsync(StatusCodes.Status409Conflict, ct);
            return;
        }

        var pending = await db.CampaignInvites.FirstOrDefaultAsync(
            i => i.CampaignId == campaignId && i.InvitedUserId == req.UserId && i.Status == CampaignInviteStatuses.Pending, ct);
        if (pending is not null)
        {
            AddError("Une invitation est déjà en attente.");
            await Send.ErrorsAsync(StatusCodes.Status409Conflict, ct);
            return;
        }

        db.CampaignInvites.Add(new CampaignInvite
        {
            CampaignId = campaignId,
            InvitedUserId = req.UserId,
            InvitedByUserId = userId.Value,
        });
        await db.SaveChangesAsync(ct);

        var inviter = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId, ct);
        await CampaignActivityService.LogAsync(
            db, campaignId, userId.Value, CampaignActivityKinds.InviteSent,
            new { userId = req.UserId, campaignTitle = campaign.Title }, ct);
        await push.NotifyUserAsync(
            req.UserId,
            "Invitation campagne",
            $"{inviter.DisplayName} vous invite à « {campaign.Title} »",
            "/friends",
            ct);

        await Send.NoContentAsync(ct);
    }
}

public class AcceptCampaignInviteEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Post("/me/campaign-invites/{id}/accept");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<Guid>("id");
        var invite = await db.CampaignInvites
            .Include(i => i.Campaign)
            .ThenInclude(c => c.Members)
            .AsSplitQuery()
            .FirstOrDefaultAsync(i => i.Id == id && i.InvitedUserId == userId && i.Status == CampaignInviteStatuses.Pending, ct);
        if (invite is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (invite.Campaign.ClosedAt is not null)
        {
            AddError("Cette campagne est fermée.");
            await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
            return;
        }

        invite.Status = CampaignInviteStatuses.Accepted;
        var existing = invite.Campaign.Members.FirstOrDefault(m => m.UserId == userId);
        if (existing is not null)
        {
            CampaignHistoryHelpers.Reactivate(existing);
        }
        else
        {
            db.CampaignMembers.Add(new CampaignMember
            {
                CampaignId = invite.CampaignId,
                UserId = userId.Value,
                Role = CampaignMemberRoles.Player,
                ProposalStatus = CharacterProposalStatuses.None,
            });
        }
        invite.Campaign.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId, ct);
        await CampaignActivityService.LogAsync(
            db, invite.CampaignId, userId.Value, CampaignActivityKinds.InviteAccepted,
            new { displayName = user.DisplayName, campaignTitle = invite.Campaign.Title }, ct);

        await Send.NoContentAsync(ct);
    }
}

public class DeclineCampaignInviteEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Post("/me/campaign-invites/{id}/decline");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<Guid>("id");
        var invite = await db.CampaignInvites.FirstOrDefaultAsync(
            i => i.Id == id && i.InvitedUserId == userId && i.Status == CampaignInviteStatuses.Pending, ct);
        if (invite is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        invite.Status = CampaignInviteStatuses.Declined;
        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}


