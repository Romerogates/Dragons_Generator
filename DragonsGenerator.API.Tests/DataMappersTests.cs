using System.Text.Json;
using DragonsGenerator.API.Common;

namespace DragonsGenerator.API.Tests;

public class DataMappersTests
{
    private static JsonElement El(string json) => JsonDocument.Parse(json).RootElement.Clone();

    [Theory]
    [InlineData("", 0)]
    [InlineData("   ", 0)]
    [InlineData("d8", 0)]
    [InlineData("1d8", 8)]
    [InlineData("1D10", 0)]
    [InlineData("2d12", 12)]
    public void ParseHitDie_reads_die_size(string raw, int expected)
    {
        Assert.Equal(expected, DataMappers.ParseHitDie(raw));
    }

    [Fact]
    public void GetNullableInt_reads_number_or_null()
    {
        var obj = El("""{"value":7,"text":"x"}""");
        Assert.Equal(7, DataMappers.GetNullableInt(obj, "value"));
        Assert.Null(DataMappers.GetNullableInt(obj, "text"));
        Assert.Null(DataMappers.GetNullableInt(obj, "missing"));
    }

    [Fact]
    public void ToCharacterClass_keeps_id_name_and_extra_data()
    {
        var mapped = DataMappers.ToCharacterClass(El("""{"id":"guerrier","name":"Guerrier","hit_die":"1d10"}"""));
        Assert.Equal("guerrier", mapped.Id);
        Assert.Equal("Guerrier", mapped.Name);
        Assert.Equal("1d10", mapped.Data.GetProperty("hit_die").GetString());
        Assert.False(mapped.Data.TryGetProperty("id", out _));
    }

    [Fact]
    public void ToEquipment_maps_cost_weight_and_fallback_type()
    {
        var withCost = DataMappers.ToEquipment(El("""
            {"id":"epee","name":"Épée","category":"arme","subcategory":"martiale","cost":{"value":15,"unit":"po"},"weight_kg":1.5}
            """));
        Assert.Equal("arme", withCost.Type);
        Assert.Equal("martiale", withCost.Subtype);
        Assert.Equal(15, withCost.Cost.V);
        Assert.Equal("po", withCost.Cost.U);
        Assert.Equal(1.5, withCost.WKg);

        var bare = DataMappers.ToEquipment(El("""{"id":"x","name":"X"}"""));
        Assert.Equal("unknown", bare.Type);
        Assert.Equal("po", bare.Cost.U);
        Assert.Null(bare.WKg);
    }

    [Fact]
    public void ToSpell_maps_components_and_empty_lists()
    {
        var spell = DataMappers.ToSpell(El("""
            {"id":"boule","name":"Boule de feu","level":3,"school":"évocation","description":"Boom","components":{"v":true,"s":true,"m":"baton"}}
            """));
        Assert.Equal(3, spell.Level);
        Assert.True(spell.Components.V);
        Assert.Equal("baton", spell.Components.M);
        Assert.Empty(spell.Classes);
        Assert.Empty(spell.ModularOptions);
    }

    [Fact]
    public void ToCreature_skips_non_object_abilities()
    {
        var creature = DataMappers.ToCreature(El("""
            {
              "id":"gob","name":"Gobelin","category":"humanoïde","armor_class":13,
              "abilities":{"for":{"score":8,"modifier":"-1"},"bad":"nope"}
            }
            """));
        Assert.Equal(13, creature.ArmorClass);
        Assert.Equal(8, creature.Abilities["for"].Score);
        Assert.False(creature.Abilities.ContainsKey("bad"));
        Assert.Equal("0", creature.ChallengeRating);
    }

    [Fact]
    public void ToSkill_and_ToCombatAction_map_flags()
    {
        var skill = DataMappers.ToSkill(El("""
            {"id":"perc","name":"Perception","ability":"sag","description":"voir","examples":["guet"],"passive_check":true}
            """));
        Assert.True(skill.PassiveCheck);
        Assert.Equal(["guet"], skill.Examples);

        var action = DataMappers.ToCombatAction(El("""
            {"id":"dash","name":"Dash","action_cost":"action","category":"mouvement"}
            """));
        Assert.Equal("action", action.ActionCost);
        Assert.Null(action.Mechanics);
    }

    [Fact]
    public void ToSpecies_reads_speed_m_and_empty_source()
    {
        var species = DataMappers.ToSpecies(El("""
            {"id":"humain","name":"Humain","base_stats":{"speed_m":9,"size":"M","age":{},"alignment":{}},"languages":{}}
            """));
        Assert.Equal(9, species.BaseStats.SpeedM);
        Assert.Equal("M", species.BaseStats.Size);
        Assert.Equal("", species.Source.Book);
    }

    [Fact]
    public void ToCivilisation_defaults_when_sections_missing()
    {
        var civ = DataMappers.ToCivilisation(El("""{"id":"c1","name":"Cité"}"""));
        Assert.Equal(0, civ.Randomization.DiceMin);
        Assert.Empty(civ.Demographics.PrimarySpecies);
        Assert.False(civ.Demographics.IsCosmopolitan);
    }
}
