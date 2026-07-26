using System.IO.Compression;
using Microsoft.AspNetCore.Mvc;

namespace CustomQuizHost.Server.Controllers
{
    public class MediaSelectionRequest
    {
        public List<string> FileNames { get; set; } = new();
    }

    [ApiController]
    [Route("api/[controller]")]
    public class MediaController : ControllerBase
    {
        private readonly IWebHostEnvironment _env;

        public MediaController(IWebHostEnvironment env)
        {
            _env = env;
        }

        private string UploadsPath => Path.Combine(_env.ContentRootPath, "uploads");

        private string? ResolveSafePath(string fileName)
        {
            // Reject anything that is not a plain file name (path traversal guard)
            if (string.IsNullOrWhiteSpace(fileName) || Path.GetFileName(fileName) != fileName)
                return null;

            var fullPath = Path.GetFullPath(Path.Combine(UploadsPath, fileName));
            if (!fullPath.StartsWith(Path.GetFullPath(UploadsPath) + Path.DirectorySeparatorChar, StringComparison.Ordinal))
                return null;

            return fullPath;
        }

        [HttpGet]
        public IActionResult List()
        {
            var uploadsPath = UploadsPath;
            if (!Directory.Exists(uploadsPath))
                return Ok(Array.Empty<object>());

            var files = new DirectoryInfo(uploadsPath)
                .GetFiles()
                .OrderByDescending(f => f.LastWriteTimeUtc)
                .Select(f => new
                {
                    fileName = f.Name,
                    size = f.Length,
                    lastModified = new DateTimeOffset(f.LastWriteTimeUtc, TimeSpan.Zero)
                });

            return Ok(files);
        }

        [HttpPost("download")]
        public IActionResult Download([FromBody] MediaSelectionRequest request)
        {
            if (request?.FileNames == null || request.FileNames.Count == 0)
                return BadRequest("No files selected.");

            var paths = new List<(string FullPath, string Name)>();
            foreach (var name in request.FileNames.Distinct(StringComparer.OrdinalIgnoreCase))
            {
                var fullPath = ResolveSafePath(name);
                if (fullPath == null)
                    return BadRequest($"Invalid file name: {name}");
                if (!System.IO.File.Exists(fullPath))
                    return NotFound($"File not found: {name}");
                paths.Add((fullPath, Path.GetFileName(fullPath)));
            }

            var stream = new MemoryStream();
            using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, leaveOpen: true))
            {
                foreach (var (fullPath, name) in paths)
                {
                    // Media is already compressed; store without compression for speed
                    archive.CreateEntryFromFile(fullPath, name, CompressionLevel.NoCompression);
                }
            }
            stream.Position = 0;

            var downloadName = $"media-{DateTimeOffset.UtcNow:yyyyMMdd-HHmmss}.zip";
            return File(stream, "application/zip", downloadName);
        }

        [HttpPost("delete")]
        public IActionResult Delete([FromBody] MediaSelectionRequest request)
        {
            if (request?.FileNames == null || request.FileNames.Count == 0)
                return BadRequest("No files selected.");

            var deleted = new List<string>();
            var errors = new List<string>();
            foreach (var name in request.FileNames.Distinct(StringComparer.OrdinalIgnoreCase))
            {
                var fullPath = ResolveSafePath(name);
                if (fullPath == null)
                {
                    errors.Add($"Invalid file name: {name}");
                    continue;
                }

                try
                {
                    if (System.IO.File.Exists(fullPath))
                    {
                        System.IO.File.Delete(fullPath);
                        deleted.Add(name);
                    }
                    else
                    {
                        errors.Add($"File not found: {name}");
                    }
                }
                catch (IOException)
                {
                    errors.Add($"Could not delete: {name}");
                }
            }

            return Ok(new { deleted, errors });
        }
    }
}
