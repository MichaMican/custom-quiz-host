import { useSignalR } from "../hooks/useSignalR";
import type { Category } from "../types/GameState";
import "./Display.css";

const POINT_LEVELS = [200, 400, 600, 800, 1000];

function Display() {
  const { gameState, connectionStatus } = useSignalR();

  if (connectionStatus !== "Connected") {
    return (
      <div className="display-container">
        <div className="display-status">
          Connecting... ({connectionStatus})
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="display-container">
        <div className="display-status">Waiting for game data...</div>
      </div>
    );
  }

  if (gameState.currentQuestion) {
    return (
      <div className="display-container">
        <div className="display-question">
          <div className="display-question-points">
            {gameState.currentQuestion.points}
          </div>
          <div className="display-question-text">
            {gameState.currentQuestion.text}
          </div>
        </div>
        {gameState.buzzerActive && gameState.buzzOrder.length > 0 && (
          <div className="display-buzz-order">
            <h3>Buzz Order</h3>
            <ol>
              {gameState.buzzOrder.map((buzz, index) => (
                <li key={buzz.playerId} className={index === 0 ? "first-buzz" : ""}>
                  {buzz.playerName}
                </li>
              ))}
            </ol>
          </div>
        )}
        <div className="display-scoreboard">
          {gameState.players.map((player) => (
            <div key={player.id} className="display-player-score">
              <span className="player-name">{player.name}</span>
              <span className="player-score">{player.score}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const getQuestion = (category: Category, points: number) => {
    return category.questions.find((q) => q.points === points);
  };

  return (
    <div className="display-container">
      <div className="display-board">
        {gameState.categories.map((category) => (
          <div key={category.id} className="display-category">
            <div className="display-category-header">{category.name}</div>
            {POINT_LEVELS.map((points) => {
              const question = getQuestion(category, points);
              const isAnswered = question?.isAnswered ?? false;
              return (
                <div
                  key={points}
                  className={`display-cell ${isAnswered ? "answered" : ""}`}
                >
                  {!isAnswered && question ? `$${points}` : ""}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="display-scoreboard">
        {gameState.players.map((player) => (
          <div key={player.id} className="display-player-score">
            <span className="player-name">{player.name}</span>
            <span className="player-score">{player.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Display;
