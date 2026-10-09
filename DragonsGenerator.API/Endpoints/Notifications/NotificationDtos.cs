namespace DragonsGenerator.API.Endpoints.Notifications;

public record NotificationItemDto(
    string Key,
    string Kind,
    string Title,
    string Message,
    string ActionPath,
    DateTimeOffset CreatedAt
);

public record NotificationsSummaryDto(
    int FriendsActionCount,
    int CampaignsActionCount,
    int TotalCount,
    List<NotificationItemDto> Notifications,
    int SupportInboxCount = 0
);
