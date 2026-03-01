import { useState } from "react";
import { useSignalR } from "../hooks/useSignalR";
import "./Buzzer.css";

function Buzzer() {
  const { gameState, connectionStatus, invoke } = useSignalR();
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [playerAnswer, setPlayerAnswer] = useState("");

  const handleBuzzIn = async () => {
    if (!selectedPlayerId || !gameState?.buzzerActive) return;
    await invoke("BuzzIn", selectedPlayerId);
  };

  const handleSubmitAnswer = async () => {
    if (!selectedPlayerId || !playerAnswer.trim()) return;
    await invoke("SubmitPlayerAnswer", selectedPlayerId, playerAnswer.trim());
    setPlayerAnswer("");
  };

  if (connectionStatus !== "Connected") {
    return (
      <div className="buzzer-page">
        <div className="buzzer-container">
          <div className="buzzer-status">
            Connecting... ({connectionStatus})
          </div>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="buzzer-page">
        <div className="buzzer-container">
          <div className="buzzer-status">Waiting for game data...</div>
        </div>
      </div>
    );
  }

  const playerAlreadyBuzzed =
    selectedPlayerId &&
    gameState.buzzOrder.some((b) => b.playerId === selectedPlayerId);

  return (
    <div className="buzzer-page">
      <div className="buzzer-container">
        <h1 className="buzzer-title">Buzzer</h1>

        <div className="buzzer-player-select">
          <label htmlFor="player-select">Select your player:</label>
          <select
            id="player-select"
            value={selectedPlayerId}
            onChange={(e) => {
              setSelectedPlayerId(e.target.value);
            }}
          >
            <option value="">-- Select Player --</option>
            {gameState.players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {selectedPlayerId && (
          <button
            className={`buzz-button ${
              !gameState.buzzerActive
                ? "disabled"
                : playerAlreadyBuzzed
                  ? "buzzed"
                  : "ready"
            }`}
            onClick={handleBuzzIn}
            disabled={!gameState.buzzerActive || !!playerAlreadyBuzzed}
          >
            {!gameState.buzzerActive
              ? "Waiting for Host..."
              : playerAlreadyBuzzed
                ? "Buzzed!"
                : "BUZZ IN!"}
          </button>
        )}

        {selectedPlayerId && (
          <div className="answer-input-container">
            <label htmlFor="player-answer">Your Answer:</label>
            <input
              id="player-answer"
              type="text"
              value={playerAnswer}
              onChange={(e) => setPlayerAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSubmitAnswer();
                }
              }}
              placeholder="Type your answer here..."
            />
            <button
              onClick={handleSubmitAnswer}
              disabled={!playerAnswer.trim()}
              className="submit-answer-button"
            >
              Submit Answer
            </button>
          </div>
        )}

        {gameState.buzzOrder.length > 0 && (
          <div className="buzz-order-display">
            <h2>Buzz Order</h2>
            <ol>
              {gameState.buzzOrder.map((buzz, index) => (
                <li
                  key={buzz.playerId}
                  className={`${index === gameState.highlightedBuzzIndex ? "first" : ""} ${buzz.playerId === selectedPlayerId ? "me" : ""}`}
                >
                  {buzz.playerName}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

export default Buzzer;
