using CustomQuizHost.Server.Models;
using CustomQuizHost.Server.Services;
using Microsoft.AspNetCore.SignalR;

namespace CustomQuizHost.Server.Hubs;

public class GameHub : Hub
{
    private readonly GameService _gameService;

    public GameHub(GameService gameService)
    {
        _gameService = gameService;
    }

    public override async Task OnConnectedAsync()
    {
        await _gameService.SendGameStateToClient(Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public async Task AddPlayer(string name) => await _gameService.AddPlayer(name);

    public async Task RemovePlayer(string playerId) => await _gameService.RemovePlayer(playerId);

    public async Task AddCategory(string name) => await _gameService.AddCategory(name);

    public async Task RemoveCategory(string categoryId) => await _gameService.RemoveCategory(categoryId);

    public async Task AddQuestion(string categoryId, string text, string answer, int points, string questionType = "Standard", string? mediaFileName = null) =>
        await _gameService.AddQuestion(categoryId, text, answer, points, questionType, mediaFileName);

    public async Task RemoveQuestion(string categoryId, string questionId) =>
        await _gameService.RemoveQuestion(categoryId, questionId);

    public async Task ShowQuestion(string categoryId, string questionId) =>
        await _gameService.ShowQuestion(categoryId, questionId);

    public async Task RevealQuestion() => await _gameService.RevealQuestion();

    public async Task ReturnToBoard() => await _gameService.ReturnToBoard();

    public async Task DismissQuestion() => await _gameService.DismissQuestion();

    public async Task AwardPoints(string playerId, int points) =>
        await _gameService.AwardPoints(playerId, points);

    public async Task DeductPoints(string playerId, int points) =>
        await _gameService.DeductPoints(playerId, points);

    public async Task SetPlayerScore(string playerId, int score) =>
        await _gameService.SetPlayerScore(playerId, score);

    public async Task ActivateBuzzer() => await _gameService.ActivateBuzzer();

    public async Task DeactivateBuzzer() => await _gameService.DeactivateBuzzer();

    public async Task BuzzIn(string playerId) => await _gameService.BuzzIn(playerId);

    public async Task ClearBuzzOrder() => await _gameService.ClearBuzzOrder();

    public async Task SubmitPlayerAnswer(string playerId, string answer) => await _gameService.SubmitPlayerAnswer(playerId, answer);

    public async Task ClearPlayerAnswers() => await _gameService.ClearPlayerAnswers();

    public async Task ShowPlayerAnswers() => await _gameService.ShowPlayerAnswers();

    public async Task HidePlayerAnswers() => await _gameService.HidePlayerAnswers();

    public async Task ShowAnswer() => await _gameService.ShowAnswer();

    public async Task HideAnswer() => await _gameService.HideAnswer();
    
    public async Task SetHighlightedBuzzIndex(int index) => await _gameService.SetHighlightedBuzzIndex(index);

    public async Task ImportGameSettings(GameState state) => await _gameService.ImportGameSettings(state);

    public async Task ImportQuestions(List<Category> categories) => await _gameService.ImportQuestions(categories);

    public async Task StartMedia() => await _gameService.StartMedia();

    public async Task StopMedia() => await _gameService.StopMedia();

    public async Task SetMediaVolume(int volume) => await _gameService.SetMediaVolume(volume);

    public async Task StartMozaikReveal() => await _gameService.StartMozaikReveal();

    public async Task StopMozaikReveal() => await _gameService.StopMozaikReveal();

    public async Task ShowQuestionText() => await _gameService.ShowQuestionText();

    public async Task HideQuestionText() => await _gameService.HideQuestionText();

    public async Task SetPauseOnBuzz(bool value) => await _gameService.SetPauseOnBuzz(value);

    public async Task EnableImageFullscreen() => await _gameService.EnableImageFullscreen();

    public async Task DisableImageFullscreen() => await _gameService.DisableImageFullscreen();

    public async Task MoveQuestion(string categoryId, string questionId, string direction) =>
        await _gameService.MoveQuestion(categoryId, questionId, direction);

    public async Task SortQuestionsByPoints(string categoryId) =>
        await _gameService.SortQuestionsByPoints(categoryId);

    public async Task DoubleRemainingPoints() => await _gameService.DoubleRemainingPoints();
}
