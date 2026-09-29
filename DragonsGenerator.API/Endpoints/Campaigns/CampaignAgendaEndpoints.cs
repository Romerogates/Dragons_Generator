using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;

public record AgendaEventDto(
    string Id,
    Guid? CampaignId,
    string CampaignTitle,
    string Source,
    string Title,
    DateTimeOffset StartsAt,
    DateTimeOffset? EndsAt,
    bool AllDay,
    string? Kind,
    string? Status,
    string? Location,
    string? CharacterId = null,
    string? CharacterName = null,
    int RsvpYes = 0,
    int RsvpNo = 0,
    int RsvpMaybe = 0);

public record UpsertPersonalAgendaRequest
{
    public string? Id { get; init; }
    public required string Title { get; init; }
    public required DateTimeOffset StartsAt { get; init; }
    public DateTimeOffset? EndsAt { get; init; }
    public bool AllDay { get; init; }
    public string? Kind { get; init; }
    public string? Location { get; init; }
    public string? Notes { get; init; }
    public Guid? CharacterId { get; init; }
}

/// <summary>Agenda global : sessions + dates libres campagnes + dates perso (héros).</summary>
public class GetMyAgendaEndpoint(AppDbContext db) : EndpointWithoutRequest<List<AgendaEventDto>>
{
    public override void Configure() => Get("/me/agenda");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var owned = await db.Campaigns.AsNoTracking()
            .Where(c => c.OwnerUserId == userId && c.ClosedAt == null)
            .Select(c => new { c.Id, c.Title, c.JsonData, IsOwner = true })
            .ToListAsync(ct);

        var joined = await db.CampaignMembers.AsNoTracking()
            .Where(m =>
                m.UserId == userId
                && m.Role == CampaignMemberRoles.Player
                && m.LeftAt == null
                && m.RemovedAt == null
                && m.Campaign.ClosedAt == null)
            .Select(m => new
            {
                Id = m.CampaignId,
                m.Campaign.Title,
                m.Campaign.JsonData,
                IsOwner = false,
            })
            .ToListAsync(ct);

        var seen = new HashSet<Guid>();
        var events = new List<AgendaEventDto>();

        foreach (var row in owned.Concat(joined))
        {
            if (!seen.Add(row.Id)) continue;
            var extracted = CampaignJsonHelpers.ExtractAgendaEvents(
                row.JsonData,
                row.Id,
                row.Title,
                row.IsOwner);
            foreach (var e in extracted)
            {
                events.Add(new AgendaEventDto(
                    e.Id,
                    e.CampaignId,
                    e.CampaignTitle,
                    e.Source,
                    e.Title,
                    e.StartsAt,
                    e.EndsAt,
                    e.AllDay,
                    e.Kind,
                    e.Status,
                    e.Location,
                    null,
                    null,
                    e.RsvpYes,
                    e.RsvpNo,
                    e.RsvpMaybe));
            }
        }

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is not null)
        {
            foreach (var p in UserPreferencesHelper.Parse(user.PreferencesJson).PersonalScheduleEvents)
            {
                if (string.IsNullOrWhiteSpace(p.Id) || !DateTimeOffset.TryParse(p.StartsAt, out var starts))
                    continue;
                DateTimeOffset? ends = null;
                if (!string.IsNullOrWhiteSpace(p.EndsAt) && DateTimeOffset.TryParse(p.EndsAt, out var endsParsed))
                    ends = endsParsed;
                var label = !string.IsNullOrWhiteSpace(p.CharacterName)
                    ? p.CharacterName!
                    : "Perso";
                events.Add(new AgendaEventDto(
                    p.Id,
                    null,
                    label,
                    "personal",
                    string.IsNullOrWhiteSpace(p.Title) ? "Date" : p.Title,
                    starts,
                    ends,
                    p.AllDay,
                    string.IsNullOrWhiteSpace(p.Kind) ? "game" : p.Kind,
                    null,
                    p.Location,
                    p.CharacterId,
                    p.CharacterName));
            }
        }

        events.Sort((a, b) => a.StartsAt.CompareTo(b.StartsAt));
        await Send.OkAsync(events, ct);
    }
}

/// <summary>Crée / met à jour une date agenda personnelle (sans campagne).</summary>
public class UpsertPersonalAgendaEndpoint(AppDbContext db)
    : Endpoint<UpsertPersonalAgendaRequest, AgendaEventDto>
{
    public override void Configure() => Post("/me/agenda/personal");

    public override async Task HandleAsync(UpsertPersonalAgendaRequest req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var title = (req.Title ?? "").Trim();
        if (title.Length is 0 or > 200)
        {
            AddError("Titre invalide.");
            await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
            return;
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        string? characterName = null;
        string? characterIdStr = null;
        if (req.CharacterId is Guid cid)
        {
            var character = await db.Characters.AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == cid && c.UserId == userId, ct);
            if (character is null)
            {
                AddError("Héros introuvable.");
                await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
                return;
            }

            characterIdStr = character.Id.ToString();
            characterName = character.Name;
        }

        var prefs = UserPreferencesHelper.Parse(user.PreferencesJson);
        var id = string.IsNullOrWhiteSpace(req.Id) ? Guid.NewGuid().ToString("N") : req.Id!.Trim();
        var kind = string.IsNullOrWhiteSpace(req.Kind) ? "game" : req.Kind.Trim();
        var ends = req.EndsAt ?? req.StartsAt.AddHours(3);

        var existing = prefs.PersonalScheduleEvents.FindIndex(e =>
            string.Equals(e.Id, id, StringComparison.Ordinal));
        var entry = new PersonalScheduleEvent
        {
            Id = id,
            Title = title,
            StartsAt = req.StartsAt.ToUniversalTime().ToString("O"),
            EndsAt = ends.ToUniversalTime().ToString("O"),
            AllDay = req.AllDay,
            Kind = kind,
            Location = string.IsNullOrWhiteSpace(req.Location) ? null : req.Location.Trim(),
            Notes = string.IsNullOrWhiteSpace(req.Notes) ? null : req.Notes.Trim(),
            CharacterId = characterIdStr,
            CharacterName = characterName,
        };

        if (existing >= 0)
            prefs.PersonalScheduleEvents[existing] = entry;
        else
            prefs.PersonalScheduleEvents.Add(entry);

        user.PreferencesJson = UserPreferencesHelper.Serialize(prefs);
        await db.SaveChangesAsync(ct);

        await Send.OkAsync(
            new AgendaEventDto(
                entry.Id,
                null,
                characterName ?? "Perso",
                "personal",
                entry.Title,
                req.StartsAt.ToUniversalTime(),
                ends.ToUniversalTime(),
                entry.AllDay,
                entry.Kind,
                null,
                entry.Location,
                entry.CharacterId,
                entry.CharacterName),
            ct);
    }
}

public class DeletePersonalAgendaEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Delete("/me/agenda/personal/{id}");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<string>("id");
        if (string.IsNullOrWhiteSpace(id))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var prefs = UserPreferencesHelper.Parse(user.PreferencesJson);
        var removed = prefs.PersonalScheduleEvents.RemoveAll(e =>
            string.Equals(e.Id, id, StringComparison.Ordinal));
        if (removed == 0)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        user.PreferencesJson = UserPreferencesHelper.Serialize(prefs);
        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
