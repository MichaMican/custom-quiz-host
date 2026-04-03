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

    public const int MaxEntries = 5;

    public ScoreBoardData LoadAll()
    {
        lock (_fileLock)
        {
            return LoadInternal();
        }
    }

    public ScoreBoardData AddHighScore(HighScoreEntry entry)
    {
        lock (_fileLock)
        {
            var data = LoadInternal();
            data.HighScores.Add(entry);
            data.HighScores = data.HighScores
                .OrderByDescending(e => e.Score)
                .ThenBy(e => e.AchievedAt)
                .Take(MaxEntries)
                .ToList();
            Save(data);
            return data;
        }
    }

    public ScoreBoardData RemoveHighScore(string entryId)
    {
        lock (_fileLock)
        {
            var data = LoadInternal();
            data.HighScores.RemoveAll(e => e.Id == entryId);
            Save(data);
            return data;
        }
    }

    public ScoreBoardData ClearHighScores()
    {
        lock (_fileLock)
        {
            var data = LoadInternal();
            data.HighScores.Clear();
            Save(data);
            return data;
        }
    }

    public ScoreBoardData AddLowScore(HighScoreEntry entry)
    {
        lock (_fileLock)
        {
            var data = LoadInternal();
            data.LowScores.Add(entry);
            data.LowScores = data.LowScores
                .OrderBy(e => e.Score)
                .ThenBy(e => e.AchievedAt)
                .Take(MaxEntries)
                .ToList();
            Save(data);
            return data;
        }
    }

    public ScoreBoardData RemoveLowScore(string entryId)
    {
        lock (_fileLock)
        {
            var data = LoadInternal();
            data.LowScores.RemoveAll(e => e.Id == entryId);
            Save(data);
            return data;
        }
    }

    public ScoreBoardData ClearLowScores()
    {
        lock (_fileLock)
        {
            var data = LoadInternal();
            data.LowScores.Clear();
            Save(data);
            return data;
        }
    }

    private ScoreBoardData LoadInternal()
    {
        if (!File.Exists(_filePath))
            return new ScoreBoardData();

        var json = File.ReadAllText(_filePath);

        // Try to load the combined format
        var data = JsonSerializer.Deserialize<ScoreBoardData>(json, JsonOptions);
        if (data != null && (data.HighScores.Count > 0 || data.LowScores.Count > 0))
            return data;

        // Migrate legacy format (plain List<HighScoreEntry>)
        var legacyEntries = JsonSerializer.Deserialize<List<HighScoreEntry>>(json, JsonOptions);
        if (legacyEntries != null && legacyEntries.Count > 0)
        {
            var migrated = new ScoreBoardData { HighScores = legacyEntries };
            Save(migrated);
            return migrated;
        }

        return new ScoreBoardData();
    }

    private void Save(ScoreBoardData data)
    {
        var json = JsonSerializer.Serialize(data, JsonOptions);
        File.WriteAllText(_filePath, json);
    }
}

public class ScoreBoardData
{
    public List<HighScoreEntry> HighScores { get; set; } = new();
    public List<HighScoreEntry> LowScores { get; set; } = new();
}
