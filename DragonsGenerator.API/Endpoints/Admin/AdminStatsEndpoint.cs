using DragonsGenerator.API.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Admin;

public record AdminStatsKindDto(string Kind, int Total, int Ok);

public record AdminStatsDto(
    int Users,
    int ConfirmedUsers,
    int GoogleUsers,
    int UsersLast7Days,
    int Characters,
    int CharactersLast7Days,
    int Campaigns,
    int CampaignsActive,
    int CampaignsLast7Days,
    int CampaignMembers,
    int Dungeons,
    int DungeonsLast7Days,
    int FriendshipsAccepted,
    int FriendMessages,
    int SupportTickets,
    int SupportMessages,
    int GuideComments,
    int Generations,
    int GenerationsOk,
    int GenerationsLast24h,
    int GenerationsLast7Days,
    List<AdminStatsKindDto> GenerationsByKind
);

public class AdminStatsEndpoint(AppDbContext db) : EndpointWithoutRequest<AdminStatsDto>
{
    public override void Configure()
    {
        Get("/admin/stats");
        Roles(AppRoles.Admin);
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var d7 = now.AddDays(-7);
        var d1 = now.AddHours(-24);

        var users = await db.Users.AsNoTracking().ToListAsync(ct);
        var characters = await db.Characters.AsNoTracking().Select(c => c.CreatedAt).ToListAsync(ct);
        var campaigns = await db.Campaigns.AsNoTracking()
            .Select(c => new { c.CreatedAt, c.ClosedAt })
            .ToListAsync(ct);
        var dungeons = await db.Dungeons.AsNoTracking().Select(d => d.CreatedAt).ToListAsync(ct);
        var gens = await db.AiGenerationLogs.AsNoTracking().ToListAsync(ct);

        var byKind = gens
            .GroupBy(g => string.IsNullOrWhiteSpace(g.Kind) ? "autre" : g.Kind)
            .OrderBy(g => g.Key)
            .Select(g => new AdminStatsKindDto(g.Key, g.Count(), g.Count(x => x.Ok)))
            .ToList();

        await Send.OkAsync(
            new AdminStatsDto(
                users.Count,
                users.Count(u => u.EmailConfirmed),
                users.Count(u => !string.IsNullOrWhiteSpace(u.GoogleSubject)),
                users.Count(u => u.CreatedAt >= d7),
                characters.Count,
                characters.Count(c => c >= d7),
                campaigns.Count,
                campaigns.Count(c => c.ClosedAt is null),
                campaigns.Count(c => c.CreatedAt >= d7),
                await db.CampaignMembers.AsNoTracking().CountAsync(ct),
                dungeons.Count,
                dungeons.Count(d => d >= d7),
                await db.Friendships.AsNoTracking().CountAsync(f => f.Status == FriendStatuses.Accepted, ct),
                await db.FriendMessages.AsNoTracking().CountAsync(ct),
                await db.SupportTickets.AsNoTracking().CountAsync(ct),
                await db.SupportTicketMessages.AsNoTracking().CountAsync(ct),
                await db.GuideComments.AsNoTracking().CountAsync(ct),
                gens.Count,
                gens.Count(g => g.Ok),
                gens.Count(g => g.CreatedAt >= d1),
                gens.Count(g => g.CreatedAt >= d7),
                byKind
            ),
            ct);
    }
}
