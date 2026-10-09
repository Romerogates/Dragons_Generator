using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Support;

public class AdminSupportInboxCountEndpoint(AppDbContext db) : EndpointWithoutRequest<SupportInboxCountDto>
{
    public override void Configure()
    {
        Get("/admin/support/inbox-count");
        Roles(AppRoles.Admin);
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var count = await SupportInboxHelper.CountWaitingOnStaffAsync(db, ct);
        await Send.OkAsync(new SupportInboxCountDto(count), ct);
    }
}
