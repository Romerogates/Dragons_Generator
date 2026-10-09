using System.Security.Claims;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DragonsGenerator.API.Endpoints.Auth;


public class UpdateProfileEndpoint(AppDbContext db) : Endpoint<UpdateProfileRequest, UserDto>
{
    public override void Configure()
    {
        Patch("/auth/me");
    }

    public override async Task HandleAsync(UpdateProfileRequest req, CancellationToken ct)
    {
        var id = AuthHelpers.GetUserId(User);
        if (id is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var name = (req.DisplayName ?? "").Trim();
        if (!AuthHelpers.TryNormalizeDisplayName(name, out var normalized, out var nameError))
        {
            AddError(nameError!);
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nameChanged = !string.Equals(user.DisplayName, normalized, StringComparison.Ordinal);

        if (
            nameChanged
            && await AuthHelpers.IsDisplayNameTakenAsync(db, normalized, user.Id, ct)
        )
        {
            AddError("Ce pseudo est déjà pris.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        if (nameChanged)
        {
            var prefs = UserPreferencesHelper.Parse(user.PreferencesJson);
            if (
                prefs.DisplayNameChangedAt is { } lastChange
                && lastChange.AddDays(7) > DateTimeOffset.UtcNow
            )
            {
                var next = lastChange.AddDays(7);
                AddError(
                    $"Vous pourrez changer votre pseudo à nouveau le {next.ToLocalTime():dd/MM/yyyy à HH:mm} (1 fois par semaine)."
                );
                await Send.ErrorsAsync(cancellation: ct);
                return;
            }

            prefs.DisplayNameChangedAt = DateTimeOffset.UtcNow;
            user.PreferencesJson = UserPreferencesHelper.Serialize(prefs);
        }

        user.DisplayName = normalized;

        if (!UserProfileHelper.TryNormalizeBio(req.Bio, out var bio, out var bioError))
        {
            AddError(bioError!);
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        if (!UserProfileHelper.TryNormalizeAvatarEmoji(req.AvatarEmoji, out var avatar, out var avatarError))
        {
            AddError(avatarError!);
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        user.Bio = bio;
        user.AvatarEmoji = avatar;
        user.AccentColor = UserProfileHelper.NormalizeAccentColor(req.AccentColor);

        await db.SaveChangesAsync(ct);
        await Send.OkAsync(UserProfileHelper.ToUserDto(user), ct);
    }
}
