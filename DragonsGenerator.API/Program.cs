using FastEndpoints;
using FastEndpoints.Swagger;

var builder = WebApplication.CreateBuilder(args);

// Services
builder.Services
    .AddFastEndpoints()
    .SwaggerDocument(o =>
    {
        o.DocumentSettings = s =>
        {
            s.Title = "DragonsGenerator API";
            s.Version = "v1";
        };
    });
builder.Services.AddHttpClient(); // <-- Ajoute ça pour Groq

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// Middlewares
app.UseCors("AllowAngular");
app.UseFastEndpoints();
app.UseSwaggerGen();

app.Run();
