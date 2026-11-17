using System.Text.RegularExpressions;

namespace DragonsGenerator.API.Common;

public static partial class HttpPathNormalizer
{
    [GeneratedRegex(@"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", RegexOptions.CultureInvariant)]
    private static partial Regex GuidToken();

    [GeneratedRegex(@"/\d+(?=/|$)", RegexOptions.CultureInvariant)]
    private static partial Regex NumericId();

    public static string Normalize(string method, string? path)
    {
        var p = string.IsNullOrWhiteSpace(path) ? "/" : path.Trim();
        var q = p.IndexOf('?', StringComparison.Ordinal);
        if (q >= 0) p = p[..q];
        if (p.Length > 1) p = p.TrimEnd('/');
        p = GuidToken().Replace(p, "{id}");
        p = NumericId().Replace(p, "/{id}");
        var verb = string.IsNullOrWhiteSpace(method) ? "GET" : method.ToUpperInvariant();
        return $"{verb} {p}";
    }
}
