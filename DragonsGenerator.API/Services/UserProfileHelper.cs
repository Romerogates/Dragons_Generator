using DragonsGenerator.API.Persistence;

namespace DragonsGenerator.API.Services;

public static class UserProfileHelper
{
    public static readonly HashSet<string> AccentColors =
    [
        "violet",
        "amber",
        "emerald",
        "sky",
        "rose",
        "fuchsia",
    ];

    public static string NormalizeAccentColor(string? raw) =>
        AccentColors.Contains(raw ?? "") ? raw! : "violet";

    public static bool TryNormalizeBio(string? raw, out string? bio, out string? error)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            bio = null;
            error = null;
            return true;
        }

        bio = raw.Trim();
        if (bio.Length > 280)
        {
            error = "La bio ne peut pas dépasser 280 caractères.";
            bio = null;
            return false;
        }

        error = null;
        return true;
    }

    public static bool TryNormalizeAvatarEmoji(string? raw, out string? emoji, out string? error)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            emoji = null;
            error = null;
            return true;
        }

        emoji = raw.Trim();
        if (emoji.Length > 64)
        {
            error = "Emoji d'avatar invalide.";
            emoji = null;
            return false;
        }

        error = null;
        return true;
    }

    public static UserDto ToUserDto(AppUser user) =>
        new(
            user.Id,
            user.Email,
            user.DisplayName,
            user.Role,
            user.EmailConfirmed,
            user.Bio,
            user.AvatarEmoji,
            NormalizeAccentColor(user.AccentColor),
            user.CreatedAt
        );

    public static PublicUserProfileDto ToPublicProfile(
        AppUser user,
        bool isSelf,
        bool isFriend
    ) =>
        new(
            user.Id,
            user.DisplayName,
            user.Bio,
            user.AvatarEmoji,
            NormalizeAccentColor(user.AccentColor),
            user.CreatedAt,
            isSelf,
            isFriend
        );
}

public record UserDto(
    Guid Id,
    string Email,
    string DisplayName,
    string Role,
    bool EmailConfirmed,
    string? Bio,
    string? AvatarEmoji,
    string AccentColor,
    DateTimeOffset MemberSince
);

public record PublicUserProfileDto(
    Guid Id,
    string DisplayName,
    string? Bio,
    string? AvatarEmoji,
    string AccentColor,
    DateTimeOffset MemberSince,
    bool IsSelf,
    bool IsFriend
);
