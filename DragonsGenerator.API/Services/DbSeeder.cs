using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DragonsGenerator.API.Services;

public static class DbSeeder
{
    public static async Task SeedAsync(IServiceProvider sp)
    {
        using var scope = sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.EnsureCreatedAsync();
        await DbSchemaUpgrader.EnsureCampaignAndSocialTablesAsync(db);

        var adminOpt = scope.ServiceProvider.GetRequiredService<IOptions<AdminSeedOptions>>().Value;
        var email = (adminOpt.Email ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email)) return;

        var existing = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (existing is null)
        {
            db.Users.Add(
                new AppUser
                {
                    Email = email,
                    DisplayName = "Administrateur",
                    PasswordHash = AuthHelpers.HashPassword(adminOpt.Password),
                    Role = AppRoles.Admin,
                    EmailConfirmed = true,
                }
            );
            await db.SaveChangesAsync();
        }
        else if (existing.Role != AppRoles.Admin)
        {
            existing.Role = AppRoles.Admin;
            existing.EmailConfirmed = true;
            await db.SaveChangesAsync();
        }

        var uploads = Path.Combine(AppContext.BaseDirectory, "data", "uploads", "tickets");
        Directory.CreateDirectory(uploads);
    }
}
