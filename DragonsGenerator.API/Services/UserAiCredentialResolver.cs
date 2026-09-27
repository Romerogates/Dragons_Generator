using DragonsGenerator.API.Common;
using DragonsGenerator.API.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Services;

public sealed class UserAiCredentialResolver(AppDbContext db, UserAiSecretProtector protector)
{
    public async Task<UserLlmCredentials?> ResolveAsync(Guid? userId, CancellationToken ct)
    {
        if (userId is null) return null;

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId.Value, ct);
        if (user is null) return null;

        var prefs = UserPreferencesHelper.Parse(user.PreferencesJson);
        if (!prefs.AiEnabled) return null;
        if (!UserAiProviders.TryGet(prefs.AiProvider, out var provider)) return null;

        var apiKey = protector.Unprotect(prefs.AiApiKeyProtected);
        if (string.IsNullOrWhiteSpace(apiKey)) return null;

        var model = UserAiProviders.NormalizeModel(prefs.AiModel, provider);
        return new UserLlmCredentials(provider.Id, apiKey.Trim(), provider.BaseUrl, model);
    }
}
