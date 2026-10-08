using System.Net.Http.Json;

namespace DragonsGenerator.API.Services;

/// <summary>
/// Charge le modèle Ollama au démarrage pour que le premier token d’une vraie génération arrive vite.
/// </summary>
public sealed class OllamaWarmupWorker(
    IHttpClientFactory http,
    IConfiguration config,
    ILogger<OllamaWarmupWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!config.GetValue("LocalLlm:Enabled", false))
            return;

        try
        {
            await Task.Delay(TimeSpan.FromSeconds(8), stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        var openaiBase = (config["LocalLlm:BaseUrl"] ?? "http://ollama:11434/v1").TrimEnd('/');
        var native = openaiBase.EndsWith("/v1", StringComparison.OrdinalIgnoreCase)
            ? openaiBase[..^3]
            : openaiBase;
        var model = config["LocalLlm:Model"] ?? "qwen2.5:3b";

        try
        {
            var client = http.CreateClient("LocalLlm");
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            cts.CancelAfter(TimeSpan.FromSeconds(90));
            using var response = await client.PostAsJsonAsync(
                $"{native}/api/generate",
                new
                {
                    model,
                    prompt = ".",
                    stream = false,
                    keep_alive = "60m",
                    options = new { num_predict = 1 },
                },
                cts.Token);
            logger.LogInformation("Ollama warmup HTTP {Status} ({Model})", (int)response.StatusCode, model);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Ollama warmup ignoré — Groq prendra le relais si le local est mort");
        }
    }
}
