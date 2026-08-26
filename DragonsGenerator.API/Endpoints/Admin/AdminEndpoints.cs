using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DragonsGenerator.API.Endpoints.Admin;

/// <summary>
/// Vue admin d'un compte. Le mot de passe n'est JAMAIS renvoyé en clair (hash irréversible).
/// </summary>
public record AdminUserDto(
    Guid Id,
    string Email,
    string DisplayName,
    string Role,
    bool EmailConfirmed,
    DateTimeOffset CreatedAt,
    DateTimeOffset? LastLoginAt,
    int CharacterCount,
    string PasswordStatus
);

public record AdminUpdateUserRequest(
    string? Email,
    string? DisplayName,
    string? Role,
    string? NewPassword,
    bool? EmailConfirmed
);

public class AdminListUsersEndpoint(AppDbContext db) : EndpointWithoutRequest<List<AdminUserDto>>
{
    public override void Configure()
    {
        Get("/admin/users");
        Roles(AppRoles.Admin);
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var users = await db.Users.AsNoTracking()
            .Select(u => new
            {
                u.Id,
                u.Email,
                u.DisplayName,
                u.Role,
                u.EmailConfirmed,
                u.CreatedAt,
                u.LastLoginAt,
                CharacterCount = u.Characters.Count,
            })
            .ToListAsync(ct);

        await Send.OkAsync(
            users
                .OrderByDescending(u => u.CreatedAt)
                .Select(u => new AdminUserDto(
                    u.Id,
                    u.Email,
                    u.DisplayName,
                    u.Role,
                    u.EmailConfirmed,
                    u.CreatedAt,
                    u.LastLoginAt,
                    u.CharacterCount,
                    "Hashé (non visible — utilisez « Nouveau mot de passe »)"
                ))
                .ToList(),
            ct
        );
    }
}

public class AdminUpdateUserEndpoint(AppDbContext db) : Endpoint<AdminUpdateUserRequest, AdminUserDto>
{
    public override void Configure()
    {
        Put("/admin/users/{id}");
        Roles(AppRoles.Admin);
    }

    public override async Task HandleAsync(AdminUpdateUserRequest req, CancellationToken ct)
    {
        var id = Route<Guid>("id");
        var user = await db.Users.Include(u => u.Characters).FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (!string.IsNullOrWhiteSpace(req.Email))
        {
            var email = req.Email.Trim().ToLowerInvariant();
            if (await db.Users.AnyAsync(u => u.Email == email && u.Id != id, ct))
            {
                AddError("Cet email est déjà utilisé.");
                await Send.ErrorsAsync(cancellation: ct);
                return;
            }
            user.Email = email;
        }
        if (req.DisplayName is not null)
            user.DisplayName = req.DisplayName.Trim();
        if (!string.IsNullOrWhiteSpace(req.Role) &&
            (req.Role == AppRoles.Admin || req.Role == AppRoles.User))
            user.Role = req.Role;
        if (req.EmailConfirmed is not null)
            user.EmailConfirmed = req.EmailConfirmed.Value;
        if (!string.IsNullOrWhiteSpace(req.NewPassword))
        {
            if (req.NewPassword.Length < 8)
            {
                AddError("Mot de passe : 8 caractères minimum.");
                await Send.ErrorsAsync(cancellation: ct);
                return;
            }
            user.PasswordHash = AuthHelpers.HashPassword(req.NewPassword);
            user.PasswordResetToken = null;
            user.PasswordResetExpires = null;
        }

        await db.SaveChangesAsync(ct);
        await Send.OkAsync(
            new AdminUserDto(
                user.Id,
                user.Email,
                user.DisplayName,
                user.Role,
                user.EmailConfirmed,
                user.CreatedAt,
                user.LastLoginAt,
                user.Characters.Count,
                "Hashé (non visible — utilisez « Nouveau mot de passe »)"
            ),
            ct
        );
    }
}

public class AdminSendResetEmailEndpoint(
    AppDbContext db,
    IEmailSender email,
    IOptions<AppUrlOptions> appUrl,
    ILogger<AdminSendResetEmailEndpoint> logger
) : EndpointWithoutRequest
{
    public override void Configure()
    {
        Post("/admin/users/{id}/send-reset-email");
        Roles(AppRoles.Admin);
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var id = Route<Guid>("id");
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        user.PasswordResetToken = AuthHelpers.NewToken();
        user.PasswordResetExpires = DateTimeOffset.UtcNow.AddHours(2);
        await db.SaveChangesAsync(ct);

        var link =
            $"{appUrl.Value.PublicWebUrl.TrimEnd('/')}/reset-password?token={Uri.EscapeDataString(user.PasswordResetToken)}";
        try
        {
            await email.SendAsync(
                user.Email,
                "Réinitialisation du mot de passe (admin) — Dragons Generator",
                $"""
                <h2>Réinitialisation demandée par un administrateur</h2>
                <p><a href="{link}">Choisir un nouveau mot de passe</a></p>
                """,
                ct
            );
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Admin reset email failed");
            AddError("Impossible d'envoyer l'email (SMTP).");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        await Send.OkAsync(new { message = $"Email de reset envoyé à {user.Email}." }, ct);
    }
}
