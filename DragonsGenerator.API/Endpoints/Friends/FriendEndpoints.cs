using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Friends;

public record UserSearchResultDto(
    Guid Id,
    string DisplayName,
    string? AvatarEmoji,
    string AccentColor,
    string? Bio,
    DateTimeOffset MemberSince,
    string RelationshipStatus
);
public record UserSuggestionDto(
    Guid Id,
    string DisplayName,
    string? AvatarEmoji,
    string AccentColor,
    string? Bio,
    DateTimeOffset MemberSince,
    string RelationshipStatus,
    string SuggestionReason,
    int SharedCampaignCount,
    string? SampleCampaignTitle
);
public record FriendUserDto(
    Guid Id,
    string DisplayName,
    string? AvatarEmoji,
    string AccentColor,
    DateTimeOffset FriendSince
);
public record FriendRequestDto(Guid Id, Guid UserId, string DisplayName, string? AvatarEmoji, string AccentColor, DateTimeOffset CreatedAt);
public record SendFriendRequestBody(Guid UserId);

public class SearchUsersEndpoint(AppDbContext db) : EndpointWithoutRequest<List<UserSearchResultDto>>
{
    public override void Configure()
    {
        Get("/users/search");
        Description(d => d.WithName("SearchUsers"));
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var q = (Query<string>("q", false) ?? "").Trim();
        if (q.Length < FriendDiscoveryHelper.MinSearchLength)
        {
            await Send.OkAsync([], ct);
            return;
        }

        var qLower = q.ToLowerInvariant();
        var users = await db.Users.AsNoTracking()
            .Where(u => u.Id != userId && u.EmailConfirmed &&
                u.DisplayName.ToLower().Contains(qLower))
            .OrderBy(u => u.DisplayName)
            .Take(20)
            .ToListAsync(ct);

        var relations = await FriendDiscoveryHelper.LoadRelationshipsAsync(
            db,
            userId.Value,
            users.Select(u => u.Id),
            ct);

        var results = users.Select(u => new UserSearchResultDto(
            u.Id,
            u.DisplayName,
            u.AvatarEmoji,
            u.AccentColor,
            u.Bio,
            u.CreatedAt,
            FriendDiscoveryHelper.ResolveRelationship(userId.Value, u.Id, relations)
        )).ToList();

        await Send.OkAsync(results, ct);
    }
}

public class ListFriendsEndpoint(AppDbContext db) : EndpointWithoutRequest<List<FriendUserDto>>
{
    public override void Configure() => Get("/me/friends");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var friendships = await db.Friendships.AsNoTracking()
            .Where(f => f.Status == FriendStatuses.Accepted &&
                (f.RequesterId == userId || f.AddresseeId == userId))
            .Include(f => f.Requester)
            .Include(f => f.Addressee)
            .ToListAsync(ct);

        var friends = friendships.Select(f =>
        {
            var friend = f.RequesterId == userId ? f.Addressee : f.Requester;
            return new FriendUserDto(
                friend.Id,
                friend.DisplayName,
                friend.AvatarEmoji,
                friend.AccentColor,
                f.CreatedAt
            );
        }).OrderByDescending(f => f.FriendSince).ThenBy(f => f.DisplayName).ToList();

        await Send.OkAsync(friends, ct);
    }
}

public class ListFriendRequestsEndpoint(AppDbContext db) : EndpointWithoutRequest<List<FriendRequestDto>>
{
    public override void Configure() => Get("/me/friends/requests");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var incoming = await db.Friendships.AsNoTracking()
            .Where(f => f.AddresseeId == userId && f.Status == FriendStatuses.Pending)
            .Include(f => f.Requester)
            .Select(f => new FriendRequestDto(f.Id, f.RequesterId, f.Requester.DisplayName, f.Requester.AvatarEmoji, f.Requester.AccentColor, f.CreatedAt))
            .ToListAsync(ct);

        await Send.OkAsync(incoming.OrderByDescending(f => f.CreatedAt).ToList(), ct);
    }
}

public class ListSentFriendRequestsEndpoint(AppDbContext db) : EndpointWithoutRequest<List<FriendRequestDto>>
{
    public override void Configure() => Get("/me/friends/requests/sent");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var outgoing = await db.Friendships.AsNoTracking()
            .Where(f => f.RequesterId == userId && f.Status == FriendStatuses.Pending)
            .Include(f => f.Addressee)
            .Select(f => new FriendRequestDto(f.Id, f.AddresseeId, f.Addressee.DisplayName, f.Addressee.AvatarEmoji, f.Addressee.AccentColor, f.CreatedAt))
            .ToListAsync(ct);

        await Send.OkAsync(outgoing.OrderByDescending(f => f.CreatedAt).ToList(), ct);
    }
}

public class CancelFriendRequestEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Delete("/me/friends/requests/{id}");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<Guid>("id");
        var friendship = await db.Friendships.FirstOrDefaultAsync(
            f => f.Id == id && f.RequesterId == userId && f.Status == FriendStatuses.Pending, ct);
        if (friendship is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        db.Friendships.Remove(friendship);
        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}

public class SendFriendRequestEndpoint(AppDbContext db) : Endpoint<SendFriendRequestBody>
{
    public override void Configure() => Post("/me/friends/request");

    public override async Task HandleAsync(SendFriendRequestBody req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        if (req.UserId == userId)
        {
            AddError("Vous ne pouvez pas vous ajouter vous-même.");
            await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
            return;
        }

        var target = await db.Users.FirstOrDefaultAsync(u => u.Id == req.UserId && u.EmailConfirmed, ct);
        if (target is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var existing = await db.Friendships.FirstOrDefaultAsync(f =>
            (f.RequesterId == userId && f.AddresseeId == req.UserId) ||
            (f.RequesterId == req.UserId && f.AddresseeId == userId), ct);

        if (existing is not null)
        {
            if (existing.Status == FriendStatuses.Accepted)
            {
                AddError("Vous êtes déjà amis.");
                await Send.ErrorsAsync(StatusCodes.Status409Conflict, ct);
                return;
            }
            if (existing.Status == FriendStatuses.Pending)
            {
                AddError("Une demande est déjà en attente.");
                await Send.ErrorsAsync(StatusCodes.Status409Conflict, ct);
                return;
            }
            existing.Status = FriendStatuses.Pending;
            existing.RequesterId = userId.Value;
            existing.AddresseeId = req.UserId;
            existing.CreatedAt = DateTimeOffset.UtcNow;
        }
        else
        {
            db.Friendships.Add(new Friendship
            {
                RequesterId = userId.Value,
                AddresseeId = req.UserId,
                Status = FriendStatuses.Pending,
            });
        }

        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}

public class AcceptFriendRequestEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Post("/me/friends/requests/{id}/accept");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<Guid>("id");
        var friendship = await db.Friendships.FirstOrDefaultAsync(
            f => f.Id == id && f.AddresseeId == userId && f.Status == FriendStatuses.Pending, ct);
        if (friendship is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        friendship.Status = FriendStatuses.Accepted;
        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}

public class DeclineFriendRequestEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Post("/me/friends/requests/{id}/decline");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<Guid>("id");
        var friendship = await db.Friendships.FirstOrDefaultAsync(
            f => f.Id == id && f.AddresseeId == userId && f.Status == FriendStatuses.Pending, ct);
        if (friendship is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        friendship.Status = FriendStatuses.Declined;
        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}

public class ListFriendSuggestionsEndpoint(AppDbContext db) : EndpointWithoutRequest<List<UserSuggestionDto>>
{
    public override void Configure() => Get("/me/friends/suggestions");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var myCampaignIds = await db.CampaignMembers.AsNoTracking()
            .Where(m => m.UserId == userId)
            .Select(m => m.CampaignId)
            .ToListAsync(ct);

        if (myCampaignIds.Count == 0)
        {
            await Send.OkAsync([], ct);
            return;
        }

        var coMembers = await db.CampaignMembers.AsNoTracking()
            .Where(m => myCampaignIds.Contains(m.CampaignId) && m.UserId != userId)
            .Include(m => m.User)
            .Include(m => m.Campaign)
            .Where(m => m.User.EmailConfirmed)
            .ToListAsync(ct);

        var grouped = coMembers
            .GroupBy(m => m.UserId)
            .Select(g =>
            {
                var sample = g.OrderByDescending(x => x.Campaign.UpdatedAt).First();
                return new
                {
                    User = sample.User,
                    SharedCampaignCount = g.Select(x => x.CampaignId).Distinct().Count(),
                    SampleCampaignTitle = sample.Campaign.Title,
                };
            })
            .OrderByDescending(x => x.SharedCampaignCount)
            .ThenBy(x => x.User.DisplayName)
            .Take(20)
            .ToList();

        var otherIds = grouped.Select(x => x.User.Id).ToList();
        var relations = await FriendDiscoveryHelper.LoadRelationshipsAsync(
            db,
            userId.Value,
            otherIds,
            ct);

        var results = grouped
            .Select(x => new UserSuggestionDto(
                x.User.Id,
                x.User.DisplayName,
                x.User.AvatarEmoji,
                x.User.AccentColor,
                x.User.Bio,
                x.User.CreatedAt,
                FriendDiscoveryHelper.ResolveRelationship(userId.Value, x.User.Id, relations),
                "Coéquipier de campagne",
                x.SharedCampaignCount,
                x.SampleCampaignTitle
            ))
            .Where(x => x.RelationshipStatus == "none")
            .ToList();

        await Send.OkAsync(results, ct);
    }
}
