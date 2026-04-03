using CustomQuizHost.Server.Hubs;
using CustomQuizHost.Server.Middleware;
using CustomQuizHost.Server.Services;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddSignalR();

// Register HighScoreService with a separate storage path for Docker volume mounting
var highScoresPath = Path.Combine(builder.Environment.ContentRootPath, "highscores");
Directory.CreateDirectory(highScoresPath);
builder.Services.AddSingleton(new HighScoreService(highScoresPath));

// Register LowScoreService with a separate storage path for Docker volume mounting
var lowScoresPath = Path.Combine(builder.Environment.ContentRootPath, "lowscores");
Directory.CreateDirectory(lowScoresPath);
builder.Services.AddSingleton(new LowScoreService(lowScoresPath));

builder.Services.AddSingleton<GameService>();

var app = builder.Build();

// Ensure uploads directory exists
var uploadsPath = Path.Combine(app.Environment.ContentRootPath, "uploads");
Directory.CreateDirectory(uploadsPath);

app.UseDefaultFiles();
app.MapStaticAssets();

// Capture ServerSendTime just before response bytes are written for /api/buzzer/sync
app.UseMiddleware<TimeSyncMiddleware>();

// Serve uploaded media files
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsPath),
    RequestPath = "/uploads"
});

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();
app.MapHub<GameHub>("/gamehub");
app.MapFallbackToFile("/index.html");

app.Run();
