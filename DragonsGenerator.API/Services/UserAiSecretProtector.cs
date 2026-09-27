using Microsoft.AspNetCore.DataProtection;

namespace DragonsGenerator.API.Services;

/// <summary>Chiffre / déchiffre les clés API utilisateur (ASP.NET Data Protection).</summary>
public sealed class UserAiSecretProtector(IDataProtectionProvider provider)
{
    private readonly IDataProtector _protector = provider.CreateProtector("DragonsGenerator.UserAiApiKey.v1");

    public string Protect(string plainApiKey) => _protector.Protect(plainApiKey);

    public string? Unprotect(string? protectedPayload)
    {
        if (string.IsNullOrWhiteSpace(protectedPayload)) return null;
        try
        {
            return _protector.Unprotect(protectedPayload);
        }
        catch
        {
            return null;
        }
    }
}
