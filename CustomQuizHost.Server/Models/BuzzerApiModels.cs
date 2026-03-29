namespace CustomQuizHost.Server.Models;

public class TimeSyncRequest
{
    public long ClientSendTime { get; set; }
}

public class TimeSyncResponse
{
    public long ClientSendTime { get; set; }
    public long ServerReceiveTime { get; set; }
    public long ServerSendTime { get; set; }
}

public class BuzzRequest
{
    public string PlayerId { get; set; } = "";
    public long ClientTimestamp { get; set; }
}

public class BuzzResponse
{
    public bool Success { get; set; }
    public string? Error { get; set; }
}
