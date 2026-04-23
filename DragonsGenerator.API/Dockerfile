# Étape de build
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["DragonsGenerator.API.csproj", "./"]
RUN dotnet restore "DragonsGenerator.API.csproj"
COPY . .
RUN dotnet publish "DragonsGenerator.API.csproj" -c Release -o /app/publish

# Étape finale (exécution)
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "DragonsGenerator.API.dll"]
