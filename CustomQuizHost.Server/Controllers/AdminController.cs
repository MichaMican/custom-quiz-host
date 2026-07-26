using CustomQuizHost.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace CustomQuizHost.Server.Controllers
{
    public class AdminVerifyRequest
    {
        public string Password { get; set; } = string.Empty;
    }

    [ApiController]
    [Route("api/[controller]")]
    public class AdminController : ControllerBase
    {
        private readonly AdminAuthService _authService;

        public AdminController(AdminAuthService authService)
        {
            _authService = authService;
        }

        [HttpPost("verify")]
        public IActionResult Verify([FromBody] AdminVerifyRequest request)
        {
            if (!_authService.Verify(request?.Password))
                return Unauthorized();

            return Ok();
        }
    }
}
