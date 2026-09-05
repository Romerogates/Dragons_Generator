using DragonsGenerator.API.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace DragonsGenerator.API.Tests;

public class ProductionConfigGuardTests
{
    [Fact]
    public void EnsureValid_allows_development_with_weak_defaults()
    {
        var config = BuildConfig(
            new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "DragonsGenerator_Dev_Jwt_Key_ChangeInProd_32+",
                ["Admin:Email"] = "admin@dragons.local",
                ["Admin:Password"] = "AdminDragons!2026",
            }
        );
        var env = new HostEnvironment { EnvironmentName = Environments.Development };

        var ex = Record.Exception(() => ProductionConfigGuard.EnsureValid(config, env));
        Assert.Null(ex);
    }

    [Fact]
    public void EnsureValid_rejects_production_with_default_jwt_key()
    {
        var config = BuildConfig(
            new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "DragonsGenerator_Dev_Jwt_Key_ChangeInProd_32+",
                ["Admin:Email"] = "admin@example.com",
                ["Admin:Password"] = "StrongPassword!2026",
                ["Smtp:Host"] = "smtp.mail.ovh.net",
            }
        );
        var env = new HostEnvironment { EnvironmentName = Environments.Production };

        var ex = Assert.Throws<InvalidOperationException>(
            () => ProductionConfigGuard.EnsureValid(config, env)
        );
        Assert.Contains("Jwt__Key", ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void EnsureValid_rejects_production_with_default_admin_password()
    {
        var config = BuildConfig(
            new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "this-is-a-valid-production-jwt-secret-key",
                ["Admin:Email"] = "admin@example.com",
                ["Admin:Password"] = "AdminDragons!2026",
            }
        );
        var env = new HostEnvironment { EnvironmentName = Environments.Production };

        var ex = Assert.Throws<InvalidOperationException>(
            () => ProductionConfigGuard.EnsureValid(config, env)
        );
        Assert.Contains("Admin__Password", ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void EnsureValid_accepts_production_with_strong_secrets()
    {
        var config = BuildConfig(
            new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "this-is-a-valid-production-jwt-secret-key",
                ["Admin:Email"] = "admin@example.com",
                ["Admin:Password"] = "StrongPassword!2026",
                ["Smtp:Host"] = "smtp.mail.ovh.net",
            }
        );
        var env = new HostEnvironment { EnvironmentName = Environments.Production };

        var ex = Record.Exception(() => ProductionConfigGuard.EnsureValid(config, env));
        Assert.Null(ex);
    }

    [Fact]
    public void EnsureValid_rejects_production_with_mailhog_smtp_host()
    {
        var config = BuildConfig(
            new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "this-is-a-valid-production-jwt-secret-key",
                ["Admin:Email"] = "admin@example.com",
                ["Admin:Password"] = "StrongPassword!2026",
                ["Smtp:Host"] = "mailhog",
            }
        );
        var env = new HostEnvironment { EnvironmentName = Environments.Production };

        var ex = Assert.Throws<InvalidOperationException>(
            () => ProductionConfigGuard.EnsureValid(config, env)
        );
        Assert.Contains("Smtp__Host", ex.Message, StringComparison.Ordinal);
    }

    private static IConfiguration BuildConfig(Dictionary<string, string?> values)
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(values)
            .Build();
    }

    private sealed class HostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Production;
        public string ApplicationName { get; set; } = "DragonsGenerator.API.Tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } =
            new NullFileProvider();
    }
}
