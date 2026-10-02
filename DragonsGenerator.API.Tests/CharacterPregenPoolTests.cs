using DragonsGenerator.API.Services;

namespace DragonsGenerator.API.Tests;

public class CharacterPregenPoolTests
{
    [Fact]
    public void IsPoolRecord_detects_flag()
    {
        Assert.True(CharacterPregenPool.IsPoolRecord("""{"name":"A","isPregenPool":true}"""));
        Assert.False(CharacterPregenPool.IsPoolRecord("""{"name":"A"}"""));
        Assert.False(CharacterPregenPool.IsPoolRecord(null));
    }

    [Fact]
    public void StripPoolFlag_removes_property()
    {
        var stripped = CharacterPregenPool.StripPoolFlag("""{"name":"A","isPregenPool":true,"x":1}""");
        Assert.False(CharacterPregenPool.IsPoolRecord(stripped));
        Assert.Contains("\"name\":\"A\"", stripped);
        Assert.Contains("\"x\":1", stripped);
    }
}
