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

// The soundboard definition lives in a subfolder of the uploads volume, next to
// the sound files it references, so no extra Docker volume is required
var uploadsPath = Path.Combine(builder.Environment.ContentRootPath, "uploads");
Directory.CreateDirectory(uploadsPath);
var soundboardPath = Path.Combine(uploadsPath, "soundboard");
Directory.CreateDirectory(soundboardPath);
SoundboardService.MigrateLegacyStorage(
    Path.Combine(builder.Environment.ContentRootPath, "soundboard"), soundboardPath);
builder.Services.AddSingleton(new SoundboardService(soundboardPath));

builder.Services.AddSingleton<GameService>();
builder.Services.AddSingleton<AdminAuthService>();

var app = builder.Build();

// Ensure uploads directory exists
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
