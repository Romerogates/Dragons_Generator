namespace DragonsGenerator.API.Endpoints.Support;

internal static class TicketUpload
{
    public static bool TrySave(
        IFormFile file,
        ILogger logger,
        out string? stored,
        out string? original,
        out string? error)
    {
        stored = null;
        original = null;
        error = null;
        if (file.Length > 15 * 1024 * 1024)
        {
            error = "Fichier trop volumineux (max 15 Mo).";
            return false;
        }
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext is not (".pdf" or ".png" or ".jpg" or ".jpeg" or ".webp"))
        {
            error = "Formats acceptés : PDF, PNG, JPG, WEBP.";
            return false;
        }

        original = Path.GetFileName(file.FileName);
        stored = $"{Guid.NewGuid():N}{ext}";
        var dir = Path.Combine(AppContext.BaseDirectory, "data", "uploads", "tickets");
        Directory.CreateDirectory(dir);
        using var fs = File.Create(Path.Combine(dir, stored));
        file.CopyTo(fs);
        logger.LogInformation("Ticket attachment saved {File}", stored);
        return true;
    }
}

