import { useState, useEffect, useRef } from "react";
import { useSignalR } from "../hooks/useSignalR";
import type { GameState, QuestionType } from "../types/GameState";
import {
  saveGameState,
  loadGameState,
  clearGameState,
} from "../utils/localStorage";
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
  const [questionType, setQuestionType] = useState<QuestionType>("Standard");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<"setup" | "host">("setup");
  const [showResetModal, setShowResetModal] = useState(false);
  const [editingScorePlayerId, setEditingScorePlayerId] = useState<string | null>(null);
  const [editingScoreValue, setEditingScoreValue] = useState("");
  const hasRestoredRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedCategoryQuestions = gameState?.categories
    .find((c) => c.id === selectedCategoryId)
    ?.questions;

  // Auto-save game state to localStorage whenever it changes
  useEffect(() => {
    if (gameState) {
      saveGameState(gameState);
    }
  }, [gameState]);

  // Auto-restore from localStorage when server state is empty
  useEffect(() => {
    if (
      hasRestoredRef.current ||
      connectionStatus !== "Connected" ||
      !gameState
    )
      return;
    hasRestoredRef.current = true;

    const isEmpty =
      gameState.players.length === 0 && gameState.categories.length === 0;
    if (!isEmpty) return;

    const saved = loadGameState();
    if (
      saved &&
      (saved.players.length > 0 || saved.categories.length > 0)
    ) {
      invoke("ImportGameSettings", saved).catch(() => {
        // Allow retry on next mount if restore fails
        hasRestoredRef.current = false;
      });
    }
  }, [connectionStatus, gameState, invoke]);

  const handleReset = async () => {
    try {
      clearGameState();
      const emptyState: GameState = {
        players: [],
        categories: [],
        currentQuestion: null,
        questionRevealed: false,
        buzzerActive: false,
        buzzOrder: [],
        playerAnswers: [],
        highlightedBuzzIndex: 0,
        mediaPlaying: false,
        mozaikRevealing: false,
        questionTextRevealed: false,
        playerAnswersRevealed: false,
      };
      await invoke("ImportGameSettings", emptyState);
      setShowResetModal(false);
    } catch {
      alert("Failed to reset the game. Please try again.");
    }
  };

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
    if (!selectedCategoryId) return;
    if (questionType === "Standard" && !questionText.trim()) return;
    if (questionType !== "Standard" && !mediaFile) return;

    let mediaFileName: string | null = null;

    if (mediaFile) {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", mediaFile);
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          alert("Failed to upload file.");
          setUploading(false);
          return;
        }
        const data = await response.json();
        mediaFileName = data.fileName;
      } catch {
        alert("Failed to upload file.");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    await invoke(
      "AddQuestion",
      selectedCategoryId,
      questionText.trim(),
      questionAnswer.trim(),
      questionPoints,
      questionType,
      mediaFileName,
    );
    setQuestionText("");
    setQuestionAnswer("");
    setMediaFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleEditQuestion = async (questionId: string) => {
    const question = selectedCategoryQuestions?.find((q) => q.id === questionId);
    if (!question) return;
    setQuestionText(question.text);
    setQuestionAnswer(question.answer);
    setQuestionPoints(question.points);
    setQuestionType(question.questionType);
    setMediaFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    try {
      await invoke("RemoveQuestion", selectedCategoryId, questionId);
    } catch {
      alert("Failed to remove the original question. Please try again.");
    }
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

  const handleExportQuestions = () => {
    if (!gameState) return;
    const questionsOnly = { categories: gameState.categories };
    const blob = new Blob([JSON.stringify(questionsOnly, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jeopardy-questions.json";
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

  const handleImportQuestions = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        const categories = data.categories ?? data.Categories;
        if (!Array.isArray(categories) || categories.length === 0) {
          alert("The selected file does not contain any questions");
          return;
        }
        await invoke("ImportQuestions", categories);
      } catch {
        alert("The selected file is not valid JSON");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  if (connectionStatus !== "Connected") {
    return (
      <div className="remote-page">
        <div className="remote-container">
          <div className="remote-status">Connecting... ({connectionStatus})</div>
        </div>
      </div>
    );
  }

  return (
    <div className="remote-page">
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
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value as QuestionType)}
              >
                <option value="Standard">Standard Question</option>
                <option value="Image">Image Question</option>
                <option value="ImageMozaik">Image Mozaik</option>
                <option value="Audio">Audio Question</option>
              </select>
              {questionType === "Standard" && (
                <input
                  type="text"
                  placeholder="Question text"
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                />
              )}
              {questionType !== "Standard" && (
                <>
                  <div className="file-upload-row">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={questionType === "Audio" ? "audio/*" : "image/*"}
                      onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
                    />
                    {mediaFile && (
                      <span className="file-name">{mediaFile.name}</span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Question text (optional)"
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                  />
                </>
              )}
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
              <button onClick={handleAddQuestion} disabled={uploading}>
                {uploading ? "Uploading..." : "Add Question"}
              </button>
            </div>
            {selectedCategoryId && selectedCategoryQuestions && selectedCategoryQuestions.length > 0 && (
              <>
                <button
                  className="btn-sort"
                  onClick={() => invoke("SortQuestionsByPoints", selectedCategoryId)}
                >
                  Sort by Points ↑
                </button>
                <ul className="item-list">
                  {selectedCategoryQuestions.map((q, idx) => (
                    <li key={q.id}>
                      <span>
                        {q.points}: {q.questionType !== "Standard" ? `[${q.questionType}] ` : ""}{q.text || q.mediaFileName || "—"}
                      </span>
                      <div className="question-actions">
                        <button
                          className="btn-edit"
                          onClick={() => handleEditQuestion(q.id)}
                          title="Edit question"
                        >
                          ✎
                        </button>
                        <button
                          className="btn-move"
                          disabled={idx === 0}
                          onClick={() => invoke("MoveQuestion", selectedCategoryId, q.id, "up")}
                          title="Move up"
                        >
                          ▲
                        </button>
                        <button
                          className="btn-move"
                          disabled={idx === selectedCategoryQuestions.length - 1}
                          onClick={() => invoke("MoveQuestion", selectedCategoryId, q.id, "down")}
                          title="Move down"
                        >
                          ▼
                        </button>
                        <button
                          className="btn-remove"
                          onClick={() =>
                            invoke("RemoveQuestion", selectedCategoryId, q.id)
                          }
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="remote-section">
            <h2>Import / Export</h2>
            <div className="input-row">
              <button onClick={handleExport}>Export Game</button>
              <label className="btn-import">
                Import Game
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  hidden
                />
              </label>
            </div>
            <div className="input-row">
              <button onClick={handleExportQuestions}>Export Questions</button>
              <label className="btn-import">
                Import Questions
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportQuestions}
                  hidden
                />
              </label>
            </div>
          </section>

          <section className="remote-section">
            <h2>Reset</h2>
            <button
              className="btn-reset"
              onClick={() => setShowResetModal(true)}
            >
              Reset Game
            </button>
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
                  {editingScorePlayerId === p.id ? (
                    <input
                      className="score-edit-input"
                      type="number"
                      aria-label={`Edit score for ${p.name}`}
                      value={editingScoreValue}
                      onChange={(e) => setEditingScoreValue(e.target.value)}
                      onBlur={() => {
                        const parsed = parseInt(editingScoreValue, 10);
                        if (!isNaN(parsed)) {
                          invoke("SetPlayerScore", p.id, parsed);
                        }
                        setEditingScorePlayerId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          (e.target as HTMLInputElement).blur();
                        } else if (e.key === "Escape") {
                          setEditingScorePlayerId(null);
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <span
                      className="score-value"
                      onClick={() => {
                        setEditingScorePlayerId(p.id);
                        setEditingScoreValue(String(p.score));
                      }}
                      title="Click to edit"
                    >
                      {p.score}
                    </span>
                  )}
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
                        className={`buzz-entry ${i === gameState.highlightedBuzzIndex ? "highlighted" : ""}`}
                      >
                        {i + 1}. {b.playerName}
                      </div>
                    ))}
                  </div>
                  <button onClick={() => invoke("ClearBuzzOrder")}>
                    Clear Buzz Order
                  </button>
                  <button
                    onClick={() => invoke("SetHighlightedBuzzIndex", gameState.highlightedBuzzIndex + 1)}
                    disabled={gameState.highlightedBuzzIndex >= gameState.buzzOrder.length - 1}
                  >
                    Next Buzz
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
                  <strong>{gameState.currentQuestion.points}</strong>
                  {gameState.currentQuestion.questionType !== "Standard" && (
                    <span className="question-type-badge"> [{gameState.currentQuestion.questionType}]</span>
                  )}
                </p>
                {gameState.currentQuestion.text && (
                  <p>{gameState.currentQuestion.text}</p>
                )}
                {gameState.currentQuestion.mediaFileName && (
                  <p className="media-info">
                    Media: {gameState.currentQuestion.mediaFileName}
                  </p>
                )}
                <p className="answer-text">
                  Answer: {gameState.currentQuestion.answer}
                </p>
              </div>
              {!gameState.questionRevealed && (
                <button
                  className="btn-reveal"
                  onClick={() => invoke("RevealQuestion")}
                >
                  Show Question
                </button>
              )}
              {gameState.questionRevealed && (gameState.currentQuestion.questionType === "Audio" || gameState.currentQuestion.questionType === "ImageMozaik") && (
                <div className="media-controls">
                  {gameState.currentQuestion.questionType === "Audio" && (
                    <button
                      className={`btn-media ${gameState.mediaPlaying ? "active" : ""}`}
                      onClick={() => invoke(gameState.mediaPlaying ? "StopMedia" : "StartMedia")}
                    >
                      {gameState.mediaPlaying ? "⏸ Stop Audio" : "▶ Play Audio"}
                    </button>
                  )}
                  {gameState.currentQuestion.questionType === "ImageMozaik" && (
                    <button
                      className={`btn-media ${gameState.mozaikRevealing ? "active" : ""}`}
                      onClick={() => invoke(gameState.mozaikRevealing ? "StopMozaikReveal" : "StartMozaikReveal")}
                    >
                      {gameState.mozaikRevealing ? "⏸ Stop Reveal" : "▶ Start Reveal"}
                    </button>
                  )}
                </div>
              )}
              {gameState.currentQuestion.questionType !== "Standard" && gameState.currentQuestion.text && (
                <button
                  className={`btn-media ${gameState.questionTextRevealed ? "active" : ""}`}
                  onClick={() => invoke(gameState.questionTextRevealed ? "HideQuestionText" : "ShowQuestionText")}
                >
                  {gameState.questionTextRevealed ? "Hide Question Text" : "Show Question Text"}
                </button>
              )}
              <button
                className="btn-dismiss"
                onClick={() => invoke("DismissQuestion")}
              >
                Dismiss Question
              </button>
              {gameState.playerAnswers && gameState.playerAnswers.length > 0 && (
                <div className="host-player-answers">
                  <h3>Player Answers</h3>
                  <div className="answers-list">
                    {gameState.playerAnswers.map((answer) => (
                      <div key={answer.playerId} className="player-answer-item">
                        <span className="answer-player-name">{answer.playerName}:</span>
                        <span className="answer-text">{answer.answer}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    className={`btn-media ${gameState.playerAnswersRevealed ? "active" : ""}`}
                    onClick={() => invoke(gameState.playerAnswersRevealed ? "HidePlayerAnswers" : "ShowPlayerAnswers")}
                  >
                    {gameState.playerAnswersRevealed ? "Hide Answers on Display" : "Show Answers on Display"}
                  </button>
                </div>
              )}
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
              <button
                className="btn-double-points"
                onClick={() => invoke("DoubleRemainingPoints")}
              >
                Double Remaining Points
              </button>
              <div className="remote-board">
                {gameState.categories.map((category) => (
                  <div key={category.id} className="remote-board-category">
                    <div className="remote-board-header">{category.name}</div>
                    {category.questions.map((question) => {
                      if (question.isAnswered)
                        return (
                          <div key={question.id} className="remote-board-cell empty">
                            —
                          </div>
                        );
                      return (
                        <button
                          key={question.id}
                          className="remote-board-cell"
                          onClick={() =>
                            invoke("ShowQuestion", category.id, question.id)
                          }
                        >
                          {question.points}
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

      {showResetModal && (
        <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Reset Game</h2>
            <p>
              Are you sure you want to reset the game? This will delete all
              players, categories, questions, and scores.
            </p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowResetModal(false)}>
                Cancel
              </button>
              <button className="btn-confirm-reset" onClick={handleReset}>
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default RemoteControl;
