using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace DragonsGenerator.API.Services;

public static class DbSeeder
{
    public static async Task SeedAsync(IServiceProvider sp)
    {
        using var scope = sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var logger = scope.ServiceProvider.GetService<ILoggerFactory>()?.CreateLogger("DbSeeder");
        await db.Database.EnsureCreatedAsync();
        await DbSchemaUpgrader.EnsureCampaignAndSocialTablesAsync(db);

        var adminOpt = scope.ServiceProvider.GetRequiredService<IOptions<AdminSeedOptions>>().Value;
        var email = (adminOpt.Email ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email)) return;

        if (adminOpt.ResetPassword && !string.IsNullOrWhiteSpace(adminOpt.Password))
        {
            var admins = await db.Users.Where(u => u.Role == AppRoles.Admin).ToListAsync();
            var hash = AuthHelpers.HashPassword(adminOpt.Password);
            if (admins.Count > 0)
            {
                foreach (var admin in admins)
                {
                    admin.PasswordHash = hash;
                    admin.EmailConfirmed = true;
                }
                await db.SaveChangesAsync();
                logger?.LogInformation(
                    "Mot de passe admin réinitialisé pour {Count} compte(s) : {Emails}",
                    admins.Count,
                    string.Join(", ", admins.Select(a => a.Email))
                );
            }
            else
            {
                db.Users.Add(
                    new AppUser
                    {
                        Email = email,
                        DisplayName = "Administrateur",
                        PasswordHash = hash,
                        Role = AppRoles.Admin,
                        EmailConfirmed = true,
                    }
                );
                await db.SaveChangesAsync();
                logger?.LogInformation("Compte admin créé : {Email}", email);
            }
        }
        else
        {
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
        }

        var uploads = Path.Combine(AppContext.BaseDirectory, "data", "uploads", "tickets");
        Directory.CreateDirectory(uploads);
    }
}
