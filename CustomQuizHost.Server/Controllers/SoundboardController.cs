using CustomQuizHost.Server.Middleware;
using CustomQuizHost.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace CustomQuizHost.Server.Controllers
{
    public class AddSoundRequest
    {
        public string Name { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
    }

    public class DeleteSoundRequest
    {
        public string Id { get; set; } = string.Empty;
    }

    [ApiController]
    [Route("api/[controller]")]
    [RequireAdminPassword]
    public class SoundboardController : ControllerBase
    {
        private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".mp3", ".wav", ".ogg", ".m4a", ".aac"
        };

        private readonly IWebHostEnvironment _env;
        private readonly SoundboardService _soundboardService;
        private readonly GameService _gameService;

        public SoundboardController(IWebHostEnvironment env, SoundboardService soundboardService, GameService gameService)
        {
            _env = env;
            _soundboardService = soundboardService;
            _gameService = gameService;
        }

        private string UploadsPath => Path.Combine(_env.ContentRootPath, "uploads");

        [HttpGet]
        public IActionResult List()
        {
            return Ok(_soundboardService.LoadAll());
        }

        [HttpPost]
        public async Task<IActionResult> Add([FromBody] AddSoundRequest request)
        {
            var name = request?.Name?.Trim();
            var fileName = request?.FileName;

            if (string.IsNullOrWhiteSpace(name))
                return BadRequest("A sound name is required.");

            if (string.IsNullOrWhiteSpace(fileName) || Path.GetFileName(fileName) != fileName)
                return BadRequest("Invalid file name.");

            if (!AllowedExtensions.Contains(Path.GetExtension(fileName)))
                return BadRequest("File type not allowed. Upload an audio file.");

            var fullPath = Path.GetFullPath(Path.Combine(UploadsPath, fileName));
            if (!fullPath.StartsWith(Path.GetFullPath(UploadsPath) + Path.DirectorySeparatorChar, StringComparison.Ordinal)
                || !System.IO.File.Exists(fullPath))
            {
                return BadRequest("Uploaded file not found.");
            }

            var sounds = _soundboardService.Add(name, fileName);
            await _gameService.ReloadSoundboard();
            return Ok(sounds);
        }

        [HttpPost("delete")]
        public async Task<IActionResult> Delete([FromBody] DeleteSoundRequest request)
        {
            if (string.IsNullOrWhiteSpace(request?.Id))
                return BadRequest("No sound selected.");

            var (sounds, removed) = _soundboardService.Remove(request.Id);
            if (removed == null)
                return NotFound("Sound not found.");

            await _gameService.ReloadSoundboard();

            // Remove the audio file as well, unless it is still used by another
            // sound or somewhere in the current game.
            if (!IsFileStillInUse(removed.FileName, sounds))
            {
                var fullPath = Path.GetFullPath(Path.Combine(UploadsPath, removed.FileName));
                if (fullPath.StartsWith(Path.GetFullPath(UploadsPath) + Path.DirectorySeparatorChar, StringComparison.Ordinal)
                    && System.IO.File.Exists(fullPath))
                {
                    try
                    {
                        System.IO.File.Delete(fullPath);
                    }
                    catch (IOException)
                    {
                        // Keeping the orphaned file is harmless; it can still be
                        // removed from the media file list.
                    }
                }
            }

            return Ok(sounds);
        }

        private bool IsFileStillInUse(string fileName, List<Models.SoundboardSound> remainingSounds)
        {
            if (remainingSounds.Any(s => string.Equals(s.FileName, fileName, StringComparison.OrdinalIgnoreCase)))
                return true;

            var gameState = _gameService.GameState;
            if (gameState.Players.Any(p => string.Equals(p.AvatarFileName, fileName, StringComparison.OrdinalIgnoreCase)))
                return true;

            return gameState.Categories
                .SelectMany(c => c.Questions)
                .Any(q => string.Equals(q.MediaFileName, fileName, StringComparison.OrdinalIgnoreCase)
                    || string.Equals(q.AnswerImageFileName, fileName, StringComparison.OrdinalIgnoreCase));
        }
    }
}
