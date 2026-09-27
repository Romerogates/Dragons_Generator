namespace DragonsGenerator.API.Services;

public static class SessionReminderRules
{
    public const string Kind24Hours = "24h";
    public const string Kind1Hour = "1h";

    /// <summary>Fenêtre de 30 min autour du rappel (poll toutes les 5 min).</summary>
    public static bool ShouldSend(DateTimeOffset sessionAt, DateTimeOffset now, string kind)
    {
        var delta = sessionAt - now;
        return kind switch
        {
            Kind24Hours => delta.TotalHours is >= 23.5 and <= 24.5,
            Kind1Hour => delta.TotalMinutes is >= 55 and <= 65,
            _ => false,
        };
    }

    public static (string Title, string Body) BuildMessage(
        PlannedSessionInfo session,
        string kind,
        bool isScheduleEvent = false)
    {
        var when = session.ScheduledAt.ToLocalTime().ToString("dddd d MMM · HH:mm", new System.Globalization.CultureInfo("fr-FR"));
        var loc = string.IsNullOrWhiteSpace(session.Location) ? "" : $" · {session.Location}";
        var body = $"{session.Title} · {when}{loc}";
        var title = (kind, isScheduleEvent) switch
        {
            (Kind24Hours, false) => "Session demain",
            (Kind1Hour, false) => "Session dans 1 h",
            (Kind24Hours, true) => "Table demain",
            (Kind1Hour, true) => "Table dans 1 h",
            (_, false) => "Session à venir",
            _ => "Date de table à venir",
        };
        return (title, body);
    }
}
