using CustomQuizHost.Server.Hubs;
using CustomQuizHost.Server.Models;
using Microsoft.AspNetCore.SignalR;

namespace CustomQuizHost.Server.Services;

public class GameService
{
    private readonly IHubContext<GameHub> _hubContext;
    private readonly HighScoreService _highScoreService;
    private readonly Lock _buzzLock = new();
    private GameState _gameState = new();
    private string? _lastAddedHighScoreId;
    private string? _lastAddedLowScoreId;

    public GameService(IHubContext<GameHub> hubContext, HighScoreService highScoreService)
    {
        _hubContext = hubContext;
        _highScoreService = highScoreService;
        var scoreBoardData = _highScoreService.LoadAll();
        _gameState.HighScoreBoard = scoreBoardData.HighScores;
        _gameState.LowScoreBoard = scoreBoardData.LowScores;
    }

    public GameState GameState => _gameState;

    public async Task BroadcastGameState()
    {
        await _hubContext.Clients.All.SendAsync("ReceiveGameState", _gameState);
    }

    public async Task SendGameStateToClient(string connectionId)
    {
        await _hubContext.Clients.Client(connectionId).SendAsync("ReceiveGameState", _gameState);
    }

    public async Task<Player> AddPlayer(string name)
    {
        var player = new Player { Name = name };
        _gameState.Players.Add(player);
        await BroadcastGameState();
        return player;
    }

    public async Task RemovePlayer(string playerId)
    {
        _gameState.Players.RemoveAll(p => p.Id == playerId);
        await BroadcastGameState();
    }

    public async Task<Category> AddCategory(string name)
    {
        var category = new Category { Name = name };
        _gameState.Categories.Add(category);
        await BroadcastGameState();
        return category;
    }

    public async Task RemoveCategory(string categoryId)
    {
        _gameState.Categories.RemoveAll(c => c.Id == categoryId);
        await BroadcastGameState();
    }

    public async Task AddQuestion(string categoryId, string text, string answer, int points, string questionType = "Standard", string? mediaFileName = null, string? answerImageFileName = null)
    {
        var category = _gameState.Categories.FirstOrDefault(c => c.Id == categoryId);
        if (category != null)
        {
            if (!Enum.TryParse<QuestionType>(questionType, true, out var parsedType))
            {
                parsedType = QuestionType.Standard;
            }

            var question = new Question
            {
                Text = text,
                Answer = answer,
                Points = points,
                CategoryId = categoryId,
                QuestionType = parsedType,
                MediaFileName = mediaFileName,
                AnswerImageFileName = answerImageFileName
            };
            category.Questions.Add(question);
            await BroadcastGameState();
        }
    }

    public async Task RemoveQuestion(string categoryId, string questionId)
    {
        var category = _gameState.Categories.FirstOrDefault(c => c.Id == categoryId);
        if (category != null)
        {
            category.Questions.RemoveAll(q => q.Id == questionId);
            await BroadcastGameState();
        }
    }

    public async Task ShowQuestion(string categoryId, string questionId)
    {
        var category = _gameState.Categories.FirstOrDefault(c => c.Id == categoryId);
        var question = category?.Questions.FirstOrDefault(q => q.Id == questionId);
        if (question != null)
        {
            _gameState.CurrentQuestion = question;
            _gameState.QuestionRevealed = false;
            _gameState.QuestionTextRevealed = false;
            _gameState.MediaVisible = true;
            await BroadcastGameState();
        }
    }

    public async Task RevealQuestion()
    {
        if (_gameState.CurrentQuestion != null)
        {
            _gameState.QuestionRevealed = true;
            var category = _gameState.Categories.FirstOrDefault(c => c.Id == _gameState.CurrentQuestion.CategoryId);
            _gameState.EventHistory.Add(new EventHistoryEntry
            {
                EventType = EventType.QuestionAsked,
                Timestamp = DateTime.UtcNow,
                QuestionText = _gameState.CurrentQuestion.Text,
                CategoryName = category?.Name,
                Points = _gameState.CurrentQuestion.Points
            });
            await BroadcastGameState();
        }
    }

    public async Task ReturnToBoard()
    {
        _gameState.CurrentQuestion = null;
        _gameState.QuestionRevealed = false;
        _gameState.BuzzerActive = false;
        _gameState.BuzzOrder.Clear();
        _gameState.PlayerAnswers.Clear();
        _gameState.HighlightedBuzzIndex = 0;
        _gameState.MediaPlaying = false;
        _gameState.MozaikRevealing = false;
        _gameState.QuestionTextRevealed = false;
        _gameState.PlayerAnswersRevealed = false;
        _gameState.AnswerRevealed = false;
        _gameState.ImageFullscreen = false;
        _gameState.MediaVisible = true;
        await BroadcastGameState();
    }

    public async Task DismissQuestion()
    {
        if (_gameState.CurrentQuestion != null)
        {
            _gameState.CurrentQuestion.IsAnswered = true;
            _gameState.CurrentQuestion = null;
            _gameState.BuzzerActive = false;
            _gameState.BuzzOrder.Clear();
            _gameState.PlayerAnswers.Clear();
            _gameState.HighlightedBuzzIndex = 0;
            _gameState.MediaPlaying = false;
            _gameState.MozaikRevealing = false;
            _gameState.QuestionTextRevealed = false;
            _gameState.PlayerAnswersRevealed = false;
            _gameState.AnswerRevealed = false;
            _gameState.ImageFullscreen = false;
            _gameState.MediaVisible = true;
            await BroadcastGameState();
        }
    }

    public async Task AwardPoints(string playerId, int points)
    {
        var player = _gameState.Players.FirstOrDefault(p => p.Id == playerId);
        if (player != null)
        {
            player.Score += points;
            _gameState.EventHistory.Add(new EventHistoryEntry
            {
                EventType = EventType.PointsAwarded,
                Timestamp = DateTime.UtcNow,
                PlayerName = player.Name,
                Points = points
            });
            if (_gameState.CurrentQuestion != null)
            {
                _gameState.CurrentQuestion.IsAnswered = true;
            }
            await BroadcastGameState();
        }
    }

    public async Task DeductPoints(string playerId, int points)
    {
        var player = _gameState.Players.FirstOrDefault(p => p.Id == playerId);
        if (player != null)
        {
            player.Score -= points;
            _gameState.EventHistory.Add(new EventHistoryEntry
            {
                EventType = EventType.PointsDeducted,
                Timestamp = DateTime.UtcNow,
                PlayerName = player.Name,
                Points = points
            });
            await BroadcastGameState();
        }
    }

    public async Task SetPlayerScore(string playerId, int score)
    {
        var player = _gameState.Players.FirstOrDefault(p => p.Id == playerId);
        if (player != null)
        {
            var oldScore = player.Score;
            player.Score = score;
            _gameState.EventHistory.Add(new EventHistoryEntry
            {
                EventType = EventType.ScoreSet,
                Timestamp = DateTime.UtcNow,
                PlayerName = player.Name,
                Points = score - oldScore
            });
            await BroadcastGameState();
        }
    }

    public async Task ActivateBuzzer()
    {
        _gameState.BuzzerActive = true;
        _gameState.BuzzOrder.Clear();
        _gameState.HighlightedBuzzIndex = 0;
        await BroadcastGameState();
    }

    public async Task DeactivateBuzzer()
    {
        _gameState.BuzzerActive = false;
        await BroadcastGameState();
    }

    public async Task BuzzIn(string playerId)
    {
        await BuzzIn(playerId, null);
    }

    /// <summary>
    /// Registers a buzz-in for the given player. When an adjusted timestamp is
    /// provided (from the low-latency HTTP endpoint with NTP-like compensation),
    /// it is used for ordering. Otherwise falls back to the current server time.
    /// Buzzes are inserted in timestamp order so that latency-compensated
    /// timestamps produce the correct ordering.
    /// </summary>
    public async Task<bool> BuzzIn(string playerId, DateTimeOffset? adjustedTimestamp)
    {
        lock (_buzzLock)
        {
            if (!_gameState.BuzzerActive) return false;
            if (_gameState.BuzzOrder.Any(b => b.PlayerId == playerId)) return false;

            var player = _gameState.Players.FirstOrDefault(p => p.Id == playerId);
            if (player == null) return false;

            var buzzTimestamp = adjustedTimestamp ?? DateTimeOffset.UtcNow;

            var entry = new BuzzIn
            {
                PlayerId = playerId,
                PlayerName = player.Name,
                Timestamp = buzzTimestamp
            };

            // Insert in sorted order by timestamp so that latency-compensated
            // buzzes are correctly ordered even if they arrive out of order.
            var insertIndex = _gameState.BuzzOrder.FindIndex(b => b.Timestamp > buzzTimestamp);
            if (insertIndex < 0)
                _gameState.BuzzOrder.Add(entry);
            else
                _gameState.BuzzOrder.Insert(insertIndex, entry);

            if (_gameState.PauseOnBuzz)
            {
                _gameState.MediaPlaying = false;
                _gameState.MozaikRevealing = false;
            }
        }

        // Broadcast outside the lock to avoid holding it during async I/O.
        // The broadcast always sends the latest state snapshot, so concurrent
        // modifications result in the newest state being sent by each caller.
        await BroadcastGameState();
        return true;
    }

    public async Task ClearBuzzOrder()
    {
        _gameState.BuzzOrder.Clear();
        _gameState.HighlightedBuzzIndex = 0;
        await BroadcastGameState();
    }

    public async Task SetHighlightedBuzzIndex(int index)
    {
        if (index < 0 || index >= _gameState.BuzzOrder.Count) return;
        _gameState.HighlightedBuzzIndex = index;
        await BroadcastGameState();
    }

    public async Task NextBuzzer()
    {
        if (_gameState.BuzzOrder.Count == 0) return;
        var currentIndex = _gameState.HighlightedBuzzIndex;
        if (currentIndex < 0 || currentIndex >= _gameState.BuzzOrder.Count) return;

        _gameState.BuzzOrder.RemoveAt(currentIndex);

        if (_gameState.HighlightedBuzzIndex >= _gameState.BuzzOrder.Count)
        {
            _gameState.HighlightedBuzzIndex = Math.Max(0, _gameState.BuzzOrder.Count - 1);
        }

        await BroadcastGameState();
    }

    public async Task SubmitPlayerAnswer(string playerId, string answer)
    {
        var player = _gameState.Players.FirstOrDefault(p => p.Id == playerId);
        if (player != null)
        {
            // Remove existing answer from this player if any
            _gameState.PlayerAnswers.RemoveAll(a => a.PlayerId == playerId);
            
            // Add the new answer
            _gameState.PlayerAnswers.Add(new PlayerAnswer
            {
                PlayerId = playerId,
                PlayerName = player.Name,
                Answer = answer,
                Timestamp = DateTime.UtcNow
            });
            await BroadcastGameState();
        }
    }

    public async Task ClearPlayerAnswers()
    {
        _gameState.PlayerAnswers.Clear();
        _gameState.PlayerAnswersRevealed = false;
        await BroadcastGameState();
    }

    public async Task ShowPlayerAnswers()
    {
        _gameState.PlayerAnswersRevealed = true;
        await BroadcastGameState();
    }

    public async Task HidePlayerAnswers()
    {
        _gameState.PlayerAnswersRevealed = false;
        await BroadcastGameState();
    }

    public async Task ShowAnswer()
    {
        _gameState.AnswerRevealed = true;
        await BroadcastGameState();
    }

    public async Task HideAnswer()
    {
        _gameState.AnswerRevealed = false;
        await BroadcastGameState();
    }

    public async Task ImportGameSettings(GameState state)
    {
        state.Players ??= new();
        state.Categories ??= new();
        state.BuzzOrder ??= new();
        state.PlayerAnswers ??= new();
        state.EventHistory ??= new();
        state.LowScoreBoard ??= new();
        _gameState = state;
        await BroadcastGameState();
    }

    public async Task ImportQuestions(List<Category> categories)
    {
        categories ??= new();
        _gameState.Categories = categories;
        _gameState.CurrentQuestion = null;
        _gameState.QuestionRevealed = false;
        _gameState.BuzzerActive = false;
        _gameState.BuzzOrder.Clear();
        _gameState.MediaPlaying = false;
        _gameState.MozaikRevealing = false;
        _gameState.QuestionTextRevealed = false;
        _gameState.ImageFullscreen = false;
        await BroadcastGameState();
    }

    public async Task StartMedia()
    {
        _gameState.MediaPlaying = true;
        await BroadcastGameState();
    }

    public async Task StopMedia()
    {
        _gameState.MediaPlaying = false;
        await BroadcastGameState();
    }

    public async Task SetMediaVolume(int volume)
    {
        _gameState.MediaVolume = Math.Clamp(volume, 0, 100);
        await BroadcastGameState();
    }

    public async Task StartMozaikReveal()
    {
        _gameState.MozaikRevealing = true;
        await BroadcastGameState();
    }

    public async Task StopMozaikReveal()
    {
        _gameState.MozaikRevealing = false;
        await BroadcastGameState();
    }

    public async Task SetMozaikRevealSpeed(int speed)
    {
        _gameState.MozaikRevealSpeed = Math.Clamp(speed, 1, 10);
        await BroadcastGameState();
    }

    public async Task ShowMedia()
    {
        _gameState.MediaVisible = true;
        await BroadcastGameState();
    }

    public async Task HideMedia()
    {
        _gameState.MediaVisible = false;
        await BroadcastGameState();
    }

    public async Task ShowQuestionText()
    {
        _gameState.QuestionTextRevealed = true;
        await BroadcastGameState();
    }

    public async Task HideQuestionText()
    {
        _gameState.QuestionTextRevealed = false;
        await BroadcastGameState();
    }

    public async Task SetPauseOnBuzz(bool value)
    {
        _gameState.PauseOnBuzz = value;
        await BroadcastGameState();
    }

    public async Task SetBuzzerSyncEnabled(bool value)
    {
        _gameState.BuzzerSyncEnabled = value;
        await BroadcastGameState();
    }

    public async Task SetAnswerInputEnabled(bool value)
    {
        _gameState.AnswerInputEnabled = value;
        await BroadcastGameState();
    }

    public async Task EnableImageFullscreen()
    {
        _gameState.ImageFullscreen = true;
        await BroadcastGameState();
    }

    public async Task DisableImageFullscreen()
    {
        _gameState.ImageFullscreen = false;
        await BroadcastGameState();
    }

    public async Task MoveQuestion(string categoryId, string questionId, string direction)
    {
        var category = _gameState.Categories.FirstOrDefault(c => c.Id == categoryId);
        if (category == null) return;

        var index = category.Questions.FindIndex(q => q.Id == questionId);
        if (index < 0) return;

        var newIndex = direction == "up" ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= category.Questions.Count) return;

        (category.Questions[index], category.Questions[newIndex]) = (category.Questions[newIndex], category.Questions[index]);
        await BroadcastGameState();
    }

    public async Task SortQuestionsByPoints(string categoryId)
    {
        var category = _gameState.Categories.FirstOrDefault(c => c.Id == categoryId);
        if (category == null) return;

        category.Questions.Sort((a, b) => a.Points.CompareTo(b.Points));
        await BroadcastGameState();
    }

    public async Task DeclareWinner()
    {
        _gameState.WinnerDeclared = true;

        // Add the winner (top scoring player) to the persistent highscore board
        var winner = _gameState.Players
            .OrderByDescending(p => p.Score)
            .FirstOrDefault();
        if (winner != null)
        {
            var entry = new HighScoreEntry
            {
                PlayerName = winner.Name,
                Score = winner.Score,
                AchievedAt = DateTimeOffset.UtcNow
            };
            _lastAddedHighScoreId = entry.Id;
            var data = _highScoreService.AddHighScore(entry);
            _gameState.HighScoreBoard = data.HighScores;
            _gameState.LowScoreBoard = data.LowScores;
        }

        // Add the loser (lowest scoring player) to the persistent lowscore board
        // Skip if the loser is the same as the winner (e.g. single-player game)
        var loser = _gameState.Players
            .OrderBy(p => p.Score)
            .FirstOrDefault();
        if (loser != null && loser.Id != winner?.Id)
        {
            var entry = new HighScoreEntry
            {
                PlayerName = loser.Name,
                Score = loser.Score,
                AchievedAt = DateTimeOffset.UtcNow
            };
            _lastAddedLowScoreId = entry.Id;
            var data = _highScoreService.AddLowScore(entry);
            _gameState.HighScoreBoard = data.HighScores;
            _gameState.LowScoreBoard = data.LowScores;
        }

        await BroadcastGameState();
    }

    public async Task UndeclareWinner()
    {
        _gameState.WinnerDeclared = false;
        _gameState.ShowHighScoreBoard = false;

        // Remove the entry that was added by the last DeclareWinner call
        if (_lastAddedHighScoreId != null)
        {
            var data = _highScoreService.RemoveHighScore(_lastAddedHighScoreId);
            _gameState.HighScoreBoard = data.HighScores;
            _gameState.LowScoreBoard = data.LowScores;
            _lastAddedHighScoreId = null;
        }

        if (_lastAddedLowScoreId != null)
        {
            var data = _highScoreService.RemoveLowScore(_lastAddedLowScoreId);
            _gameState.HighScoreBoard = data.HighScores;
            _gameState.LowScoreBoard = data.LowScores;
            _lastAddedLowScoreId = null;
        }

        await BroadcastGameState();
    }

    public async Task ShowHighScoreBoard()
    {
        _gameState.ShowHighScoreBoard = true;
        await BroadcastGameState();
    }

    public async Task HideHighScoreBoard()
    {
        _gameState.ShowHighScoreBoard = false;
        await BroadcastGameState();
    }

    public async Task ClearHighScores()
    {
        var data = _highScoreService.ClearHighScores();
        _gameState.HighScoreBoard = data.HighScores;
        _gameState.LowScoreBoard = data.LowScores;
        await BroadcastGameState();
    }

    public async Task ClearLowScores()
    {
        var data = _highScoreService.ClearLowScores();
        _gameState.HighScoreBoard = data.HighScores;
        _gameState.LowScoreBoard = data.LowScores;
        await BroadcastGameState();
    }

    public async Task DoubleRemainingPoints()
    {
        foreach (var category in _gameState.Categories)
        {
            foreach (var question in category.Questions)
            {
                if (!question.IsAnswered)
                {
                    question.Points *= 2;
                }
            }
        }
        await BroadcastGameState();
    }

    public async Task HalveRemainingPoints()
    {
        var unansweredQuestions = _gameState.Categories
            .SelectMany(c => c.Questions)
            .Where(q => !q.IsAnswered)
            .ToList();

        if (unansweredQuestions.Any(q => q.Points % 2 != 0))
            return;

        foreach (var question in unansweredQuestions)
        {
            question.Points /= 2;
        }
        await BroadcastGameState();
    }
}
