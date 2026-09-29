using System.Text.Json;
using System.Text.Json.Nodes;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;

public record ScheduleRsvpRequest(string Status);

public record ScheduleRsvpDto(string UserId, string? DisplayName, string Status, DateTimeOffset At);

public class UpsertScheduleRsvpEndpoint(AppDbContext db, CampaignLivePublisher live, PushNotificationService push)
    : Endpoint<ScheduleRsvpRequest, List<ScheduleRsvpDto>>
{
    public override void Configure() => Post("/me/campaigns/{id}/schedule/{eventId}/rsvp");

    public override async Task HandleAsync(ScheduleRsvpRequest req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var status = (req.Status ?? "").Trim().ToLowerInvariant();
        if (status is not ("yes" or "no" or "maybe"))
        {
            AddError("Statut RSVP invalide (yes|no|maybe).");
            await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
            return;
        }

        var campaignId = Route<Guid>("id");
        var eventId = Route<string>("eventId")?.Trim();
        if (string.IsNullOrWhiteSpace(eventId))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var (campaign, membership, isOwner) = await CampaignAccess.LoadAsync(db, campaignId, userId.Value, ct);
        if (campaign is null || !CampaignAccess.CanView(isOwner, membership))
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

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        var displayName = user?.DisplayName ?? "Joueur";

        JsonNode root;
        try
        {
            root = JsonNode.Parse(string.IsNullOrWhiteSpace(campaign.JsonData) ? "{}" : campaign.JsonData)
                ?? new JsonObject();
        }
        catch
        {
            root = new JsonObject();
        }

        var schedule = root["scheduleEvents"] as JsonArray ?? new JsonArray();
        root["scheduleEvents"] = schedule;

        JsonObject? target = null;
        foreach (var node in schedule)
        {
            if (node is not JsonObject obj) continue;
            if (obj["id"]?.GetValue<string>() == eventId)
            {
                target = obj;
                break;
            }
        }

        if (target is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var eventTitle = target["title"]?.GetValue<string>()?.Trim();
        if (string.IsNullOrWhiteSpace(eventTitle)) eventTitle = "Date de table";

        var rsvps = target["rsvps"] as JsonArray ?? new JsonArray();
        target["rsvps"] = rsvps;

        var uid = userId.Value.ToString();
        for (var i = rsvps.Count - 1; i >= 0; i--)
        {
            if (rsvps[i]?["userId"]?.GetValue<string>() == uid)
                rsvps.RemoveAt(i);
        }

        var at = DateTimeOffset.UtcNow;
        rsvps.Add(new JsonObject
        {
            ["userId"] = uid,
            ["displayName"] = displayName,
            ["status"] = status,
            ["at"] = at.ToString("O"),
        });

        campaign.JsonData = root.ToJsonString();
        campaign.UpdatedAt = at;
        await db.SaveChangesAsync(ct);
        await live.NotifyAsync(campaign.Id, campaign.UpdatedAt, CampaignLiveReasons.Campaign, ct);

        if (!isOwner && campaign.OwnerUserId != userId.Value)
        {
            var statusLabel = status switch
            {
                "yes" => "oui",
                "no" => "non",
                _ => "peut-être",
            };
            await CampaignActivityService.LogAsync(
                db,
                campaign.Id,
                userId.Value,
                CampaignActivityKinds.ScheduleRsvp,
                new
                {
                    eventId,
                    eventTitle,
                    status,
                    displayName,
                    ownerUserId = campaign.OwnerUserId,
                    message = $"{displayName} : {statusLabel} pour « {eventTitle} »",
                },
                ct);
            await push.NotifyUserAsync(
                campaign.OwnerUserId,
                "RSVP agenda",
                $"{displayName} a répondu « {statusLabel} » pour « {eventTitle} ».",
                $"/campaigns/{campaign.Id}?tab=calendar&event={Uri.EscapeDataString(eventId)}",
                ct);
        }

        var list = rsvps
            .OfType<JsonObject>()
            .Select(o => new ScheduleRsvpDto(
                o["userId"]?.GetValue<string>() ?? "",
                o["displayName"]?.GetValue<string>(),
                o["status"]?.GetValue<string>() ?? "",
                DateTimeOffset.TryParse(o["at"]?.GetValue<string>(), out var when) ? when : at))
            .Where(x => !string.IsNullOrEmpty(x.UserId))
            .ToList();

        await Send.OkAsync(list, ct);
    }
}
