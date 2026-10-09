namespace DragonsGenerator.API.Endpoints.Support;

internal static class TicketFileNames
{
    public static string ContentTypeForExtension(string ext) =>
        ext switch
        {
            ".pdf" => "application/pdf",
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            _ => "application/octet-stream",
        };

    public static string Sanitize(string? name, string fallback = "piece-jointe")
    {
        var cleaned = string.Join(
            "_",
            (name ?? fallback).Split(Path.GetInvalidFileNameChars(), StringSplitOptions.RemoveEmptyEntries)
        ).Trim();
        return string.IsNullOrWhiteSpace(cleaned) ? fallback : cleaned;
    }
}
