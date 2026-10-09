namespace DragonsGenerator.API.Endpoints.Support;

public record TicketDto(
    Guid Id,
    string Subject,
    string Message,
    string Status,
    string? AttachmentOriginalName,
    string? AttachmentUrl,
    Guid? CharacterId,
    string? CharacterName,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    string? UserEmail,
    string? AdminNotes,
    int MessageCount,
    Guid? CampaignId = null,
    string? CampaignName = null,
    string Category = "autre",
    Guid? AssignedStaffUserId = null,
    string? AssignedStaffName = null
);

public record TicketMessageDto(
    Guid Id,
    bool FromStaff,
    string Body,
    DateTimeOffset CreatedAt,
    Guid? CharacterId = null,
    string? CharacterName = null,
    string? AttachmentOriginalName = null,
    Guid? CampaignId = null,
    string? CampaignName = null,
    bool EmailSent = true
);

public record TicketThreadDto(TicketDto Ticket, List<TicketMessageDto> Messages, bool CanEmailPlayer = false);

public record PostTicketMessageRequest(string Body, Guid? CharacterId = null, Guid? CampaignId = null);

public record SupportInboxCountDto(int WaitingOnStaff);

public record UpdateTicketRequest(string? Status, string? AdminNotes);

