using Microsoft.AspNetCore.Http;

namespace DragonsGenerator.API.Services;

public static class AuthCookieHelper
{
    public const string CookieName = "dg_session";

    public static void SetAuthCookie(HttpResponse response, string jwt, JwtOptions opt, bool secure)
    {
        response.Cookies.Append(CookieName, jwt, BuildOptions(opt, secure));
    }

    public static void ClearAuthCookie(HttpResponse response, bool secure)
    {
        response.Cookies.Delete(CookieName, new CookieOptions
        {
            Path = "/",
            Secure = secure,
            SameSite = SameSiteMode.Lax,
        });
    }

    private static CookieOptions BuildOptions(JwtOptions opt, bool secure) => new()
    {
        HttpOnly = true,
        Secure = secure,
        SameSite = SameSiteMode.Lax,
        Path = "/",
        Expires = DateTimeOffset.UtcNow.AddHours(opt.ExpireHours),
    };
}
