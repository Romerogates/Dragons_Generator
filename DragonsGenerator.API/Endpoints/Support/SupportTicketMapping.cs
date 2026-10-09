using DragonsGenerator.API.Persistence;

namespace DragonsGenerator.API.Endpoints.Support;

internal static class SupportTicketMapping
{
    public static TicketDto ToDto(
        SupportTicket t,
        string? email,
        int messageCount,
        string? assignedStaffName = null) =>
        new(
            t.Id,
            t.Subject,
            t.Message,
            t.Status,
            t.AttachmentOriginalName,
            t.AttachmentStoredName is null ? null : $"/support/tickets/{t.Id}/attachment",
            t.CharacterId,
            t.CharacterName,
            t.CreatedAt,
            t.UpdatedAt == default ? t.CreatedAt : t.UpdatedAt,
            email,
            t.AdminNotes,
            messageCount,
            t.CampaignId,
            t.CampaignName,
            string.IsNullOrWhiteSpace(t.Category) ? "autre" : t.Category,
            t.AssignedStaffUserId,
            assignedStaffName
        );
}
