using DragonsGenerator.API.Services;

namespace DragonsGenerator.API.Endpoints.Auth;

public record RegisterRequest(
    string Email,
    string Password,
    string? DisplayName,
    string? WebUrl,
    bool AcceptTerms = false
);
public record LoginRequest(string Email, string Password);
public record ForgotPasswordRequest(string Email, string? WebUrl);
public record ResendConfirmationRequest(string Email, string? WebUrl);
public record ResetPasswordRequest(string Token, string NewPassword);
public record UpdateProfileRequest(string DisplayName, string? Bio, string? AvatarEmoji, string? AccentColor);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public record AuthResponse(string? Token, UserDto User);
