namespace DragonsGenerator.API.Tests;

/// <summary>Shared test host — one SQLite DB per run (avoids parallel startup races).</summary>
[CollectionDefinition("ApiIntegration")]
public class ApiIntegrationCollection : ICollectionFixture<CustomWebApplicationFactory>;
