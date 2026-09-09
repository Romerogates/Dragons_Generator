using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Guide;

public record GuideTopicStatsDto(string TopicId, int CommentCount, DateTimeOffset? LastCommentAt);

public record GuideCommentDto(
    Guid Id,
    string TopicId,
    Guid UserId,
    string AuthorName,
    string Body,
    Guid? ParentId,
    DateTimeOffset CreatedAt,
    int LikeCount,
    bool LikedByMe
);

public record CreateGuideCommentRequest(string Body, Guid? ParentId);

public class ListGuideTopicStatsEndpoint(AppDbContext db) : EndpointWithoutRequest<List<GuideTopicStatsDto>>
{
    public override void Configure() => Get("/guide/topics/stats");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var rows = await db.GuideComments.AsNoTracking()
            .Select(c => new { c.TopicId, c.CreatedAt })
            .ToListAsync(ct);

        var stats = rows
            .GroupBy(c => c.TopicId)
            .Select(g => new GuideTopicStatsDto(
                g.Key,
                g.Count(),
                g.Max(c => (DateTimeOffset?)c.CreatedAt)
            ))
            .ToList();

        await Send.OkAsync(stats, ct);
    }
}

public class ListGuideCommentsEndpoint(AppDbContext db) : EndpointWithoutRequest<List<GuideCommentDto>>
{
    public override void Configure() => Get("/guide/topics/{topicId}/comments");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var topicId = Route<string>("topicId")?.Trim() ?? "";
        if (string.IsNullOrWhiteSpace(topicId) || topicId.Length > 64)
        {
            AddError("Topic invalide.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        var userId = AuthHelpers.GetUserId(User);

        var rows = await db.GuideComments.AsNoTracking()
            .Where(c => c.TopicId == topicId)
            .Include(c => c.User)
            .Include(c => c.Likes)
            .ToListAsync(ct);

        var dtos = rows
            .Select(c => new GuideCommentDto(
                c.Id,
                c.TopicId,
                c.UserId,
                string.IsNullOrWhiteSpace(c.User.DisplayName) ? c.User.Email : c.User.DisplayName!,
                c.Body,
                c.ParentId,
                c.CreatedAt,
                c.Likes.Count,
                userId is Guid uid && c.Likes.Any(l => l.UserId == uid)
            ))
            .OrderByDescending(c => c.LikeCount)
            .ThenByDescending(c => c.CreatedAt)
            .ToList();

        await Send.OkAsync(dtos, ct);
    }
}

public class CreateGuideCommentEndpoint(AppDbContext db) : Endpoint<CreateGuideCommentRequest, GuideCommentDto>
{
    public override void Configure() => Post("/guide/topics/{topicId}/comments");

    public override async Task HandleAsync(CreateGuideCommentRequest req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var topicId = Route<string>("topicId")?.Trim() ?? "";
        if (string.IsNullOrWhiteSpace(topicId) || topicId.Length > 64)
        {
            AddError("Topic invalide.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        var body = (req.Body ?? "").Trim();
        if (body.Length is < 1 or > 2000)
        {
            AddError("Commentaire : 1 à 2000 caractères.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        if (req.ParentId is Guid parentId)
        {
            var parent = await db.GuideComments.AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == parentId && c.TopicId == topicId, ct);
            if (parent is null)
            {
                AddError("Réponse : commentaire parent introuvable.");
                await Send.ErrorsAsync(cancellation: ct);
                return;
            }

            if (parent.ParentId is not null)
            {
                AddError("Une seule profondeur de réponse est autorisée.");
                await Send.ErrorsAsync(cancellation: ct);
                return;
            }
        }

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var comment = new GuideComment
        {
            TopicId = topicId,
            UserId = userId.Value,
            Body = body,
            ParentId = req.ParentId,
        };
        db.GuideComments.Add(comment);
        await db.SaveChangesAsync(ct);

        await Send.OkAsync(
            new GuideCommentDto(
                comment.Id,
                comment.TopicId,
                comment.UserId,
                string.IsNullOrWhiteSpace(user.DisplayName) ? user.Email : user.DisplayName!,
                comment.Body,
                comment.ParentId,
                comment.CreatedAt,
                0,
                false
            ),
            ct
        );
    }
}

public class DeleteGuideCommentEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Delete("/guide/comments/{id}");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        if (!Guid.TryParse(Route<string>("id"), out var id))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var comment = await db.GuideComments.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (comment is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        var isAdmin = string.Equals(user?.Role, "admin", StringComparison.OrdinalIgnoreCase);
        if (comment.UserId != userId && !isAdmin)
        {
            await Send.ForbiddenAsync(ct);
            return;
        }

        db.GuideComments.Remove(comment);
        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}

public class ToggleGuideCommentLikeEndpoint(AppDbContext db) : EndpointWithoutRequest<GuideCommentDto>
{
    public override void Configure() => Post("/guide/comments/{id}/like");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        if (!Guid.TryParse(Route<string>("id"), out var id))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var comment = await db.GuideComments
            .Include(c => c.User)
            .Include(c => c.Likes)
            .FirstOrDefaultAsync(c => c.Id == id, ct);
        if (comment is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var existing = comment.Likes.FirstOrDefault(l => l.UserId == userId);
        if (existing is not null)
            db.GuideCommentLikes.Remove(existing);
        else
            db.GuideCommentLikes.Add(new GuideCommentLike { CommentId = comment.Id, UserId = userId.Value });

        await db.SaveChangesAsync(ct);

        var likeCount = await db.GuideCommentLikes.CountAsync(l => l.CommentId == comment.Id, ct);
        var likedByMe = await db.GuideCommentLikes.AnyAsync(l => l.CommentId == comment.Id && l.UserId == userId, ct);

        await Send.OkAsync(
            new GuideCommentDto(
                comment.Id,
                comment.TopicId,
                comment.UserId,
                string.IsNullOrWhiteSpace(comment.User.DisplayName) ? comment.User.Email : comment.User.DisplayName!,
                comment.Body,
                comment.ParentId,
                comment.CreatedAt,
                likeCount,
                likedByMe
            ),
            ct
        );
    }
}
