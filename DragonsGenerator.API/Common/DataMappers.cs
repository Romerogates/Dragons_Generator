using System.Text.Json;
using DragonsGenerator.API.Models;

namespace DragonsGenerator.API.Common;

public static partial class DataMappers
{
    public static CharacterClass ToCharacterClass(JsonElement detail) =>
        new(GetString(detail, "id"), GetString(detail, "name"), ExtractData(detail, "id", "name"));

    public static Background ToBackground(JsonElement detail) =>
        new(GetString(detail, "id"), GetString(detail, "name"), ExtractData(detail, "id", "name"));

    public static Handicap ToHandicap(JsonElement detail) =>
        new(GetString(detail, "id"), GetString(detail, "name"), ExtractData(detail, "id", "name"));
}
