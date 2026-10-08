namespace DragonsGenerator.API.Services;

public static class SupportTicketRules
{
    public static readonly string[] Categories = ["compte", "bug", "ia", "campagne", "autre"];

    public static string NormalizeCategory(string? raw)
    {
        var value = (raw ?? "").Trim().ToLowerInvariant();
        return Categories.Contains(value) ? value : "autre";
    }

    public static bool WaitingOnStaff(string status, bool? lastFromStaff)
    {
        if (string.Equals(status, "closed", StringComparison.OrdinalIgnoreCase))
            return false;
        return lastFromStaff != true;
    }

    public static bool PlayerHasUnreadStaffReply(string status, bool? lastFromStaff) =>
        !string.Equals(status, "closed", StringComparison.OrdinalIgnoreCase) && lastFromStaff == true;
}
