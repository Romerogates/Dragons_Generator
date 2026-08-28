namespace DragonsGenerator.API.Common;

public static class AiEndpointResponses
{
    public static int StatusCodeFor(GroqChatResult result) =>
        result.RateLimited ? StatusCodes.Status429TooManyRequests : StatusCodes.Status502BadGateway;
}
