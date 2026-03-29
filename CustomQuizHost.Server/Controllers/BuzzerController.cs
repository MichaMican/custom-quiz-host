using CustomQuizHost.Server.Models;
using CustomQuizHost.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace CustomQuizHost.Server.Controllers;

[ApiController]
[Route("api/buzzer")]
public class BuzzerController : ControllerBase
{
    private readonly GameService _gameService;

    public BuzzerController(GameService gameService)
    {
        _gameService = gameService;
    }

    /// <summary>
    /// NTP-like time synchronization endpoint.
    /// Client sends its send timestamp, server returns server receive and send timestamps.
    /// Client uses these to compute clock offset and RTT.
    /// </summary>
    [HttpPost("sync")]
    public ActionResult<TimeSyncResponse> Sync([FromBody] TimeSyncRequest request)
    {
        var serverReceiveTime = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        return Ok(new TimeSyncResponse
        {
            ClientSendTime = request.ClientSendTime,
            ServerReceiveTime = serverReceiveTime,
            ServerSendTime = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        });
    }

    /// <summary>
    /// Low-latency buzz endpoint. Accepts a client timestamp that has been
    /// adjusted using the NTP-like clock offset, so the server can determine
    /// accurate buzz ordering even when players have different network latencies.
    /// </summary>
    [HttpPost("buzz")]
    public async Task<ActionResult<BuzzResponse>> Buzz([FromBody] BuzzRequest request)
    {
        if (string.IsNullOrEmpty(request.PlayerId))
        {
            return BadRequest(new BuzzResponse { Success = false, Error = "PlayerId is required" });
        }

        var serverReceiveTime = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        // Validate the client timestamp is within a reasonable window.
        // A valid adjusted timestamp should be close to the server receive time
        // (within a few seconds). Fall back to server time for invalid values.
        const long maxDriftMs = 5000;
        long adjustedTimestamp;
        if (request.ClientTimestamp > 0 && request.ClientTimestamp > serverReceiveTime - maxDriftMs)
        {
            adjustedTimestamp = Math.Min(request.ClientTimestamp, serverReceiveTime);
        }
        else
        {
            adjustedTimestamp = serverReceiveTime;
        }

        var buzzTime = DateTimeOffset.FromUnixTimeMilliseconds(adjustedTimestamp);

        var success = await _gameService.BuzzIn(request.PlayerId, buzzTime);

        if (!success)
        {
            return Ok(new BuzzResponse { Success = false, Error = "Buzz not accepted" });
        }

        return Ok(new BuzzResponse { Success = true });
    }
}
