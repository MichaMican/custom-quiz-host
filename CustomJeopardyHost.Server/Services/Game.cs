using CustomJeopardyHost.Server.Hubs;
using CustomJeopardyHost.Server.Models;
using Microsoft.AspNetCore.SignalR;

namespace CustomJeopardyHost.Server.Services;

public class GameService
{
    private readonly IHubContext<GameHub> _hubContext;
    private GameState _gameState = new();

    public GameService(IHubContext<GameHub> hubContext)
    {
        _hubContext = hubContext;
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

    public async Task AddQuestion(string categoryId, string text, string answer, int points, string questionType = "Standard", string? mediaFileName = null)
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
                MediaFileName = mediaFileName
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
            await BroadcastGameState();
        }
    }

    public async Task RevealQuestion()
    {
        if (_gameState.CurrentQuestion != null)
        {
            _gameState.QuestionRevealed = true;
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
            await BroadcastGameState();
        }
    }

    public async Task AwardPoints(string playerId, int points)
    {
        var player = _gameState.Players.FirstOrDefault(p => p.Id == playerId);
        if (player != null)
        {
            player.Score += points;
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
            await BroadcastGameState();
        }
    }

    public async Task SetPlayerScore(string playerId, int score)
    {
        var player = _gameState.Players.FirstOrDefault(p => p.Id == playerId);
        if (player != null)
        {
            player.Score = score;
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
        if (!_gameState.BuzzerActive) return;
        if (_gameState.BuzzOrder.Any(b => b.PlayerId == playerId)) return;

        var player = _gameState.Players.FirstOrDefault(p => p.Id == playerId);
        if (player != null)
        {
            _gameState.BuzzOrder.Add(new BuzzIn
            {
                PlayerId = playerId,
                PlayerName = player.Name,
                Timestamp = DateTime.UtcNow
            });
            await BroadcastGameState();
        }
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
}
