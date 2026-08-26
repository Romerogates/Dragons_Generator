using System.Collections.Concurrent;
using System.Text.Json;

namespace DragonsGenerator.API.Common;

/// <summary>
/// Charge les données depuis Data/index/ + fichiers détaillés, avec cache mémoire.
/// </summary>
public sealed class IndexedDataStore
{
    private readonly string _dataRoot;
    private readonly ConcurrentDictionary<string, JsonElement> _cache = new();

    public static JsonSerializerOptions JsonOptions { get; } = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true
    };

    public IndexedDataStore()
    {
        _dataRoot = Path.Combine(AppContext.BaseDirectory, "Data");
    }

    public async Task<JsonElement> LoadFileAsync(string relativePath, CancellationToken ct = default)
    {
        var normalized = relativePath.Replace('\\', '/');
        if (_cache.TryGetValue(normalized, out var cached))
            return cached;

        var fullPath = Path.Combine(_dataRoot, normalized.Replace('/', Path.DirectorySeparatorChar));
        if (!File.Exists(fullPath))
            throw new FileNotFoundException($"Fichier de données introuvable : {relativePath}", fullPath);

        await using var stream = File.OpenRead(fullPath);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        var clone = doc.RootElement.Clone();
        _cache[normalized] = clone;
        return clone;
    }

    public async Task<List<JsonElement>> GetIndexEntriesAsync(
        string indexRelativePath,
        string entriesProperty,
        CancellationToken ct = default)
    {
        var index = await LoadFileAsync(indexRelativePath, ct);
        if (!index.TryGetProperty(entriesProperty, out var entries) || entries.ValueKind != JsonValueKind.Array)
            return [];

        return entries.EnumerateArray().Select(e => e.Clone()).ToList();
    }

    public async Task<JsonElement?> LoadDetailFromEntryAsync(JsonElement indexEntry, CancellationToken ct = default)
    {
        if (!indexEntry.TryGetProperty("file", out var fileProp))
            return null;

        var file = fileProp.GetString();
        if (string.IsNullOrWhiteSpace(file))
            return null;

        try
        {
            return await LoadFileAsync(file, ct);
        }
        catch (FileNotFoundException)
        {
            // Un fichier manquant ne doit pas faire échouer tout le catalogue.
            return null;
        }
    }

    public async Task<List<JsonElement>> LoadAllDetailsFromIndexAsync(
        string indexRelativePath,
        string entriesProperty,
        CancellationToken ct = default)
    {
        var entries = await GetIndexEntriesAsync(indexRelativePath, entriesProperty, ct);
        var tasks = entries.Select(e => LoadDetailFromEntryAsync(e, ct));
        var results = await Task.WhenAll(tasks);
        return results.Where(r => r.HasValue).Select(r => r!.Value).ToList();
    }

    public async Task<JsonElement?> LoadDetailByIdFromIndexAsync(
        string indexRelativePath,
        string entriesProperty,
        string id,
        CancellationToken ct = default)
    {
        var entries = await GetIndexEntriesAsync(indexRelativePath, entriesProperty, ct);
        var entry = entries.FirstOrDefault(e =>
            e.TryGetProperty("id", out var idProp) &&
            string.Equals(idProp.GetString(), id, StringComparison.OrdinalIgnoreCase));

        if (entry.ValueKind == JsonValueKind.Undefined)
            return null;

        return await LoadDetailFromEntryAsync(entry, ct);
    }

    public void ClearCache() => _cache.Clear();
}
