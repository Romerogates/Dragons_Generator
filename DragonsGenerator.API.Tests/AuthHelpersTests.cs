using System.Security.Claims;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Tests;

public class AuthHelpersTests
{
    private static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public void HashPassword_and_VerifyPassword_roundtrip()
    {
        var hash = AuthHelpers.HashPassword("SecretPass123!");
        Assert.True(AuthHelpers.VerifyPassword("SecretPass123!", hash));
        Assert.False(AuthHelpers.VerifyPassword("wrong", hash));
    }

    [Fact]
    public void NewToken_returns_unique_base64_strings()
    {
        var a = AuthHelpers.NewToken();
        var b = AuthHelpers.NewToken();
        Assert.NotEqual(a, b);
        Assert.True(a.Length > 20);
    }

    [Fact]
    public void CreateJwt_contains_user_claims()
    {
        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = "hero@example.com",
            PasswordHash = "hash",
            DisplayName = "Hero",
            Role = AppRoles.User,
        };
        var jwt = AuthHelpers.CreateJwt(
            user,
            new JwtOptions { Key = "DragonsGenerator_Dev_Jwt_Key_ChangeInProd_32+" }
        );
        Assert.False(string.IsNullOrWhiteSpace(jwt));
        Assert.Contains(".", jwt);
    }

    [Fact]
    public void GetUserId_parses_name_identifier()
    {
        var id = Guid.NewGuid();
        var principal = new ClaimsPrincipal(
            new ClaimsIdentity(
                new[] { new Claim(ClaimTypes.NameIdentifier, id.ToString()) },
                "test"
            )
        );
        Assert.Equal(id, AuthHelpers.GetUserId(principal));
    }

    [Fact]
    public void IsAdmin_detects_admin_role()
    {
        var admin = new ClaimsPrincipal(
            new ClaimsIdentity(new[] { new Claim(ClaimTypes.Role, AppRoles.Admin) }, "test")
        );
        var user = new ClaimsPrincipal(
            new ClaimsIdentity(new[] { new Claim(ClaimTypes.Role, AppRoles.User) }, "test")
        );
        Assert.True(AuthHelpers.IsAdmin(admin));
        Assert.False(AuthHelpers.IsAdmin(user));
    }

    [Fact]
    public void TryNormalizeDisplayName_validates_length()
    {
        Assert.False(AuthHelpers.TryNormalizeDisplayName("a", out _, out var err));
        Assert.Contains("2", err);

        Assert.False(
            AuthHelpers.TryNormalizeDisplayName(new string('x', 65), out _, out err)
        );
        Assert.Contains("64", err);

        Assert.True(AuthHelpers.TryNormalizeDisplayName("  Tyrolienne  ", out var name, out err));
        Assert.Equal("Tyrolienne", name);
        Assert.Null(err);
    }

    [Fact]
    public async Task IsDisplayNameTakenAsync_excludes_current_user()
    {
        await using var db = NewDb();
        var userId = Guid.NewGuid();
        db.Users.Add(
            new AppUser
            {
                Id = userId,
                Email = "a@test.com",
                DisplayName = "Unique",
                PasswordHash = "x",
            }
        );
        await db.SaveChangesAsync();

        Assert.True(await AuthHelpers.IsDisplayNameTakenAsync(db, "Unique", null, CancellationToken.None));
        Assert.False(
            await AuthHelpers.IsDisplayNameTakenAsync(db, "Unique", userId, CancellationToken.None)
        );
        Assert.False(await AuthHelpers.IsDisplayNameTakenAsync(db, "Other", null, CancellationToken.None));
    }

    [Fact]
    public void ResolveWebUrl_prefers_valid_absolute_request_url()
    {
        var configured = "https://dragons-generator.top";
        Assert.Equal(
            "http://localhost:8081",
            AuthHelpers.ResolveWebUrl("http://localhost:8081/", configured)
        );
        Assert.Equal(configured, AuthHelpers.ResolveWebUrl("not-a-url", configured));
        Assert.Equal(configured, AuthHelpers.ResolveWebUrl(null, configured));
    }
}
