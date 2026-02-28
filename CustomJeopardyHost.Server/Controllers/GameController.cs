using CustomJeopardyHost.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace CustomJeopardyHost.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class GameController : ControllerBase
    {
        private readonly GameService _gameService;

        public GameController(GameService gameService)
        {
            _gameService = gameService;
        }

        [HttpGet("export")]
        public IActionResult Export()
        {
            return Ok(_gameService.GameState);
        }
    }
}
