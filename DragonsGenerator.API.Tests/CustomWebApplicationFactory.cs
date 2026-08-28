using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace DragonsGenerator.API.Tests;

public sealed class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _dbPath = Path.Combine(Path.GetTempPath(), $"dragons-test-{Guid.NewGuid():N}.db");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");

        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Default"] = $"Data Source={_dbPath}",
                    ["Smtp:Host"] = "log",
                    ["Jwt:Key"] = "DragonsGenerator_Dev_Jwt_Key_ChangeInProd_32+",
                    ["Jwt:Issuer"] = "DragonsGenerator",
                    ["Jwt:Audience"] = "DragonsGeneratorWeb",
                    ["Admin:Email"] = "admin@dragons.local",
                    ["Admin:Password"] = "AdminDragons!2026",
                    ["Admin:ResetPassword"] = "false",
                    ["App:PublicWebUrl"] = "http://localhost:8081",
                }
            );
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        try
        {
            if (File.Exists(_dbPath))
                File.Delete(_dbPath);
        }
        catch
        {
            // ignore cleanup errors in CI / Windows file locks
        }
    }
}
