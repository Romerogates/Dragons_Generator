using DragonsGenerator.API.Common;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Me;

public record AiProviderDto(string Id, string Label, string DefaultModel, string BaseUrlHint);

public record AiSettingsDto(
    bool Enabled,
    string? Provider,
    string? Model,
    bool HasApiKey,
    string? ApiKeyHint,
    IReadOnlyList<AiProviderDto> Providers
);

public record UpdateAiSettingsRequest(
    bool Enabled,
    string? Provider,
    string? Model,
    string? ApiKey,
    bool ClearApiKey = false
);

public class GetAiSettingsEndpoint(AppDbContext db) : EndpointWithoutRequest<AiSettingsDto>
{
    public override void Configure() => Get("/me/ai-settings");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        await Send.OkAsync(ToDto(user), ct);
    }

    internal static AiSettingsDto ToDto(AppUser user)
    {
        var prefs = UserPreferencesHelper.Parse(user.PreferencesJson);
        string? hint = null;
        // Hint without decrypting: we don't store last4 separately; omit unless we unprotect.
        // Keep HasApiKey only — safer.
        return new AiSettingsDto(
            prefs.AiEnabled,
            prefs.AiProvider,
            prefs.AiModel,
            !string.IsNullOrWhiteSpace(prefs.AiApiKeyProtected),
            hint,
            UserAiProviders.All.Select(p => new AiProviderDto(p.Id, p.Label, p.DefaultModel, p.BaseUrl)).ToList()
        );
    }
}

public class UpdateAiSettingsEndpoint(AppDbContext db, UserAiSecretProtector protector)
    : Endpoint<UpdateAiSettingsRequest, AiSettingsDto>
{
    public override void Configure() => Put("/me/ai-settings");

    public override async Task HandleAsync(UpdateAiSettingsRequest req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var prefs = UserPreferencesHelper.Parse(user.PreferencesJson);
        string? provider = null;
        string? model = null;

        if (req.Enabled)
        {
            provider = UserAiProviders.NormalizeProvider(req.Provider);
            if (provider is null || !UserAiProviders.TryGet(provider, out var info))
            {
                AddError("Choisissez un fournisseur IA valide (OpenAI, Groq, xAI ou OpenRouter).");
                await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
                return;
            }

            model = UserAiProviders.NormalizeModel(req.Model, info);

            var hasExistingKey = !string.IsNullOrWhiteSpace(prefs.AiApiKeyProtected);
            var newKey = (req.ApiKey ?? "").Trim();
            if (req.ClearApiKey)
            {
                AddError("Impossible d'activer votre IA sans clé API.");
                await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
                return;
            }

            if (newKey.Length == 0 && !hasExistingKey)
            {
                AddError("Collez votre clé API pour utiliser votre propre IA.");
                await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
                return;
            }

            if (newKey.Length is > 0 and < 8)
            {
                AddError("Clé API trop courte.");
                await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
                return;
            }

            if (newKey.Length > 512)
            {
                AddError("Clé API trop longue.");
                await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
                return;
            }

            string? protectedKey = null;
            if (newKey.Length > 0)
                protectedKey = protector.Protect(newKey);

            UserPreferencesHelper.ApplyAiSettings(
                user,
                enabled: true,
                provider,
                model,
                apiKeyProtectedOrNullToKeep: protectedKey,
                clearApiKey: false
            );
        }
        else
        {
            // Désactivation : conserve clé/provider pour réactivation facile, sauf ClearApiKey.
            if (req.ClearApiKey)
            {
                UserPreferencesHelper.ClearAiSettings(user);
            }
            else
            {
                provider = UserAiProviders.NormalizeProvider(req.Provider) ?? prefs.AiProvider;
                if (provider is not null && UserAiProviders.TryGet(provider, out var info))
                    model = UserAiProviders.NormalizeModel(req.Model ?? prefs.AiModel, info);
                else
                    model = prefs.AiModel;

                var newKey = (req.ApiKey ?? "").Trim();
                string? protectedKey = null;
                if (newKey.Length >= 8 && newKey.Length <= 512)
                    protectedKey = protector.Protect(newKey);

                UserPreferencesHelper.ApplyAiSettings(
                    user,
                    enabled: false,
                    provider,
                    model,
                    apiKeyProtectedOrNullToKeep: protectedKey,
                    clearApiKey: false
                );
            }
        }

        await db.SaveChangesAsync(ct);
        await Send.OkAsync(GetAiSettingsEndpoint.ToDto(user), ct);
    }
}

public class DeleteAiSettingsEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Delete("/me/ai-settings");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        UserPreferencesHelper.ClearAiSettings(user);
        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
