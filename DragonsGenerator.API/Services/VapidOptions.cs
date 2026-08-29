namespace DragonsGenerator.API.Services;

public class VapidOptions
{
    public string PublicKey { get; set; } = "";
    public string PrivateKey { get; set; } = "";
    public string Subject { get; set; } = "mailto:noreply@dragons-generator.top";
}
