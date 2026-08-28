using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace DragonsGenerator.API.Tests;

internal static class ApiTestAuth
{
    internal static async Task<string> LoginAdminAsync(HttpClient client)
    {
        var login = await client.PostAsJsonAsync(
            "/auth/login",
            new { email = "admin@dragons.local", password = "AdminDragons!2026" }
        );
        login.EnsureSuccessStatusCode();
        var auth = await login.Content.ReadFromJsonAsync<JsonElement>();
        var token = auth.GetProperty("token").GetString();
        Assert.False(string.IsNullOrWhiteSpace(token));
        return token!;
    }

    internal static void UseBearer(HttpClient client, string token)
    {
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    internal static void ClearAuth(HttpClient client)
    {
        client.DefaultRequestHeaders.Authorization = null;
    }
}
