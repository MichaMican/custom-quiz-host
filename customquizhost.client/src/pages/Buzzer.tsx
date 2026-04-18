import { useState, useEffect, useRef } from "react";
import { useSignalR } from "../hooks/useSignalR";
import { useWakeLock } from "../hooks/useWakeLock";
import { TimeSync } from "../utils/timeSync";
import EventHistory from "../components/EventHistory";
import Avatar from "../components/Avatar";
import CameraCaptureModal, { type CapturedImage } from "../components/CameraCaptureModal";
import UploadProgressModal from "../components/UploadProgressModal";
import { uploadFileWithProgress } from "../utils/uploadWithProgress";
import "./Buzzer.css";

function Buzzer() {
  const { gameState, connectionStatus, invoke } = useSignalR();
  useWakeLock();
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [playerAnswer, setPlayerAnswer] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [buzzerPressed, setBuzzerPressed] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState("");

  // NTP-like time synchronization for accurate buzz timestamps
  // Only active when host enables buzzer sync
  const timeSyncRef = useRef<TimeSync | null>(null);
  const stopTimeSync = () => {
    if (timeSyncRef.current) {
      timeSyncRef.current.stop();
      timeSyncRef.current = null;
    }
  };
  useEffect(() => {
    if (gameState?.buzzerSyncEnabled) {
      if (!timeSyncRef.current) {
        const ts = new TimeSync();
        timeSyncRef.current = ts;
        ts.start();
      }
    } else {
      stopTimeSync();
    }
    return stopTimeSync;
  }, [gameState?.buzzerSyncEnabled]);

  const handleBuzzIn = async () => {
    if (!selectedPlayerId || !gameState?.buzzerActive) return;

    // When sync is enabled, compute latency-compensated timestamp.
    // When disabled, send 0 so the server uses pure receive time.
    const ts = timeSyncRef.current;
    const adjustedTimestamp = ts && ts.isSynced() ? ts.getServerTime() : 0;

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

  const handleAvatarCaptured = async (image: CapturedImage) => {
    if (!selectedPlayerId) return;
    setShowCamera(false);
    setUploading(true);
    setUploadProgress(0);
    setUploadMessage("Uploading avatar…");
    try {
      const result = await uploadFileWithProgress(
        image.blob,
        (percent) => setUploadProgress(percent),
        image.fileName,
      );
      await invoke("SetPlayerAvatar", selectedPlayerId, result.fileName);
    } catch (err) {
      console.error("Avatar upload failed:", err);
      // surface a minimal error — the modal is dismissed on finally
      alert("Avatar upload failed. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadMessage("");
    }
  };

  const submittedAnswer = gameState?.playerAnswers.find(
    (a) => a.playerId === selectedPlayerId
  );

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
            type="button"
            className="btn-camera"
            onClick={() => setShowCamera(true)}
            aria-label="Take or upload avatar picture"
            title="Take or upload avatar picture"
          >
            <span className="btn-camera-icon" aria-hidden="true">📷</span>
            <span className="btn-camera-label">
              {selectedPlayer?.avatarFileName ? "Change picture" : "Add picture"}
            </span>
          </button>
        )}

        {selectedPlayerId && (
          <button
            className={`buzz-button ${
              !gameState.buzzerActive
                ? "disabled"
                : playerAlreadyBuzzed
                  ? "buzzed"
                  : "ready"
            }${buzzerPressed ? " pressed" : ""}`}
            onPointerDown={(e) => {
              e.preventDefault();
              setBuzzerPressed(true);
              handleBuzzIn();
            }}
            onPointerUp={() => setBuzzerPressed(false)}
            onPointerLeave={() => setBuzzerPressed(false)}
            onPointerCancel={() => setBuzzerPressed(false)}
            disabled={!gameState.buzzerActive || !!playerAlreadyBuzzed}
          >
            <span className="buzz-button-avatar" aria-hidden="true">
              <Avatar
                fileName={selectedPlayer?.avatarFileName}
                grayscale={!gameState.buzzerActive}
                alt=""
              />
            </span>
            <span className="buzz-button-label">
              {!gameState.buzzerActive
                ? "Waiting for Host..."
                : playerAlreadyBuzzed
                  ? "Buzzed!"
                  : "BUZZ IN!"}
            </span>
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
            {submittedAnswer && (
              <div className="submitted-answer-display">
                <span className="submitted-answer-label">Submitted answer:</span>
                <span className="submitted-answer-text">{submittedAnswer.answer}</span>
              </div>
            )}
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

      <CameraCaptureModal
        visible={showCamera}
        onClose={() => setShowCamera(false)}
        onCaptured={handleAvatarCaptured}
      />
      <UploadProgressModal
        visible={uploading}
        progress={uploadProgress}
        message={uploadMessage}
      />
    </div>
  );
}

export default Buzzer;
