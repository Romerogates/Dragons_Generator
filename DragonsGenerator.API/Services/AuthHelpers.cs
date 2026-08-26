using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using DragonsGenerator.API.Persistence;
using Microsoft.IdentityModel.Tokens;

namespace DragonsGenerator.API.Services;

public class JwtOptions
{
    public string Key { get; set; } = "CHANGE_ME_DRAGONS_JWT_SECRET_KEY_32CHARS_MIN";
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
    public string Email { get; set; } = "admin@dragons.local";
    public string Password { get; set; } = "AdminDragons!2026";
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
}
