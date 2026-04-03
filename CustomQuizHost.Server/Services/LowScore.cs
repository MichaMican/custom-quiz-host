using System.Text.Json;
using CustomQuizHost.Server.Models;

namespace CustomQuizHost.Server.Services;

public class LowScoreService
{
    private readonly string _filePath;
    private readonly Lock _fileLock = new();
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public LowScoreService(string lowScoresDirectory)
    {
        Directory.CreateDirectory(lowScoresDirectory);
        _filePath = Path.Combine(lowScoresDirectory, "lowscores.json");
    }

    public List<HighScoreEntry> LoadLowScores()
    {
        lock (_fileLock)
        {
            return LoadLowScoresInternal();
        }
    }

    public const int MaxEntries = 5;

    public List<HighScoreEntry> AddLowScore(HighScoreEntry entry)
    {
        lock (_fileLock)
        {
            var entries = LoadLowScoresInternal();
            entries.Add(entry);
            entries = entries
                .OrderBy(e => e.Score)
                .ThenBy(e => e.AchievedAt)
                .Take(MaxEntries)
                .ToList();
            SaveLowScores(entries);
            return entries;
        }
    }

    public List<HighScoreEntry> RemoveLowScore(string entryId)
    {
        lock (_fileLock)
        {
            var entries = LoadLowScoresInternal();
            entries.RemoveAll(e => e.Id == entryId);
            SaveLowScores(entries);
            return entries;
        }
    }

    public List<HighScoreEntry> ClearLowScores()
    {
        lock (_fileLock)
        {
            var empty = new List<HighScoreEntry>();
            SaveLowScores(empty);
            return empty;
        }
    }

    private List<HighScoreEntry> LoadLowScoresInternal()
    {
        if (!File.Exists(_filePath))
            return new List<HighScoreEntry>();

        var json = File.ReadAllText(_filePath);
        return JsonSerializer.Deserialize<List<HighScoreEntry>>(json, JsonOptions)
               ?? new List<HighScoreEntry>();
    }

    private void SaveLowScores(List<HighScoreEntry> entries)
    {
        var json = JsonSerializer.Serialize(entries, JsonOptions);
        File.WriteAllText(_filePath, json);
    }
}
