using System.Text.Json;

namespace DragonsGenerator.API.Common;

public static class JsonDataLoader
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true
    };

    public static async Task<T?> LoadAsync<T>(string fileName, CancellationToken ct = default)
    {
        var filePath = Path.Combine(AppContext.BaseDirectory, "Data", fileName);
        await using var stream = File.OpenRead(filePath);
        return await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions, ct);
    }
}