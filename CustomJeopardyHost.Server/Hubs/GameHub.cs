using CustomJeopardyHost.Server.Models;
using CustomJeopardyHost.Server.Services;
using Microsoft.AspNetCore.SignalR;

namespace CustomJeopardyHost.Server.Hubs;

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

    public async Task AddQuestion(string categoryId, string text, string answer, int points) =>
        await _gameService.AddQuestion(categoryId, text, answer, points);

    public async Task RemoveQuestion(string categoryId, string questionId) =>
        await _gameService.RemoveQuestion(categoryId, questionId);

    public async Task ShowQuestion(string categoryId, string questionId) =>
        await _gameService.ShowQuestion(categoryId, questionId);

    public async Task ReturnToBoard() => await _gameService.ReturnToBoard();

    public async Task AwardPoints(string playerId, int points) =>
        await _gameService.AwardPoints(playerId, points);

    public async Task DeductPoints(string playerId, int points) =>
        await _gameService.DeductPoints(playerId, points);

    public async Task ActivateBuzzer() => await _gameService.ActivateBuzzer();

    public async Task DeactivateBuzzer() => await _gameService.DeactivateBuzzer();

    public async Task BuzzIn(string playerId) => await _gameService.BuzzIn(playerId);

    public async Task ClearBuzzOrder() => await _gameService.ClearBuzzOrder();

    public async Task ImportGameSettings(GameState state) => await _gameService.ImportGameSettings(state);
}
