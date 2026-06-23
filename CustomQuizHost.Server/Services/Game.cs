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
    private CancellationTokenSource? _questionTimerCts;
    private bool _pointsAwardedThisRound;
    // Tracks the selector that was chosen by the "no points awarded" rule.
    // The next no-points rotation always advances from this anchor, even if a
    // later round set the current selector via AwardPoints. This way a player
    // who picked but had nobody answer correctly is not "skipped" after an
    // unrelated player won an intermediate round.
    private string? _lastNoPointsSelectorId;
    // Tracks the most recent recipient of positive points during the current
    // round. Applied to CurrentSelectorPlayerId only when DismissQuestion is
    // called, so the highlight does not move while points are being awarded.
    private string? _pendingSelectorPlayerId;

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
        // The first player added becomes the initial category selector and
        // the anchor for the no-points rotation.
        if (_gameState.CurrentSelectorPlayerId == null)
        {
            _gameState.CurrentSelectorPlayerId = player.Id;
            _lastNoPointsSelectorId = player.Id;
        }
        await BroadcastGameState();
        return player;
    }

    public async Task RemovePlayer(string playerId)
    {
        var wasSelector = _gameState.CurrentSelectorPlayerId == playerId;
        var wasAnchor = _lastNoPointsSelectorId == playerId;
        var index = _gameState.Players.FindIndex(p => p.Id == playerId);
        _gameState.Players.RemoveAll(p => p.Id == playerId);
        if (wasSelector)
        {
            if (_gameState.Players.Count == 0)
            {
                _gameState.CurrentSelectorPlayerId = null;
            }
            else
            {
                // Pass the selector to the player that took the removed
                // player's slot (or wrap to the first player).
                var nextIndex = index >= 0 && index < _gameState.Players.Count ? index : 0;
                _gameState.CurrentSelectorPlayerId = _gameState.Players[nextIndex].Id;
            }
        }
        if (wasAnchor)
        {
            if (_gameState.Players.Count == 0)
            {
                _lastNoPointsSelectorId = null;
            }
            else
            {
                var nextIndex = index >= 0 && index < _gameState.Players.Count ? index : 0;
                _lastNoPointsSelectorId = _gameState.Players[nextIndex].Id;
            }
        }
        if (_pendingSelectorPlayerId == playerId)
        {
            _pendingSelectorPlayerId = null;
        }
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
            ClearQuestionTimerState();
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
            // A new round starts when the question is asked. Reset the flag
            // that tracks whether anyone receives points during this round so
            // that the next selector can be determined when the question ends.
            _pointsAwardedThisRound = false;
            _pendingSelectorPlayerId = null;
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
        ClearQuestionTimerState();
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
            ClearQuestionTimerState();
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
            // The selector highlight only updates when a question is
            // dismissed. If anyone received positive points this round, the
            // last such recipient becomes the new selector. Otherwise rotate
            // from the no-points anchor.
            if (_pointsAwardedThisRound)
            {
                if (_pendingSelectorPlayerId != null &&
                    _gameState.Players.Any(p => p.Id == _pendingSelectorPlayerId))
                {
                    _gameState.CurrentSelectorPlayerId = _pendingSelectorPlayerId;
                }
                else
                {
                    // Pending recipient was removed before dismissal: fall
                    // back to the normal no-points rotation so we never leave
                    // a stale id in CurrentSelectorPlayerId.
                    AdvanceSelectorToNextInList();
                }
            }
            else
            {
                AdvanceSelectorToNextInList();
            }
            _pointsAwardedThisRound = false;
            _pendingSelectorPlayerId = null;
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
                // Track that points were awarded this round and remember the
                // most recent recipient – they become the next category
                // selector once the round ends (applied in DismissQuestion so
                // the highlight does not jump while points are being awarded).
                if (points > 0)
                {
                    _pendingSelectorPlayerId = player.Id;
                    _pointsAwardedThisRound = true;
                }
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

    public async Task SetPlayerAvatar(string playerId, string? avatarFileName)
    {
        var player = _gameState.Players.FirstOrDefault(p => p.Id == playerId);
        if (player != null)
        {
            player.AvatarFileName = string.IsNullOrWhiteSpace(avatarFileName) ? null : avatarFileName;
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

    /// <summary>
    /// Clears any pending question timer state without broadcasting.
    /// Cancels the in-flight Task.Delay (if any) so it cannot deactivate
    /// the buzzer for a stale timer.
    /// </summary>
    private void ClearQuestionTimerState()
    {
        var cts = _questionTimerCts;
        _questionTimerCts = null;
        if (cts != null)
        {
            try { cts.Cancel(); } catch (ObjectDisposedException) { }
        }
        _gameState.QuestionTimerActive = false;
        _gameState.QuestionTimerStartedAt = null;
    }

    public async Task StartQuestionTimer(int seconds)
    {
        if (_gameState.CurrentQuestion == null) return;

        var clamped = Math.Clamp(seconds, 1, 999);

        // Cancel any previously running timer so it doesn't deactivate the buzzer for a stale request.
        var previous = _questionTimerCts;
        if (previous != null)
        {
            try { previous.Cancel(); } catch (ObjectDisposedException) { }
        }

        var cts = new CancellationTokenSource();
        _questionTimerCts = cts;

        _gameState.QuestionTimerActive = true;
        _gameState.QuestionTimerDurationSeconds = clamped;
        _gameState.QuestionTimerStartedAt = DateTimeOffset.UtcNow;

        await BroadcastGameState();

        // Fire-and-forget the deactivation task; cancellation is handled silently.
        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(clamped), cts.Token);
            }
            catch (TaskCanceledException)
            {
                cts.Dispose();
                return;
            }

            // Only act if this timer is still the active one. A newer Start or a
            // Stop/transition may have replaced or cleared _questionTimerCts.
            if (ReferenceEquals(_questionTimerCts, cts))
            {
                _questionTimerCts = null;
                _gameState.BuzzerActive = false;
                _gameState.QuestionTimerActive = false;
                _gameState.QuestionTimerStartedAt = null;
                await BroadcastGameState();
            }
            cts.Dispose();
        });
    }

    public async Task StopQuestionTimer()
    {
        ClearQuestionTimerState();
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
        ClearQuestionTimerState();
        state.Players ??= new();
        state.Categories ??= new();
        state.BuzzOrder ??= new();
        state.PlayerAnswers ??= new();
        state.EventHistory ??= new();
        state.LowScoreBoard ??= new();
        state.QuestionTimerActive = false;
        state.QuestionTimerStartedAt = null;
        // If the imported state doesn't reference a known player as the
        // current selector (e.g. legacy export, or removed player), fall back
        // to the first player so the highlight still has a target.
        if (state.CurrentSelectorPlayerId == null ||
            state.Players.All(p => p.Id != state.CurrentSelectorPlayerId))
        {
            state.CurrentSelectorPlayerId = state.Players.FirstOrDefault()?.Id;
        }
        _gameState = state;
        _pointsAwardedThisRound = false;
        _pendingSelectorPlayerId = null;
        // Reset the no-points anchor to the current selector. It is in-memory
        // only and has no meaningful value across imports.
        _lastNoPointsSelectorId = state.CurrentSelectorPlayerId;
        await BroadcastGameState();
    }

    public async Task ImportQuestions(List<Category> categories)
    {
        ClearQuestionTimerState();
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

    public async Task SetHideBoard(bool value)
    {
        _gameState.HideBoard = value;
        await BroadcastGameState();
    }

    public async Task SetShowQrCode(bool value)
    {
        _gameState.ShowQrCode = value;
        await BroadcastGameState();
    }

    public async Task ShowRandomWheel()
    {
        if (_gameState.Players.Count == 0) return;
        var index = Random.Shared.Next(_gameState.Players.Count);
        var selected = _gameState.Players[index];
        _gameState.RandomWheelActive = true;
        _gameState.RandomWheelSelectedPlayerId = selected.Id;
        _gameState.RandomWheelSpinId = Guid.NewGuid().ToString();
        await BroadcastGameState();
    }

    public async Task HideRandomWheel()
    {
        _gameState.RandomWheelActive = false;
        _gameState.RandomWheelSelectedPlayerId = null;
        _gameState.RandomWheelSpinId = null;
        await BroadcastGameState();
    }

    public async Task SetSelector(string playerId)
    {
        var player = _gameState.Players.FirstOrDefault(p => p.Id == playerId);
        if (player == null) return;
        // Manual selection overrides both the current selector and the
        // no-points rotation anchor, so the next no-points round advances
        // from this player.
        _gameState.CurrentSelectorPlayerId = player.Id;
        _lastNoPointsSelectorId = player.Id;
        await BroadcastGameState();
    }

    public async Task SetSelectorHighlightEnabled(bool value)
    {
        _gameState.SelectorHighlightEnabled = value;
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

    public async Task SetPlayerSelectionDisabled(bool value)
    {
        _gameState.PlayerSelectionDisabled = value;
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

    /// <summary>
    /// Advances the current category selector to the next player after the
    /// last "no points" selector (wrapping around). Used when a round ends
    /// without anyone receiving points. The anchor (<see cref="_lastNoPointsSelectorId"/>)
    /// is updated to the new selector so subsequent no-points rounds keep
    /// rotating through the player list, even if AwardPoints reassigned the
    /// current selector in between.
    /// </summary>
    private void AdvanceSelectorToNextInList()
    {
        if (_gameState.Players.Count == 0)
        {
            _gameState.CurrentSelectorPlayerId = null;
            _lastNoPointsSelectorId = null;
            return;
        }

        // Use the anchor as the rotation basis. Fall back to the current
        // selector if the anchor is unset or refers to a removed player.
        var anchorId = _lastNoPointsSelectorId ?? _gameState.CurrentSelectorPlayerId;
        var currentIndex = anchorId == null
            ? -1
            : _gameState.Players.FindIndex(p => p.Id == anchorId);
        var nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % _gameState.Players.Count;
        var nextId = _gameState.Players[nextIndex].Id;
        _gameState.CurrentSelectorPlayerId = nextId;
        _lastNoPointsSelectorId = nextId;
    }
}
