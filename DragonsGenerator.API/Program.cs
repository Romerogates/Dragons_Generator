using System.Text;
using DragonsGenerator.API.Common;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using FastEndpoints.Swagger;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

// --- Options ---
builder.Services.Configure<SmtpOptions>(builder.Configuration.GetSection("Smtp"));
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<AppUrlOptions>(builder.Configuration.GetSection("App"));
builder.Services.Configure<AdminSeedOptions>(builder.Configuration.GetSection("Admin"));

var jwtOpt = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
var smtpHost = builder.Configuration["Smtp:Host"] ?? "log";

// --- Persistence ---
var dbPath = builder.Configuration["ConnectionStrings:Default"]
    ?? $"Data Source={Path.Combine(AppContext.BaseDirectory, "data", "dragons.db")}";
Directory.CreateDirectory(Path.Combine(AppContext.BaseDirectory, "data"));
Directory.CreateDirectory(Path.Combine(AppContext.BaseDirectory, "data", "uploads", "tickets"));

builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlite(dbPath.StartsWith("Data Source=")
    ? dbPath
    : $"Data Source={dbPath}"));

// --- Email ---
if (string.Equals(smtpHost, "log", StringComparison.OrdinalIgnoreCase))
    builder.Services.AddSingleton<IEmailSender, LoggingEmailSender>();
else
    builder.Services.AddSingleton<IEmailSender, SmtpEmailSender>();

// --- Auth JWT ---
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtOpt.Issuer,
            ValidAudience = jwtOpt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOpt.Key)),
            ClockSkew = TimeSpan.FromMinutes(2),
        };
    });
builder.Services.AddAuthorization();

// --- Game data ---
builder.Services.AddSingleton<IndexedDataStore>();
builder.Services.AddSingleton<GameDataRepository>();
builder.Services.AddSingleton<GroqChatClient>();
builder.Services.AddHttpClient("Groq", client =>
{
    client.Timeout = TimeSpan.FromSeconds(120);
});

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

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.WebHost.ConfigureKestrel(o =>
{
    o.Limits.MaxRequestBodySize = 25 * 1024 * 1024; // 25 MB (PDF tickets)
});

var app = builder.Build();

await DbSeeder.SeedAsync(app.Services);

var uploadsRoot = Path.Combine(AppContext.BaseDirectory, "data", "uploads");
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsRoot),
    RequestPath = "/uploads",
});

app.UseCors("AllowAngular");
app.UseAuthentication();
app.UseAuthorization();
app.UseFastEndpoints(c =>
{
    c.Errors.UseProblemDetails();
});
app.UseSwaggerGen();

app.Run();

public partial class Program { }
