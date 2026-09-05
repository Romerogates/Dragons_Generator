namespace DragonsGenerator.API.Services;

/// <summary>Refuse le démarrage en production si JWT ou admin utilisent des valeurs par défaut connues.</summary>
public static class ProductionConfigGuard
{
    private static readonly HashSet<string> WeakJwtKeys =
        new(StringComparer.Ordinal)
        {
            "",
            "CHANGE_ME_DRAGONS_JWT_SECRET_KEY_32CHARS_MIN",
            "DragonsGenerator_Dev_Jwt_Key_ChangeInProd_32+",
            "CHANGE_ME_LONG_RANDOM_STRING",
            "CHANGE_ME_LONG_RANDOM_STRING_MIN_32_CHARS",
        };

    private static readonly HashSet<string> WeakAdminPasswords =
        new(StringComparer.Ordinal)
        {
            "",
            "AdminDragons!2026",
            "ChangeMeStrong!",
        };

    public static void EnsureValid(IConfiguration config, IHostEnvironment env)
    {
        if (!env.IsProduction())
            return;

        var jwtKey = config["Jwt:Key"] ?? "";
        if (jwtKey.Length < 32 || WeakJwtKeys.Contains(jwtKey))
        {
            throw new InvalidOperationException(
                "Production : définissez Jwt__Key dans .env (min. 32 caractères, secret unique)."
            );
        }

        var adminEmail = (config["Admin:Email"] ?? "").Trim();
        if (string.IsNullOrWhiteSpace(adminEmail))
        {
            throw new InvalidOperationException(
                "Production : définissez Admin__Email dans .env."
            );
        }

        var adminPassword = config["Admin:Password"] ?? "";
        if (adminPassword.Length < 12 || WeakAdminPasswords.Contains(adminPassword))
        {
            throw new InvalidOperationException(
                "Production : définissez Admin__Password dans .env (min. 12 caractères, pas le mot de passe dev)."
            );
        }

        var allowLogSink = string.Equals(config["Smtp:AllowLogSink"], "true", StringComparison.OrdinalIgnoreCase);
        var smtpHost = (config["Smtp:Host"] ?? "").Trim();
        if (!allowLogSink && (string.IsNullOrWhiteSpace(smtpHost)
            || smtpHost.Equals("log", StringComparison.OrdinalIgnoreCase)
            || smtpHost.Equals("mailhog", StringComparison.OrdinalIgnoreCase)
            || smtpHost.Equals("localhost", StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException(
                "Production : définissez Smtp__Host (pas log/mailhog/localhost). Smtp__AllowLogSink=true pour forcer le sink de logs."
            );
        }
    }
}
