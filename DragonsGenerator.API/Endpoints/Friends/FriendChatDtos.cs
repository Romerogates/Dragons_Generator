namespace DragonsGenerator.API.Endpoints.Friends;

public record FriendMessageDto(
    Guid Id,
    Guid SenderId,
    string SenderDisplayName,
    Guid RecipientId,
    string Body,
    string? AttachmentKind,
    string? AttachmentPayload,
    DateTimeOffset CreatedAt,
    bool IsMine
);

public record SendFriendMessageBody(string? Body, string? AttachmentKind, string? AttachmentPayload);

public record FriendChatSummaryDto(
    Guid FriendUserId,
    string FriendDisplayName,
    string? LastMessagePreview,
    DateTimeOffset? LastMessageAt,
    int UnreadCount
);
