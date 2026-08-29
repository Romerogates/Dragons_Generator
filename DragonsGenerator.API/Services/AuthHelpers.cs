using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using DragonsGenerator.API.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace DragonsGenerator.API.Services;

public class JwtOptions
{
    public string Key { get; set; } = "";
    public string Issuer { get; set; } = "DragonsGenerator";
    public string Audience { get; set; } = "DragonsGeneratorWeb";
    public int ExpireHours { get; set; } = 72;
}

public class AppUrlOptions
{
    /// <summary>URL publique du front (liens de confirmation / reset).</summary>
    public string PublicWebUrl { get; set; } = "http://localhost:8081";
}

public class AdminSeedOptions
{
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
    /// <summary>Si true au démarrage : met à jour le mot de passe du compte admin (Admin__Email) uniquement.</summary>
    public bool ResetPassword { get; set; }
}

/// <summary>Comptes de test créés automatiquement en Development (stack Docker locale).</summary>
public class DevSeedOptions
{
    public bool Enabled { get; set; }
    public List<DevSeedUser> Users { get; set; } = [];
}

public class DevSeedUser
{
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
    public string? DisplayName { get; set; }
}

public static class AuthHelpers
{
    public static string HashPassword(string password) => BCrypt.Net.BCrypt.HashPassword(password);

    public static bool VerifyPassword(string password, string hash) =>
        BCrypt.Net.BCrypt.Verify(password, hash);

    public static string NewToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

    public static string CreateJwt(AppUser user, JwtOptions opt)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, user.Role),
            new("display_name", user.DisplayName ?? ""),
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(opt.Key));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: opt.Issuer,
            audience: opt.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(opt.ExpireHours),
            signingCredentials: creds
        );
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public static Guid? GetUserId(ClaimsPrincipal user)
    {
        var raw = user.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(raw, out var id) ? id : null;
    }

    public static bool IsAdmin(ClaimsPrincipal user) => user.IsInRole(AppRoles.Admin);

    public static bool TryNormalizeDisplayName(string? raw, out string normalized, out string? error)
    {
        normalized = (raw ?? "").Trim();
        if (normalized.Length < 2)
        {
            error = "Pseudo obligatoire (2–64 caractères).";
            return false;
        }
        if (normalized.Length > 64)
        {
            error = "Pseudo trop long (64 caractères max).";
            return false;
        }
        error = null;
        return true;
    }

    public static Task<bool> IsDisplayNameTakenAsync(
        AppDbContext db,
        string displayName,
        Guid? excludeUserId,
        CancellationToken ct
    )
    {
        var lower = displayName.ToLowerInvariant();
        return db.Users.AnyAsync(
            u => u.DisplayName.ToLower() == lower && (!excludeUserId.HasValue || u.Id != excludeUserId.Value),
            ct
        );
    }

  /// <param name="allowRequestWebUrl">
  /// En production, toujours false : ignore le webUrl client (anti-phishing / account takeover).
  /// En développement, true permet ng serve sur un autre port que PublicWebUrl.
  /// </param>
    public static string ResolveWebUrl(
        string? requestWebUrl,
        string configuredUrl,
        bool allowRequestWebUrl = false
    )
    {
        if (
            allowRequestWebUrl
            && !string.IsNullOrWhiteSpace(requestWebUrl)
            && Uri.TryCreate(requestWebUrl, UriKind.Absolute, out var uri)
            && uri.Scheme is "http" or "https"
        )
        {
            return requestWebUrl.TrimEnd('/');
        }

        return configuredUrl.TrimEnd('/');
    }
}
