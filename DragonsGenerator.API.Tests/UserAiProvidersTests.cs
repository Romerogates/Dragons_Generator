using DragonsGenerator.API.Common;

namespace DragonsGenerator.API.Tests;

public class UserAiProvidersTests
{
    [Fact]
    public void Known_providers_resolve()
    {
        Assert.True(UserAiProviders.TryGet("openai", out var openai));
        Assert.Equal("gpt-4o-mini", openai.DefaultModel);
        Assert.Contains("openai.com", openai.BaseUrl);

        Assert.Equal("openrouter", UserAiProviders.NormalizeProvider("OpenRouter"));
        Assert.Null(UserAiProviders.NormalizeProvider("anthropic-direct"));
    }

    [Fact]
    public void NormalizeModel_falls_back_to_default()
    {
        Assert.True(UserAiProviders.TryGet("groq", out var groq));
        Assert.Equal(groq.DefaultModel, UserAiProviders.NormalizeModel("  ", groq));
        Assert.Equal("qwen/qwen3.6-27b", groq.DefaultModel);
        Assert.Equal("openai/gpt-oss-20b", UserAiProviders.NormalizeModel("openai/gpt-oss-20b", groq));
    }
}
