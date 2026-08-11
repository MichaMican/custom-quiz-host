using System.Text.Json;
using CustomQuizHost.Server.Models;

namespace CustomQuizHost.Server.Services;

/// <summary>
/// Stores the soundboard definition (sound name + uploaded file name) on the
/// file system so the soundboard survives server restarts. The audio files
/// themselves live in the regular uploads folder.
/// </summary>
public class SoundboardService
{
    private readonly string _filePath;
    private readonly Lock _fileLock = new();
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public SoundboardService(string soundboardDirectory)
    {
        Directory.CreateDirectory(soundboardDirectory);
        _filePath = Path.Combine(soundboardDirectory, "soundboard.json");
    }

    public List<SoundboardSound> LoadAll()
    {
        lock (_fileLock)
        {
            return LoadInternal();
        }
    }

    public List<SoundboardSound> Add(string name, string fileName)
    {
        lock (_fileLock)
        {
            var sounds = LoadInternal();
            sounds.Add(new SoundboardSound { Name = name, FileName = fileName });
            Save(sounds);
            return sounds;
        }
    }

    public (List<SoundboardSound> Sounds, SoundboardSound? Removed) Remove(string id)
    {
        lock (_fileLock)
        {
            var sounds = LoadInternal();
            var removed = sounds.FirstOrDefault(s => s.Id == id);
            if (removed != null)
            {
                sounds.Remove(removed);
                Save(sounds);
            }
            return (sounds, removed);
        }
    }

    private List<SoundboardSound> LoadInternal()
    {
        if (!File.Exists(_filePath))
            return new List<SoundboardSound>();

        try
        {
            var json = File.ReadAllText(_filePath);
            return JsonSerializer.Deserialize<List<SoundboardSound>>(json, JsonOptions)
                ?? new List<SoundboardSound>();
        }
        catch (JsonException)
        {
            // File is corrupted or in an unknown format — start fresh
            return new List<SoundboardSound>();
        }
    }

    private void Save(List<SoundboardSound> sounds)
    {
        var json = JsonSerializer.Serialize(sounds, JsonOptions);
        File.WriteAllText(_filePath, json);
    }
}
