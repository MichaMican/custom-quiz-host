using Microsoft.AspNetCore.Mvc;

namespace CustomQuizHost.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UploadController : ControllerBase
    {
        private readonly IWebHostEnvironment _env;
        private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".jpg", ".jpeg", ".png", ".gif", ".webp",
            ".mp3", ".wav", ".ogg", ".m4a", ".aac",
            ".mp4", ".webm", ".ogv", ".mov"
        };

        public UploadController(IWebHostEnvironment env)
        {
            _env = env;
        }

        [HttpPost]
        [RequestSizeLimit(50_000_000)] // 50 MB
        public async Task<IActionResult> Upload(IFormFile file, [FromQuery] bool preserveFileName = false)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file provided.");

            var extension = Path.GetExtension(file.FileName);
            if (!AllowedExtensions.Contains(extension))
                return BadRequest("File type not allowed.");

            var uploadsPath = Path.Combine(_env.ContentRootPath, "uploads");
            Directory.CreateDirectory(uploadsPath);

            string fileName;
            if (preserveFileName)
            {
                var originalName = Path.GetFileName(file.FileName);
                var nameWithoutExt = Path.GetFileNameWithoutExtension(originalName);
                if (Guid.TryParse(nameWithoutExt, out _))
                {
                    fileName = originalName;
                }
                else
                {
                    fileName = $"{Guid.NewGuid()}{extension}";
                }
            }
            else
            {
                fileName = $"{Guid.NewGuid()}{extension}";
            }

            var filePath = Path.Combine(uploadsPath, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return Ok(new { fileName });
        }
    }
}
