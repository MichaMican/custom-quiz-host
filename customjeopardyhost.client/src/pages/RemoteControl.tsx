import { useState } from "react";
import { useSignalR } from "../hooks/useSignalR";
import type { GameState } from "../types/GameState";
import "./RemoteControl.css";

const POINT_LEVELS = [200, 400, 600, 800, 1000];

function RemoteControl() {
  const { gameState, connectionStatus, invoke } = useSignalR();
  const [playerName, setPlayerName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [questionAnswer, setQuestionAnswer] = useState("");
  const [questionPoints, setQuestionPoints] = useState(200);
  const [tab, setTab] = useState<"setup" | "host">("setup");

  const handleAddPlayer = async () => {
    if (!playerName.trim()) return;
    await invoke("AddPlayer", playerName.trim());
    setPlayerName("");
  };

  const handleAddCategory = async () => {
    if (!categoryName.trim()) return;
    await invoke("AddCategory", categoryName.trim());
    setCategoryName("");
  };

  const handleAddQuestion = async () => {
    if (!selectedCategoryId || !questionText.trim()) return;
    await invoke(
      "AddQuestion",
      selectedCategoryId,
      questionText.trim(),
      questionAnswer.trim(),
      questionPoints,
    );
    setQuestionText("");
    setQuestionAnswer("");
  };

  const handleExport = () => {
    if (!gameState) return;
    const blob = new Blob([JSON.stringify(gameState, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jeopardy-game.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const state = JSON.parse(event.target?.result as string) as GameState;
        await invoke("ImportGameSettings", state);
      } catch {
        alert("The selected file does not contain valid game settings");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  if (connectionStatus !== "Connected") {
    return (
      <div className="remote-container">
        <div className="remote-status">Connecting... ({connectionStatus})</div>
      </div>
    );
  }

  return (
    <div className="remote-container">
      <div className="remote-tabs">
        <button
          className={`tab-btn ${tab === "setup" ? "active" : ""}`}
          onClick={() => setTab("setup")}
        >
          Setup
        </button>
        <button
          className={`tab-btn ${tab === "host" ? "active" : ""}`}
          onClick={() => setTab("host")}
        >
          Host
        </button>
      </div>

      {tab === "setup" && (
        <div className="remote-panel">
          <section className="remote-section">
            <h2>Players</h2>
            <div className="input-row">
              <input
                type="text"
                placeholder="Player name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddPlayer()}
              />
              <button onClick={handleAddPlayer}>Add</button>
            </div>
            <ul className="item-list">
              {gameState?.players.map((p) => (
                <li key={p.id}>
                  <span>{p.name}</span>
                  <button
                    className="btn-remove"
                    onClick={() => invoke("RemovePlayer", p.id)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="remote-section">
            <h2>Categories</h2>
            <div className="input-row">
              <input
                type="text"
                placeholder="Category name"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
              />
              <button onClick={handleAddCategory}>Add</button>
            </div>
            <ul className="item-list">
              {gameState?.categories.map((c) => (
                <li key={c.id}>
                  <span>
                    {c.name} ({c.questions.length} questions)
                  </span>
                  <button
                    className="btn-remove"
                    onClick={() => invoke("RemoveCategory", c.id)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="remote-section">
            <h2>Questions</h2>
            <div className="input-column">
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
              >
                <option value="">Select category</option>
                {gameState?.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Question text"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
              />
              <input
                type="text"
                placeholder="Answer"
                value={questionAnswer}
                onChange={(e) => setQuestionAnswer(e.target.value)}
              />
              <select
                value={questionPoints}
                onChange={(e) => setQuestionPoints(Number(e.target.value))}
              >
                {POINT_LEVELS.map((p) => (
                  <option key={p} value={p}>
                    {p} points
                  </option>
                ))}
              </select>
              <button onClick={handleAddQuestion}>Add Question</button>
            </div>
            {selectedCategoryId && (
              <ul className="item-list">
                {gameState?.categories
                  .find((c) => c.id === selectedCategoryId)
                  ?.questions.map((q) => (
                    <li key={q.id}>
                      <span>
                        ${q.points}: {q.text}
                      </span>
                      <button
                        className="btn-remove"
                        onClick={() =>
                          invoke("RemoveQuestion", selectedCategoryId, q.id)
                        }
                      >
                        ✕
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </section>

          <section className="remote-section">
            <h2>Import / Export</h2>
            <div className="input-row">
              <button onClick={handleExport}>Export JSON</button>
              <label className="btn-import">
                Import JSON
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  hidden
                />
              </label>
            </div>
          </section>
        </div>
      )}

      {tab === "host" && gameState && (
        <div className="remote-panel">
          <section className="remote-section">
            <h2>Scoreboard</h2>
            <div className="scoreboard-list">
              {gameState.players.map((p) => (
                <div key={p.id} className="score-row">
                  <span className="score-name">{p.name}</span>
                  <span className="score-value">{p.score}</span>
                  <div className="score-actions">
                    {gameState.currentQuestion && (
                      <>
                        <button
                          className="btn-award"
                          onClick={() =>
                            invoke(
                              "AwardPoints",
                              p.id,
                              gameState.currentQuestion!.points,
                            )
                          }
                        >
                          +{gameState.currentQuestion.points}
                        </button>
                        <button
                          className="btn-deduct"
                          onClick={() =>
                            invoke(
                              "DeductPoints",
                              p.id,
                              gameState.currentQuestion!.points,
                            )
                          }
                        >
                          -{gameState.currentQuestion.points}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="remote-section">
            <h2>Buzzer Control</h2>
            <div className="buzzer-controls">
              <button
                className={`btn-buzzer ${gameState.buzzerActive ? "active" : ""}`}
                onClick={() =>
                  invoke(
                    gameState.buzzerActive
                      ? "DeactivateBuzzer"
                      : "ActivateBuzzer",
                  )
                }
              >
                {gameState.buzzerActive
                  ? "Deactivate Buzzer"
                  : "Activate Buzzer"}
              </button>
              {gameState.buzzOrder.length > 0 && (
                <>
                  <div className="buzz-order-list">
                    {gameState.buzzOrder.map((b, i) => (
                      <div
                        key={b.playerId}
                        className={`buzz-entry ${i === 0 ? "first" : ""}`}
                      >
                        {i + 1}. {b.playerName}
                      </div>
                    ))}
                  </div>
                  <button onClick={() => invoke("ClearBuzzOrder")}>
                    Clear Buzz Order
                  </button>
                </>
              )}
            </div>
          </section>

          {gameState.currentQuestion ? (
            <section className="remote-section">
              <h2>Current Question</h2>
              <div className="current-question-info">
                <p>
                  <strong>${gameState.currentQuestion.points}</strong>
                </p>
                <p>{gameState.currentQuestion.text}</p>
                <p className="answer-text">
                  Answer: {gameState.currentQuestion.answer}
                </p>
              </div>
              <button
                className="btn-return"
                onClick={() => invoke("ReturnToBoard")}
              >
                Return to Board
              </button>
            </section>
          ) : (
            <section className="remote-section">
              <h2>Board</h2>
              <div className="remote-board">
                {gameState.categories.map((category) => (
                  <div key={category.id} className="remote-board-category">
                    <div className="remote-board-header">{category.name}</div>
                    {POINT_LEVELS.map((points) => {
                      const question = category.questions.find(
                        (q) => q.points === points,
                      );
                      if (!question || question.isAnswered)
                        return (
                          <div key={points} className="remote-board-cell empty">
                            —
                          </div>
                        );
                      return (
                        <button
                          key={points}
                          className="remote-board-cell"
                          onClick={() =>
                            invoke("ShowQuestion", category.id, question.id)
                          }
                        >
                          ${points}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export default RemoteControl;
