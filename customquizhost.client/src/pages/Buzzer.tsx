import { useState, useEffect, useRef } from "react";
import { useSignalR } from "../hooks/useSignalR";
import { useWakeLock } from "../hooks/useWakeLock";
import { TimeSync } from "../utils/timeSync";
import EventHistory from "../components/EventHistory";
import "./Buzzer.css";

function Buzzer() {
  const { gameState, connectionStatus, invoke } = useSignalR();
  useWakeLock();
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [playerAnswer, setPlayerAnswer] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  // NTP-like time synchronization for accurate buzz timestamps
  const timeSyncRef = useRef<TimeSync | null>(null);
  useEffect(() => {
    const ts = new TimeSync();
    timeSyncRef.current = ts;
    ts.start();
    return () => ts.stop();
  }, []);

  const handleBuzzIn = async () => {
    if (!selectedPlayerId || !gameState?.buzzerActive) return;

    // Compute latency-compensated timestamp (approximate server time at buzz moment)
    const ts = timeSyncRef.current;
    const adjustedTimestamp = ts ? ts.getServerTime() : Date.now();

    // Fire-and-forget HTTP POST for minimum latency – we don't await the
    // response before showing the "Buzzed!" state (SignalR will confirm).
    fetch("/api/buzzer/buzz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId: selectedPlayerId,
        clientTimestamp: adjustedTimestamp,
      }),
      keepalive: true,
    }).catch((err) => {
      console.error("Buzz request failed:", err);
    });
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

  const selectedPlayer = gameState.players.find((p) => p.id === selectedPlayerId);

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

        {selectedPlayerId && gameState.answerInputEnabled && (
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

        <button
          className="btn-history"
          onClick={() => setShowHistory(true)}
        >
          History
        </button>
      </div>

      {showHistory && (
        <div className="history-fullscreen" onClick={() => setShowHistory(false)}>
          <div className="history-fullscreen-content" onClick={(e) => e.stopPropagation()}>
            <div className="history-fullscreen-header">
              <h2>Event History</h2>
              <button className="btn-history-close" onClick={() => setShowHistory(false)}>✕</button>
            </div>
            <div className="history-fullscreen-body">
              <EventHistory
                events={gameState.eventHistory}
                highlightPlayerName={selectedPlayer?.name}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Buzzer;
