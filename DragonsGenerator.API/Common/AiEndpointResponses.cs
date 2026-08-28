namespace DragonsGenerator.API.Common;

public static class AiEndpointResponses
{
    /// <summary>Les quotas Groq renvoient 502 pour ne pas déclencher le pop-up limite app (429).</summary>
    public static int StatusCodeFor(GroqChatResult result) => StatusCodes.Status502BadGateway;
}
