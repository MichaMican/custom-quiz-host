using System.Text.Json.Serialization;

namespace CustomQuizHost.Server.Models;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum QuestionType
{
    Standard,
    Image,
    ImageMozaik,
    Audio
}

public class GameState
{
    public List<Player> Players { get; set; } = new();
    public List<Category> Categories { get; set; } = new();
    public Question? CurrentQuestion { get; set; }
    public bool QuestionRevealed { get; set; }
    public bool BuzzerActive { get; set; }
    public List<BuzzIn> BuzzOrder { get; set; } = new();
    public List<PlayerAnswer> PlayerAnswers { get; set; } = new();
    public int HighlightedBuzzIndex { get; set; }
    public bool MediaPlaying { get; set; }
    public bool MozaikRevealing { get; set; }
    public bool QuestionTextRevealed { get; set; }
    public bool PlayerAnswersRevealed { get; set; }
    public bool AnswerRevealed { get; set; }
    public int MediaVolume { get; set; } = 70;
    public bool PauseOnBuzz { get; set; }
    public bool ImageFullscreen { get; set; }
}

public class Player
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "";
    public int Score { get; set; }
}

public class Category
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "";
    public List<Question> Questions { get; set; } = new();
}

public class Question
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Text { get; set; } = "";
    public string Answer { get; set; } = "";
    public int Points { get; set; }
    public bool IsAnswered { get; set; }
    public string CategoryId { get; set; } = "";
    public QuestionType QuestionType { get; set; } = QuestionType.Standard;
    public string? MediaFileName { get; set; }
}

public class BuzzIn
{
    public string PlayerId { get; set; } = "";
    public string PlayerName { get; set; } = "";
    public DateTime Timestamp { get; set; }
}

public class PlayerAnswer
{
    public string PlayerId { get; set; } = "";
    public string PlayerName { get; set; } = "";
    public string Answer { get; set; } = "";
    public DateTime Timestamp { get; set; }
}
