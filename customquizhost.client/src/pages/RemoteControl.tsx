import { useState, useEffect, useRef } from "react";
import JSZip from "jszip";
import { useSignalR } from "../hooks/useSignalR";
import { useWakeLock } from "../hooks/useWakeLock";
import type { GameState, QuestionType, Category } from "../types/GameState";
import {
  saveGameState,
  loadGameState,
  clearGameState,
} from "../utils/localStorage";
import { uploadFileWithProgress } from "../utils/uploadWithProgress";
import UploadProgressModal from "../components/UploadProgressModal";
import ExportProgressModal from "../components/ExportProgressModal";
import EventHistory from "../components/EventHistory";
import "./RemoteControl.css";

const POINT_LEVELS = [200, 400, 600, 800, 1000];

function RemoteControl() {
  const { gameState, connectionStatus, invoke } = useSignalR();
  useWakeLock();
  const [playerName, setPlayerName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [questionAnswer, setQuestionAnswer] = useState("");
  const [questionPoints, setQuestionPoints] = useState(200);
  const [questionType, setQuestionType] = useState<QuestionType>("Standard");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [existingMediaFileName, setExistingMediaFileName] = useState<string | null>(null);
  const [answerImageFile, setAnswerImageFile] = useState<File | null>(null);
  const [existingAnswerImageFileName, setExistingAnswerImageFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState("");
  const [tab, setTab] = useState<"setup" | "host" | "history">("setup");
  const [showResetModal, setShowResetModal] = useState(false);
  const [editingScorePlayerId, setEditingScorePlayerId] = useState<string | null>(null);
  const [editingScoreValue, setEditingScoreValue] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMessage, setExportMessage] = useState("");
  const [importExportMode, setImportExportMode] = useState<"questions" | "game">("questions");
  const hasRestoredRef = useRef(false);
  const hasUnsavedChanges = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const answerImageInputRef = useRef<HTMLInputElement>(null);
  const selectedCategoryQuestions = gameState?.categories
    .find((c) => c.id === selectedCategoryId)
    ?.questions;

  const markDirty = () => { hasUnsavedChanges.current = true; };
  const markClean = () => { hasUnsavedChanges.current = false; };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

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
        mozaikRevealSpeed: 5,
        questionTextRevealed: false,
        playerAnswersRevealed: false,
        answerRevealed: false,
        mediaVolume: 70,
        pauseOnBuzz: false,
        buzzerSyncEnabled: false,
        answerInputEnabled: false,
        imageFullscreen: false,
        mediaVisible: true,
        winnerDeclared: false,
        showHighScoreBoard: false,
        highScoreBoard: [],
        lowScoreBoard: [],
        eventHistory: [],
      };
      await invoke("ImportGameSettings", emptyState);
      markClean();
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
    markDirty();
  };

  const handleAddQuestion = async () => {
    if (!selectedCategoryId) return;
    if (questionType === "Standard" && !questionText.trim()) return;
    if (questionType !== "Standard" && !mediaFile && !existingMediaFileName) return;

    let mediaFileName: string | null = null;

    if (mediaFile) {
      setUploading(true);
      setUploadProgress(0);
      setUploadMessage("Uploading file…");
      try {
        const data = await uploadFileWithProgress(
          mediaFile,
          (percent) => setUploadProgress(percent),
        );
        mediaFileName = data.fileName;
      } catch {
        alert("Failed to upload file.");
        setUploading(false);
        return;
      }
      setUploading(false);
    } else if (existingMediaFileName) {
      mediaFileName = existingMediaFileName;
    }

    let answerImageFileName: string | null = null;

    if (answerImageFile) {
      setUploading(true);
      setUploadProgress(0);
      setUploadMessage("Uploading answer image…");
      try {
        const data = await uploadFileWithProgress(
          answerImageFile,
          (percent) => setUploadProgress(percent),
        );
        answerImageFileName = data.fileName;
      } catch {
        alert("Failed to upload answer image.");
        setUploading(false);
        return;
      }
      setUploading(false);
    } else if (existingAnswerImageFileName) {
      answerImageFileName = existingAnswerImageFileName;
    }

    await invoke(
      "AddQuestion",
      selectedCategoryId,
      questionText.trim(),
      questionAnswer.trim(),
      questionPoints,
      questionType,
      mediaFileName,
      answerImageFileName,
    );
    markDirty();
    setQuestionText("");
    setQuestionAnswer("");
    setMediaFile(null);
    setExistingMediaFileName(null);
    setAnswerImageFile(null);
    setExistingAnswerImageFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (answerImageInputRef.current) {
      answerImageInputRef.current.value = "";
    }
  };

  const handleEditQuestion = async (questionId: string) => {
    const question = selectedCategoryQuestions?.find((q) => q.id === questionId);
    if (!question) return;
    setQuestionText(question.text);
    setQuestionAnswer(question.answer);
    setQuestionPoints(question.points);
    setQuestionType(question.questionType);
    setExistingMediaFileName(question.mediaFileName ?? null);
    setMediaFile(null);
    setExistingAnswerImageFileName(question.answerImageFileName ?? null);
    setAnswerImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (answerImageInputRef.current) {
      answerImageInputRef.current.value = "";
    }
    try {
      markDirty();
      await invoke("RemoveQuestion", selectedCategoryId, questionId);
    } catch {
      alert("Failed to remove the original question. Please try again.");
    }
  };

  const collectMediaFileNames = (categories: Category[]): string[] => {
    const fileNames: string[] = [];
    for (const cat of categories) {
      for (const q of cat.questions) {
        if (q.mediaFileName) {
          fileNames.push(q.mediaFileName);
        }
        if (q.answerImageFileName) {
          fileNames.push(q.answerImageFileName);
        }
      }
    }
    return [...new Set(fileNames)];
  };

  const buildZip = async (
    jsonData: object,
    jsonFileName: string,
    categories: Category[],
    onProgress?: (percent: number, message: string) => void,
  ): Promise<Blob> => {
    const zip = new JSZip();
    zip.file(jsonFileName, JSON.stringify(jsonData, null, 2));
    const mediaFileNames = collectMediaFileNames(categories);
    const mediaFolder = zip.folder("media")!;
    for (let i = 0; i < mediaFileNames.length; i++) {
      const fileName = mediaFileNames[i];
      onProgress?.(
        (i / mediaFileNames.length) * 90,
        `Fetching file ${i + 1} of ${mediaFileNames.length}: ${fileName}`,
      );
      try {
        const response = await fetch(`/uploads/${fileName}`);
        if (response.ok) {
          const blob = await response.blob();
          mediaFolder.file(fileName, blob);
        }
      } catch {
        console.warn(`Failed to fetch media file: ${fileName}`);
      }
    }
    onProgress?.(90, "Generating ZIP file…");
    const blob = await zip.generateAsync({ type: "blob" });
    onProgress?.(100, "Download ready");
    return blob;
  };

  const importMediaFromZip = async (zip: JSZip): Promise<Map<string, string>> => {
    const fileNameMap = new Map<string, string>();
    const mediaFolder = zip.folder("media");
    if (!mediaFolder) return fileNameMap;
    const mediaFiles: { name: string; file: JSZip.JSZipObject }[] = [];
    mediaFolder.forEach((relativePath, file) => {
      if (!file.dir) {
        mediaFiles.push({ name: relativePath, file });
      }
    });
    if (mediaFiles.length === 0) return fileNameMap;

    setUploading(true);
    setUploadProgress(0);

    for (let i = 0; i < mediaFiles.length; i++) {
      const { name, file } = mediaFiles[i];
      setUploadMessage(`Uploading file ${i + 1} of ${mediaFiles.length}: ${name}`);
      try {
        const blob = await file.async("blob");
        const data = await uploadFileWithProgress(
          blob,
          (percent) => {
            const overallProgress = ((i + percent / 100) / mediaFiles.length) * 100;
            setUploadProgress(overallProgress);
          },
          name,
          true,
        );
        fileNameMap.set(name, data.fileName);
      } catch {
        console.warn(`Failed to upload media file: ${name}`);
      }
    }

    setUploading(false);
    return fileNameMap;
  };

  const remapMediaFileNames = (categories: Category[], fileNameMap: Map<string, string>): Category[] => {
    return categories.map((cat) => ({
      ...cat,
      questions: cat.questions.map((q) => ({
        ...q,
        mediaFileName: q.mediaFileName && fileNameMap.has(q.mediaFileName)
          ? fileNameMap.get(q.mediaFileName)!
          : q.mediaFileName,
        answerImageFileName: q.answerImageFileName && fileNameMap.has(q.answerImageFileName)
          ? fileNameMap.get(q.answerImageFileName)!
          : q.answerImageFileName,
      })),
    }));
  };

  const handleExport = async () => {
    if (!gameState) return;
    setExporting(true);
    setExportProgress(0);
    setExportMessage("Preparing export…");
    try {
      const zipBlob = await buildZip(
        gameState,
        "quiz-game.json",
        gameState.categories,
        (percent, message) => {
          setExportProgress(percent);
          setExportMessage(message);
        },
      );
      setExportProgress(100);
      setExportMessage("Download ready");
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "quiz-game.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      markClean();
    } finally {
      setExporting(false);
    }
  };

  const handleExportQuestions = async () => {
    if (!gameState) return;
    const questionsOnly = { categories: gameState.categories };
    setExporting(true);
    setExportProgress(0);
    setExportMessage("Preparing export…");
    try {
      const zipBlob = await buildZip(
        questionsOnly,
        "quiz-questions.json",
        gameState.categories,
        (percent, message) => {
          setExportProgress(percent);
          setExportMessage(message);
        },
      );
      setExportProgress(100);
      setExportMessage("Download ready");
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "quiz-questions.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      markClean();
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const zip = await JSZip.loadAsync(file);
      const jsonFile = zip.file("quiz-game.json");
      if (!jsonFile) {
        alert("The ZIP file does not contain a quiz-game.json file");
        return;
      }
      const jsonText = await jsonFile.async("string");
      const state = JSON.parse(jsonText) as GameState;
      const fileNameMap = await importMediaFromZip(zip);
      if (fileNameMap.size > 0) {
        state.categories = remapMediaFileNames(state.categories, fileNameMap);
      }
      await invoke("ImportGameSettings", state);
    } catch {
      alert("Failed to import game: the ZIP file may be corrupted or contain invalid data");
    }
    e.target.value = "";
  };

  const handleImportQuestions = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const zip = await JSZip.loadAsync(file);
      const jsonFile = zip.file("quiz-questions.json");
      if (!jsonFile) {
        alert("The ZIP file does not contain a quiz-questions.json file");
        return;
      }
      const jsonText = await jsonFile.async("string");
      const data = JSON.parse(jsonText);
      const categories = data.categories ?? data.Categories;
      if (!Array.isArray(categories) || categories.length === 0) {
        alert("The selected file does not contain any questions");
        return;
      }
      const fileNameMap = await importMediaFromZip(zip);
      const remapped = fileNameMap.size > 0 ? remapMediaFileNames(categories, fileNameMap) : categories;
      await invoke("ImportQuestions", remapped);
    } catch {
      alert("Failed to import questions: the ZIP file may be corrupted or contain invalid data");
    }
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
        <button
          className={`tab-btn ${tab === "history" ? "active" : ""}`}
          onClick={() => setTab("history")}
        >
          History
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
                    onClick={() => { markDirty(); invoke("RemoveCategory", c.id); }}
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
                <option value="Video">Video Question</option>
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
                      accept={questionType === "Audio" ? "audio/*" : questionType === "Video" ? "video/*" : "image/*"}
                      onChange={(e) => {
                        setMediaFile(e.target.files?.[0] ?? null);
                        if (e.target.files?.[0]) {
                          setExistingMediaFileName(null);
                        }
                      }}
                    />
                    {mediaFile && (
                      <span className="file-name">{mediaFile.name}</span>
                    )}
                    {!mediaFile && existingMediaFileName && (
                      <span className="file-name">Current file: {existingMediaFileName}</span>
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
              <div className="file-upload-row">
                <label>Answer Image (optional):</label>
                <input
                  ref={answerImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    setAnswerImageFile(e.target.files?.[0] ?? null);
                    if (e.target.files?.[0]) {
                      setExistingAnswerImageFileName(null);
                    }
                  }}
                />
                {answerImageFile && (
                  <span className="file-name">{answerImageFile.name}</span>
                )}
                {!answerImageFile && existingAnswerImageFileName && (
                  <span className="file-name">Current file: {existingAnswerImageFileName}</span>
                )}
                {(answerImageFile || existingAnswerImageFileName) && (
                  <button
                    type="button"
                    className="btn-remove"
                    onClick={() => {
                      setAnswerImageFile(null);
                      setExistingAnswerImageFileName(null);
                      if (answerImageInputRef.current) {
                        answerImageInputRef.current.value = "";
                      }
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
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
                  onClick={() => { markDirty(); invoke("SortQuestionsByPoints", selectedCategoryId); }}
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
                          onClick={() => { markDirty(); invoke("MoveQuestion", selectedCategoryId, q.id, "up"); }}
                          title="Move up"
                        >
                          ▲
                        </button>
                        <button
                          className="btn-move"
                          disabled={idx === selectedCategoryQuestions.length - 1}
                          onClick={() => { markDirty(); invoke("MoveQuestion", selectedCategoryId, q.id, "down"); }}
                          title="Move down"
                        >
                          ▼
                        </button>
                        <button
                          className="btn-remove"
                         onClick={() => {
                            markDirty();
                            invoke("RemoveQuestion", selectedCategoryId, q.id);
                          }}
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
            <h2>Buzzer Settings</h2>
            <label className="pause-on-buzz-label">
              <input
                type="checkbox"
                checked={gameState?.buzzerSyncEnabled ?? false}
                onChange={(e) => invoke("SetBuzzerSyncEnabled", e.target.checked)}
              />
              Activate Buzzer Sync (experimental)
            </label>
          </section>

          <section className="remote-section">
            <h2>Import / Export</h2>
            <div className="input-row">
              <select
                value={importExportMode}
                onChange={(e) => setImportExportMode(e.target.value as "questions" | "game")}
              >
                <option value="questions">Questions only</option>
                <option value="game">Full Game State</option>
              </select>
            </div>
            <div className="input-row">
              <button onClick={importExportMode === "questions" ? handleExportQuestions : handleExport}>
                📤 Export
              </button>
              <label className="btn-import">
                📥 Import
                <input
                  type="file"
                  accept=".zip"
                  onChange={importExportMode === "questions" ? handleImportQuestions : handleImport}
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
              <label className="pause-on-buzz-label">
                <input
                  type="checkbox"
                  checked={gameState.pauseOnBuzz}
                  onChange={(e) => invoke("SetPauseOnBuzz", e.target.checked)}
                />
                Pause actions on buzz
              </label>
              <label className="pause-on-buzz-label">
                <input
                  type="checkbox"
                  checked={gameState.answerInputEnabled}
                  onChange={(e) => invoke("SetAnswerInputEnabled", e.target.checked)}
                />
                Enable answer input for players
              </label>
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
                    onClick={() => invoke("NextBuzzer")}
                    disabled={gameState.buzzOrder.length === 0}
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
                {gameState.currentQuestion.answerImageFileName && (
                  <div className="answer-image-preview">
                    <img
                      src={`/uploads/${gameState.currentQuestion.answerImageFileName}`}
                      alt="Answer"
                      className="answer-image-thumb"
                    />
                  </div>
                )}
              </div>
              {gameState.currentQuestion.questionType === "Standard" && !gameState.questionRevealed && (
                <button
                  className="btn-reveal"
                  onClick={() => invoke("RevealQuestion")}
                >
                  Show Question
                </button>
              )}
              {(gameState.currentQuestion.questionType === "Image" || gameState.currentQuestion.questionType === "ImageMozaik" || gameState.currentQuestion.questionType === "Audio" || gameState.currentQuestion.questionType === "Video") && (() => {
                const qt = gameState.currentQuestion!.questionType;
                const mediaShowing = gameState.questionRevealed && gameState.mediaVisible;
                const showLabel = qt === "Audio" ? "Display Audio" : qt === "Video" ? "Show Video" : "Show Image";
                const hideLabel = qt === "Audio" ? "🙈 Hide Audio" : qt === "Video" ? "🙈 Hide Video" : "🙈 Hide Image";
                return (
                  <button
                    className={`btn-reveal${mediaShowing ? " active" : ""}`}
                    onClick={() => {
                      if (!gameState.questionRevealed) invoke("RevealQuestion");
                      else if (gameState.mediaVisible) invoke("HideMedia");
                      else invoke("ShowMedia");
                    }}
                  >
                    {mediaShowing ? hideLabel : showLabel}
                  </button>
                );
              })()}
              {gameState.questionRevealed && (gameState.currentQuestion.questionType === "Audio" || gameState.currentQuestion.questionType === "Video" || gameState.currentQuestion.questionType === "ImageMozaik" || gameState.currentQuestion.questionType === "Image") && (
                <div className="media-controls">
                  {(gameState.currentQuestion.questionType === "Audio" || gameState.currentQuestion.questionType === "Video") && (
                    <>
                      <button
                        className={`btn-media ${gameState.mediaPlaying ? "active" : ""}`}
                        onClick={() => invoke(gameState.mediaPlaying ? "StopMedia" : "StartMedia")}
                      >
                        {gameState.mediaPlaying
                          ? gameState.currentQuestion.questionType === "Video" ? "⏸ Pause Video" : "⏸ Stop Audio"
                          : gameState.currentQuestion.questionType === "Video" ? "▶ Play Video" : "▶ Play Audio"}
                      </button>
                      <div className="volume-control">
                        <label htmlFor="volume-slider">🔊 Volume: {gameState.mediaVolume}%</label>
                        <input
                          id="volume-slider"
                          type="range"
                          min={0}
                          max={100}
                          value={gameState.mediaVolume}
                          onChange={(e) => invoke("SetMediaVolume", parseInt(e.target.value))}
                        />
                      </div>
                    </>
                  )}
                  {gameState.currentQuestion.questionType === "ImageMozaik" && (
                    <>
                      <button
                        className={`btn-media ${gameState.mozaikRevealing ? "active" : ""}`}
                        onClick={() => invoke(gameState.mozaikRevealing ? "StopMozaikReveal" : "StartMozaikReveal")}
                      >
                        {gameState.mozaikRevealing ? "⏸ Stop Reveal" : "▶ Start Reveal"}
                      </button>
                      <div className="volume-control">
                        <label htmlFor="mozaik-speed-slider">🖼 Reveal Speed: {gameState.mozaikRevealSpeed}</label>
                        <input
                          id="mozaik-speed-slider"
                          type="range"
                          min={1}
                          max={10}
                          value={gameState.mozaikRevealSpeed}
                          onChange={(e) => invoke("SetMozaikRevealSpeed", parseInt(e.target.value))}
                        />
                      </div>
                    </>
                  )}
                  {(gameState.currentQuestion.questionType === "Image" || gameState.currentQuestion.questionType === "ImageMozaik" || gameState.currentQuestion.questionType === "Video") && (
                    <button
                      className={`btn-media ${gameState.imageFullscreen ? "active" : ""}`}
                      onClick={() => invoke(gameState.imageFullscreen ? "DisableImageFullscreen" : "EnableImageFullscreen")}
                    >
                      {gameState.imageFullscreen ? "🗗 Exit Fullscreen" : "🗖 Fullscreen"}
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
              <button
                className={`btn-media ${gameState.answerRevealed ? "active" : ""}`}
                onClick={() => invoke(gameState.answerRevealed ? "HideAnswer" : "ShowAnswer")}
              >
                {gameState.answerRevealed ? "Hide Answer on Display" : "Show Answer on Display"}
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
              <div className="btn-points-row">
                <button
                  className="btn-double-points"
                  onClick={() => invoke("DoubleRemainingPoints")}
                >
                  Double Remaining Points
                </button>
                <button
                  className="btn-half-points"
                  disabled={gameState.categories.some((c) =>
                    c.questions.some((q) => !q.isAnswered && q.points % 2 !== 0)
                  )}
                  onClick={() => invoke("HalveRemainingPoints")}
                >
                  Half Remaining Points
                </button>
              </div>
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

          <section className="remote-section">
            <div className="volume-control">
              <label htmlFor="winner-volume-slider">🔊 Volume: {gameState.mediaVolume}%</label>
              <input
                id="winner-volume-slider"
                type="range"
                min={0}
                max={100}
                value={gameState.mediaVolume}
                onChange={(e) => invoke("SetMediaVolume", parseInt(e.target.value))}
              />
            </div>
            {gameState.winnerDeclared ? (
              <>
                <button
                  className="btn-revert-winner"
                  onClick={() => invoke("UndeclareWinner")}
                >
                  ↩ Revert Winner
                </button>
                <div className="winner-extras">
                  {gameState.showHighScoreBoard ? (
                    <button
                      className="btn-highscore-toggle"
                      onClick={() => invoke("HideHighScoreBoard")}
                    >
                      ⭐ Hide Highscores
                    </button>
                  ) : (
                    <button
                      className="btn-highscore-toggle active"
                      onClick={() => invoke("ShowHighScoreBoard")}
                    >
                      ⭐ Show Highscores
                    </button>
                  )}
                  <button
                    className="btn-clear-highscores"
                    onClick={() => {
                      if (window.confirm("Clear all highscores? This cannot be undone.")) {
                        invoke("ClearHighScores");
                      }
                    }}
                  >
                    🗑️ Clear Highscores
                  </button>
                  <button
                    className="btn-clear-highscores"
                    onClick={() => {
                      if (window.confirm("Clear all lowscores? This cannot be undone.")) {
                        invoke("ClearLowScores");
                      }
                    }}
                  >
                    🗑️ Clear Lowscores
                  </button>
                </div>
              </>
            ) : (
              <button
                className="btn-declare-winner"
                onClick={() => invoke("DeclareWinner")}
                disabled={gameState.players.length === 0}
              >
                🏆 Declare Winner
              </button>
            )}
          </section>
        </div>
      )}

      {tab === "history" && gameState && (
        <div className="remote-panel">
          <section className="remote-section">
            <h2>Event History</h2>
            <EventHistory events={gameState.eventHistory} />
          </section>
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

      <UploadProgressModal
        visible={uploading}
        progress={uploadProgress}
        message={uploadMessage}
      />
      <ExportProgressModal
        visible={exporting}
        progress={exportProgress}
        message={exportMessage}
      />
      </div>
    </div>
  );
}

export default RemoteControl;
