using System.Text.Json;
using CustomQuizHost.Server.Models;

namespace CustomQuizHost.Server.Services;

public class HighScoreService
{
    private readonly string _filePath;
    private readonly Lock _fileLock = new();
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public HighScoreService(string highScoresDirectory)
    {
        Directory.CreateDirectory(highScoresDirectory);
        _filePath = Path.Combine(highScoresDirectory, "highscores.json");
    }

    public List<HighScoreEntry> LoadHighScores()
    {
        lock (_fileLock)
        {
            if (!File.Exists(_filePath))
                return new List<HighScoreEntry>();

            var json = File.ReadAllText(_filePath);
            return JsonSerializer.Deserialize<List<HighScoreEntry>>(json, JsonOptions)
                   ?? new List<HighScoreEntry>();
        }
    }

    public const int MaxEntries = 10;

    public List<HighScoreEntry> AddHighScore(HighScoreEntry entry)
    {
        lock (_fileLock)
        {
            var entries = LoadHighScoresInternal();
            entries.Add(entry);
            entries = entries
                .OrderByDescending(e => e.Score)
                .ThenBy(e => e.AchievedAt)
                .Take(MaxEntries)
                .ToList();
            SaveHighScores(entries);
            return entries;
        }
    }

    public List<HighScoreEntry> RemoveHighScore(string entryId)
    {
        lock (_fileLock)
        {
            var entries = LoadHighScoresInternal();
            entries.RemoveAll(e => e.Id == entryId);
            SaveHighScores(entries);
            return entries;
        }
    }

    public List<HighScoreEntry> ClearHighScores()
    {
        lock (_fileLock)
        {
            var empty = new List<HighScoreEntry>();
            SaveHighScores(empty);
            return empty;
        }
    }

    private List<HighScoreEntry> LoadHighScoresInternal()
    {
        if (!File.Exists(_filePath))
            return new List<HighScoreEntry>();

        var json = File.ReadAllText(_filePath);
        return JsonSerializer.Deserialize<List<HighScoreEntry>>(json, JsonOptions)
               ?? new List<HighScoreEntry>();
    }

    private void SaveHighScores(List<HighScoreEntry> entries)
    {
        var json = JsonSerializer.Serialize(entries, JsonOptions);
        File.WriteAllText(_filePath, json);
    }
}
