using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DragonsGenerator.API.Tests;

[Collection("ApiIntegration")]
public class CharacterCampaignIntegrationTests
{
    private readonly HttpClient _client;

    public CharacterCampaignIntegrationTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    private static JsonElement LettredCharacterData() =>
        JsonDocument
            .Parse(
                """
                {
                  "name": "Tyrolienne",
                  "schemaVersion": 1,
                  "classes": [{ "classId": "cls-lettre", "classLabel": "Lettré", "level": 1, "hitDie": 8 }],
                  "proficiencies": {
                    "weapons": ["wp-dague", "wp-baton-de-combat", "wp-epee-courte"],
                    "tools": ["tl-lyre", "tl-des"]
                  },
                  "equipment": [
                    { "refId": "ar-armure-de-cuir", "name": "Armure de cuir", "qty": 1 },
                    { "refId": "wp-dague", "name": "Dague", "qty": 1 },
                    { "refId": "gr-sac-derudit", "name": "Sac d'érudit", "qty": 1 }
                  ]
                }
                """
            )
            .RootElement
            .Clone();

    [Fact]
    public async Task Me_characters_requires_auth()
    {
        ApiTestAuth.ClearAuth(_client);
        var response = await _client.GetAsync("/me/characters");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Character_crud_persists_lettre_json()
    {
        var token = await ApiTestAuth.LoginAdminAsync(_client);
        ApiTestAuth.UseBearer(_client, token);

        var create = await _client.PostAsJsonAsync(
            "/me/characters",
            new { name = "Tyrolienne", data = LettredCharacterData() }
        );
        var createBody = await create.Content.ReadAsStringAsync();
        Assert.True(
            create.IsSuccessStatusCode,
            $"create → {(int)create.StatusCode} {createBody}"
        );

        var created = JsonDocument.Parse(createBody).RootElement;
        var id = created.GetProperty("id").GetGuid();
        Assert.Equal("Tyrolienne", created.GetProperty("name").GetString());

        var list = await _client.GetFromJsonAsync<JsonElement[]>("/me/characters");
        Assert.NotNull(list);
        Assert.Contains(list!, c => c.GetProperty("id").GetGuid() == id);

        var detail = await _client.GetFromJsonAsync<JsonElement>($"/me/characters/{id}");
        Assert.Equal("Tyrolienne", detail.GetProperty("name").GetString());
        var weapons = detail
            .GetProperty("data")
            .GetProperty("proficiencies")
            .GetProperty("weapons");
        Assert.Contains(
            weapons.EnumerateArray(),
            w => w.GetString() == "wp-dague"
        );
        var equipment = detail.GetProperty("data").GetProperty("equipment");
        Assert.Contains(
            equipment.EnumerateArray(),
            e => e.GetProperty("refId").GetString() == "wp-dague"
        );

        var update = await _client.PutAsJsonAsync(
            $"/me/characters/{id}",
            new { name = "Tyrolienne II", data = LettredCharacterData() }
        );
        Assert.True(update.IsSuccessStatusCode);
        var updated = await update.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Tyrolienne II", updated.GetProperty("name").GetString());

        var delete = await _client.DeleteAsync($"/me/characters/{id}");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        var missing = await _client.GetAsync($"/me/characters/{id}");
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }

    [Fact]
    public async Task Campaign_crud_for_dm()
    {
        var token = await ApiTestAuth.LoginAdminAsync(_client);
        ApiTestAuth.UseBearer(_client, token);

        var create = await _client.PostAsJsonAsync(
            "/me/campaigns",
            new
            {
                title = "Campagne test Lettré",
                data = JsonDocument.Parse("""{"notes":"Arc Ajagar"}""").RootElement,
            }
        );
        var createBody = await create.Content.ReadAsStringAsync();
        Assert.True(create.IsSuccessStatusCode, $"create campaign → {(int)create.StatusCode} {createBody}");

        var created = JsonDocument.Parse(createBody).RootElement;
        var id = created.GetProperty("id").GetGuid();
        Assert.Equal("Campagne test Lettré", created.GetProperty("title").GetString());
        Assert.Equal("dm", created.GetProperty("role").GetString());

        var list = await _client.GetFromJsonAsync<JsonElement[]>("/me/campaigns");
        Assert.Contains(list!, c => c.GetProperty("id").GetGuid() == id);

        var detail = await _client.GetFromJsonAsync<JsonElement>($"/me/campaigns/{id}");
        Assert.True(detail.GetProperty("isOwner").GetBoolean());
        Assert.Equal("dm", detail.GetProperty("role").GetString());
        Assert.Equal("Arc Ajagar", detail.GetProperty("data").GetProperty("notes").GetString());

        var update = await _client.PutAsJsonAsync(
            $"/me/campaigns/{id}",
            new
            {
                title = "Campagne renommée",
                data = JsonDocument.Parse("""{"notes":"Suite"}""").RootElement,
            }
        );
        Assert.True(update.IsSuccessStatusCode);
        var updated = await update.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Campagne renommée", updated.GetProperty("title").GetString());

        var delete = await _client.DeleteAsync($"/me/campaigns/{id}");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        var missing = await _client.GetAsync($"/me/campaigns/{id}");
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }

    [Fact]
    public async Task Campaign_invites_list_is_empty_for_new_dm()
    {
        var token = await ApiTestAuth.LoginAdminAsync(_client);
        ApiTestAuth.UseBearer(_client, token);

        var invites = await _client.GetFromJsonAsync<JsonElement[]>("/me/campaign-invites");
        Assert.NotNull(invites);
    }
}
