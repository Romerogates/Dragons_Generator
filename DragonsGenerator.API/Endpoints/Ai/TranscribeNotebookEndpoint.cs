using DragonsGenerator.API.Common;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.RateLimiting;

namespace DragonsGenerator.API.Endpoints.Ai;

public record TranscribeNotebookRequest
{
    /// <summary>Data URL image/jpeg ou image/png (canvas carnet).</summary>
    public required string ImageDataUrl { get; init; }
}

public record TranscribeNotebookResponse(string Text);

public class TranscribeNotebookEndpoint(HybridAiService ai) : Endpoint<TranscribeNotebookRequest, TranscribeNotebookResponse>
{
    public override void Configure()
    {
        Post("/ai/transcribe-notebook");
        AllowAnonymous();
        Options(b => b.RequireRateLimiting(RateLimitPolicies.AiGeneration));
    }

    public override async Task HandleAsync(TranscribeNotebookRequest req, CancellationToken ct)
    {
        var dataUrl = req.ImageDataUrl?.Trim() ?? "";
        if (dataUrl.Length < 32 || !dataUrl.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
        {
            AddError("ImageDataUrl", "Image invalide (data URL image attendue).");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        if (dataUrl.Length > 5_500_000)
        {
            AddError("ImageDataUrl", "Image trop volumineuse.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        var result = await ai.TranscribeInkAsync(dataUrl, ct);
        if (!result.Ok || string.IsNullOrWhiteSpace(result.Text))
        {
            AddError(result.Error ?? "Transcription impossible.");
            await Send.ErrorsAsync(AiEndpointResponses.StatusCodeFor(result), ct);
            return;
        }

        await Send.OkAsync(new TranscribeNotebookResponse(result.Text.Trim()), ct);
    }
}
