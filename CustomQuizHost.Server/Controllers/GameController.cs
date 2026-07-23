using System.IO.Compression;
using System.Text.Json;
using CustomQuizHost.Server.Models;
using CustomQuizHost.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace CustomQuizHost.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GameController : ControllerBase
{
    private const long MaxArchiveSize = 400_000_000;
    private const long MaxJsonSize = 20_000_000;
    private readonly GameService _gameService;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<GameController> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };
    private static readonly HashSet<string> AllowedMediaExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".gif", ".webp",
        ".mp3", ".wav", ".ogg", ".m4a", ".aac",
        ".mp4", ".webm", ".ogv", ".mov", ".wmv"
    };

    public GameController(
        GameService gameService,
        IWebHostEnvironment env,
        ILogger<GameController> logger)
    {
        _gameService = gameService;
        _env = env;
        _logger = logger;
    }

    [HttpGet("export")]
    public IActionResult Export()
    {
        return Ok(_gameService.GameState);
    }

    [HttpGet("export/archive")]
    public async Task<IActionResult> ExportArchive([FromQuery] bool questionsOnly = false)
    {
        var state = _gameService.GameState;
        var jsonFileName = questionsOnly ? "quiz-questions.json" : "quiz-game.json";
        var downloadName = questionsOnly ? "quiz-questions.zip" : "quiz-game.zip";
        var json = questionsOnly
            ? JsonSerializer.SerializeToUtf8Bytes(new { categories = state.Categories }, JsonOptions)
            : JsonSerializer.SerializeToUtf8Bytes(state, JsonOptions);
        var tempPath = Path.Combine(Path.GetTempPath(), Path.GetRandomFileName());

        try
        {
            await using (var output = new FileStream(
                tempPath,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                1024 * 1024,
                FileOptions.Asynchronous | FileOptions.SequentialScan))
            using (var archive = new ZipArchive(output, ZipArchiveMode.Create))
            {
                var jsonEntry = archive.CreateEntry(jsonFileName, CompressionLevel.NoCompression);
                await using (var jsonStream = jsonEntry.Open())
                {
                    await jsonStream.WriteAsync(json);
                }

                var uploadsPath = Path.Combine(_env.ContentRootPath, "uploads");
                foreach (var fileName in CollectMediaFileNames(state.Categories))
                {
                    var sourcePath = Path.Combine(uploadsPath, fileName);
                    if (!System.IO.File.Exists(sourcePath))
                    {
                        continue;
                    }

                    var mediaEntry = archive.CreateEntry($"media/{fileName}", CompressionLevel.NoCompression);
                    await using var source = new FileStream(
                        sourcePath,
                        FileMode.Open,
                        FileAccess.Read,
                        FileShare.Read,
                        1024 * 1024,
                        FileOptions.Asynchronous | FileOptions.SequentialScan);
                    await using var destination = mediaEntry.Open();
                    await source.CopyToAsync(destination);
                }
            }
        }
        catch
        {
            TryDeleteTemporaryFile(tempPath);
            throw;
        }

        Response.OnCompleted(() =>
        {
            TryDeleteTemporaryFile(tempPath);
            return Task.CompletedTask;
        });
        return PhysicalFile(tempPath, "application/zip", downloadName, enableRangeProcessing: true);
    }

    [HttpPost("import/archive")]
    [RequestSizeLimit(MaxArchiveSize)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxArchiveSize)]
    public async Task<IActionResult> ImportArchive(
        IFormFile file,
        [FromQuery] bool questionsOnly = false,
        CancellationToken cancellationToken = default)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest("No file provided.");
        }

        if (!string.Equals(Path.GetExtension(file.FileName), ".zip", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("Only ZIP archives are supported.");
        }

        await using var input = file.OpenReadStream();
        using var archive = new ZipArchive(input, ZipArchiveMode.Read);
        var jsonFileName = questionsOnly ? "quiz-questions.json" : "quiz-game.json";
        var jsonEntry = archive.GetEntry(jsonFileName);
        if (jsonEntry is null || jsonEntry.Length > MaxJsonSize)
        {
            return BadRequest($"The ZIP file does not contain a valid {jsonFileName} file.");
        }

        GameState? state = null;
        List<Category>? categories;
        await using (var jsonStream = jsonEntry.Open())
        {
            if (questionsOnly)
            {
                var data = await JsonSerializer.DeserializeAsync<QuestionsArchive>(
                    jsonStream,
                    JsonOptions,
                    cancellationToken);
                categories = data?.Categories;
            }
            else
            {
                state = await JsonSerializer.DeserializeAsync<GameState>(
                    jsonStream,
                    JsonOptions,
                    cancellationToken);
                categories = state?.Categories;
            }
        }

        if (categories is null || (questionsOnly && categories.Count == 0))
        {
            return BadRequest("The selected file does not contain valid questions.");
        }

        var mediaEntries = archive.Entries
            .Where(entry => IsValidMediaEntry(entry))
            .ToList();
        if (mediaEntries.Sum(entry => entry.Length) > MaxArchiveSize)
        {
            return BadRequest("The archive contains too much media.");
        }

        var fileNameMap = await ExtractMediaFiles(mediaEntries, cancellationToken);
        RemapMediaFileNames(categories, fileNameMap);

        return questionsOnly
            ? Ok(new { categories })
            : Ok(new { gameState = state });
    }

    private static HashSet<string> CollectMediaFileNames(IEnumerable<Category> categories)
    {
        return categories
            .SelectMany(category => category.Questions)
            .SelectMany(question => new[] { question.MediaFileName, question.AnswerImageFileName })
            .Where(fileName => !string.IsNullOrWhiteSpace(fileName))
            .Select(fileName => Path.GetFileName(fileName!))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    private static bool IsValidMediaEntry(ZipArchiveEntry entry)
    {
        if (entry.Length == 0 || !entry.FullName.StartsWith("media/", StringComparison.Ordinal))
        {
            return false;
        }

        var relativeName = entry.FullName["media/".Length..];
        return relativeName.Length > 0
            && !relativeName.Contains('/')
            && !relativeName.Contains('\\')
            && AllowedMediaExtensions.Contains(Path.GetExtension(relativeName));
    }

    private async Task<Dictionary<string, string>> ExtractMediaFiles(
        IEnumerable<ZipArchiveEntry> entries,
        CancellationToken cancellationToken)
    {
        var uploadsPath = Path.Combine(_env.ContentRootPath, "uploads");
        Directory.CreateDirectory(uploadsPath);
        var fileNameMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var entry in entries)
        {
            var originalName = entry.FullName["media/".Length..];
            var storedName = GetStoredMediaFileName(originalName);
            var destinationPath = Path.Combine(uploadsPath, storedName);

            await using var source = entry.Open();
            await using var destination = new FileStream(
                destinationPath,
                FileMode.Create,
                FileAccess.Write,
                FileShare.None,
                1024 * 1024,
                FileOptions.Asynchronous | FileOptions.SequentialScan);
            await source.CopyToAsync(destination, cancellationToken);
            fileNameMap[originalName] = storedName;
        }

        return fileNameMap;
    }

    private static string GetStoredMediaFileName(string originalName)
    {
        var nameWithoutExtension = Path.GetFileNameWithoutExtension(originalName);
        return Guid.TryParse(nameWithoutExtension, out _)
            ? originalName
            : $"{Guid.NewGuid()}{Path.GetExtension(originalName)}";
    }

    private void TryDeleteTemporaryFile(string path)
    {
        try
        {
            System.IO.File.Delete(path);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            _logger.LogWarning(exception, "Failed to delete temporary game archive {ArchivePath}", path);
        }
    }

    private static void RemapMediaFileNames(
        IEnumerable<Category> categories,
        IReadOnlyDictionary<string, string> fileNameMap)
    {
        foreach (var question in categories.SelectMany(category => category.Questions))
        {
            if (question.MediaFileName is not null
                && fileNameMap.TryGetValue(question.MediaFileName, out var mediaFileName))
            {
                question.MediaFileName = mediaFileName;
            }

            if (question.AnswerImageFileName is not null
                && fileNameMap.TryGetValue(question.AnswerImageFileName, out var answerImageFileName))
            {
                question.AnswerImageFileName = answerImageFileName;
            }
        }
    }

    private sealed class QuestionsArchive
    {
        public List<Category> Categories { get; set; } = [];
    }
}
