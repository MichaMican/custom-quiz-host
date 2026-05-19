import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import type { Category, Question, QuestionType } from "../types/GameState";
import {
  savePlanCategories,
  loadPlanCategories,
  clearPlanCategories,
  savePlanImportedFileName,
  loadPlanImportedFileName,
  savePlanMedia,
  loadPlanMedia,
  clearPlanMedia,
  pruneOrphanedPlanMedia,
  collectReferencedMediaFileNames,
} from "../utils/planStorage";
import ExportProgressModal from "../components/ExportProgressModal";
import UploadProgressModal from "../components/UploadProgressModal";
import "./RemoteControl.css";
import "./Plan.css";

const POINT_LEVELS = [200, 400, 600, 800, 1000];

const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".mp3", ".wav", ".ogg", ".m4a", ".aac",
  ".mp4", ".webm", ".ogv", ".mov", ".wmv",
]);

function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

function makeStoredFileName(originalName: string): string {
  const ext = getExtension(originalName) || ".bin";
  return `${crypto.randomUUID()}${ext}`;
}

function isAllowedMediaExtension(name: string): boolean {
  return ALLOWED_EXTENSIONS.has(getExtension(name));
}

function Plan() {
  const [categories, setCategories] = useState<Category[]>(() => loadPlanCategories());
  const [categoryName, setCategoryName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [questionAnswer, setQuestionAnswer] = useState("");
  const [questionPoints, setQuestionPoints] = useState(200);
  const [questionType, setQuestionType] = useState<QuestionType>("Standard");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [existingMediaFileName, setExistingMediaFileName] = useState<string | null>(null);
  const [answerImageFile, setAnswerImageFile] = useState<File | null>(null);
  const [existingAnswerImageFileName, setExistingAnswerImageFileName] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [importedFileName, setImportedFileName] = useState<string | null>(() => loadPlanImportedFileName());
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMessage, setExportMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyProgress, setBusyProgress] = useState(0);
  const [busyMessage, setBusyMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const answerImageInputRef = useRef<HTMLInputElement>(null);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const selectedCategoryQuestions = selectedCategory?.questions;

  // Persist categories on every change
  useEffect(() => {
    savePlanCategories(categories);
  }, [categories]);

  const resetQuestionForm = () => {
    setEditingQuestionId(null);
    setQuestionText("");
    setQuestionAnswer("");
    setQuestionPoints(200);
    setQuestionType("Standard");
    setMediaFile(null);
    setExistingMediaFileName(null);
    setAnswerImageFile(null);
    setExistingAnswerImageFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (answerImageInputRef.current) answerImageInputRef.current.value = "";
  };

  const handleAddCategory = () => {
    const name = categoryName.trim();
    if (!name) return;
    setCategories((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name, questions: [] },
    ]);
    setCategoryName("");
  };

  const handleRemoveCategory = (id: string) => {
    setCategories((prev) => {
      const next = prev.filter((c) => c.id !== id);
      // best-effort prune of media that's no longer referenced
      void pruneOrphanedPlanMedia(next);
      return next;
    });
    if (selectedCategoryId === id) {
      setSelectedCategoryId("");
      resetQuestionForm();
    }
  };

  const handleAddOrUpdateQuestion = async () => {
    if (!selectedCategoryId) return;
    if (questionType === "Standard" && !questionText.trim()) return;
    if (questionType !== "Standard" && !mediaFile && !existingMediaFileName) return;

    // Persist any newly selected media files into IndexedDB
    let mediaFileName: string | null = existingMediaFileName;
    let answerImageFileName: string | null = existingAnswerImageFileName;

    try {
      if (mediaFile) {
        if (!isAllowedMediaExtension(mediaFile.name)) {
          alert("File type not allowed.");
          return;
        }
        mediaFileName = makeStoredFileName(mediaFile.name);
        await savePlanMedia(mediaFileName, mediaFile);
      }
      if (answerImageFile) {
        if (!isAllowedMediaExtension(answerImageFile.name)) {
          alert("Answer image type not allowed.");
          return;
        }
        answerImageFileName = makeStoredFileName(answerImageFile.name);
        await savePlanMedia(answerImageFileName, answerImageFile);
      }
    } catch {
      alert("Failed to save media to local storage.");
      return;
    }

    setCategories((prev) => {
      const next = prev.map((c) => {
        if (c.id !== selectedCategoryId) return c;
        if (editingQuestionId) {
          return {
            ...c,
            questions: c.questions.map((q) =>
              q.id === editingQuestionId
                ? {
                    ...q,
                    text: questionText.trim(),
                    answer: questionAnswer.trim(),
                    points: questionPoints,
                    questionType,
                    mediaFileName: questionType === "Standard" ? null : mediaFileName,
                    answerImageFileName,
                  }
                : q,
            ),
          };
        }
        const newQuestion: Question = {
          id: crypto.randomUUID(),
          text: questionText.trim(),
          answer: questionAnswer.trim(),
          points: questionPoints,
          isAnswered: false,
          categoryId: c.id,
          questionType,
          mediaFileName: questionType === "Standard" ? null : mediaFileName,
          answerImageFileName,
        };
        return { ...c, questions: [...c.questions, newQuestion] };
      });
      void pruneOrphanedPlanMedia(next);
      return next;
    });

    resetQuestionForm();
  };

  const handleEditQuestion = (questionId: string) => {
    const q = selectedCategoryQuestions?.find((x) => x.id === questionId);
    if (!q) return;
    setEditingQuestionId(q.id);
    setQuestionText(q.text);
    setQuestionAnswer(q.answer);
    setQuestionPoints(q.points);
    setQuestionType(q.questionType);
    setExistingMediaFileName(q.mediaFileName ?? null);
    setMediaFile(null);
    setExistingAnswerImageFileName(q.answerImageFileName ?? null);
    setAnswerImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (answerImageInputRef.current) answerImageInputRef.current.value = "";
  };

  const handleRemoveQuestion = (questionId: string) => {
    setCategories((prev) => {
      const next = prev.map((c) =>
        c.id === selectedCategoryId
          ? { ...c, questions: c.questions.filter((q) => q.id !== questionId) }
          : c,
      );
      void pruneOrphanedPlanMedia(next);
      return next;
    });
    if (editingQuestionId === questionId) {
      resetQuestionForm();
    }
  };

  const handleMoveQuestion = (questionId: string, direction: "up" | "down") => {
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id !== selectedCategoryId) return c;
        const idx = c.questions.findIndex((q) => q.id === questionId);
        if (idx < 0) return c;
        const newIdx = direction === "up" ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= c.questions.length) return c;
        const reordered = [...c.questions];
        const [item] = reordered.splice(idx, 1);
        reordered.splice(newIdx, 0, item);
        return { ...c, questions: reordered };
      }),
    );
  };

  const handleSortByPoints = () => {
    setCategories((prev) =>
      prev.map((c) =>
        c.id === selectedCategoryId
          ? { ...c, questions: [...c.questions].sort((a, b) => a.points - b.points) }
          : c,
      ),
    );
  };

  const handleReset = async () => {
    setCategories([]);
    clearPlanCategories();
    savePlanImportedFileName(null);
    setImportedFileName(null);
    try {
      await clearPlanMedia();
    } catch {
      // ignore
    }
    resetQuestionForm();
    setSelectedCategoryId("");
    setShowResetModal(false);
  };

  const handleExport = async () => {
    if (categories.length === 0) {
      alert("Nothing to export – add some categories and questions first.");
      return;
    }
    setExporting(true);
    setExportProgress(0);
    setExportMessage("Preparing export…");
    try {
      const zip = new JSZip();
      zip.file(
        "quiz-questions.json",
        JSON.stringify({ categories }, null, 2),
      );
      const mediaFolder = zip.folder("media")!;
      const mediaFileNames = collectReferencedMediaFileNames(categories);
      for (let i = 0; i < mediaFileNames.length; i++) {
        const name = mediaFileNames[i];
        setExportProgress((i / Math.max(mediaFileNames.length, 1)) * 90);
        setExportMessage(`Reading file ${i + 1} of ${mediaFileNames.length}: ${name}`);
        const blob = await loadPlanMedia(name);
        if (blob) {
          mediaFolder.file(name, blob);
        } else {
          console.warn(`Media file missing from local storage: ${name}`);
        }
      }
      setExportProgress(90);
      setExportMessage("Generating ZIP file…");
      const blob = await zip.generateAsync({ type: "blob" });
      setExportProgress(100);
      setExportMessage("Download ready");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = importedFileName || "quiz-questions.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      alert("Failed to export questions.");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const zip = await JSZip.loadAsync(file);
      const jsonFile = zip.file("quiz-questions.json");
      if (!jsonFile) {
        alert("The ZIP file does not contain a quiz-questions.json file");
        e.target.value = "";
        return;
      }
      const jsonText = await jsonFile.async("string");
      const data = JSON.parse(jsonText);
      const importedCategories: unknown = data.categories ?? data.Categories;
      if (!Array.isArray(importedCategories) || importedCategories.length === 0) {
        alert("The selected file does not contain any questions");
        e.target.value = "";
        return;
      }

      // Store all media files from the zip into IndexedDB under their original names
      const mediaFolder = zip.folder("media");
      const mediaEntries: { name: string; file: JSZip.JSZipObject }[] = [];
      if (mediaFolder) {
        mediaFolder.forEach((relativePath, f) => {
          if (!f.dir) mediaEntries.push({ name: relativePath, file: f });
        });
      }

      if (mediaEntries.length > 0) {
        setBusy(true);
        setBusyProgress(0);
        setBusyMessage("Importing media…");
        for (let i = 0; i < mediaEntries.length; i++) {
          const { name, file: mediaFileEntry } = mediaEntries[i];
          setBusyMessage(`Importing file ${i + 1} of ${mediaEntries.length}: ${name}`);
          try {
            const blob = await mediaFileEntry.async("blob");
            await savePlanMedia(name, blob);
          } catch {
            console.warn(`Failed to store media file: ${name}`);
          }
          setBusyProgress(((i + 1) / mediaEntries.length) * 100);
        }
        setBusy(false);
      }

      // Normalize imported categories: ensure ids/categoryIds exist, fill defaults
      const normalized: Category[] = (importedCategories as Category[]).map((c) => {
        const catId = c.id || crypto.randomUUID();
        return {
          id: catId,
          name: c.name ?? "",
          questions: (c.questions ?? []).map((q) => ({
            id: q.id || crypto.randomUUID(),
            text: q.text ?? "",
            answer: q.answer ?? "",
            points: typeof q.points === "number" ? q.points : 200,
            isAnswered: false,
            categoryId: catId,
            questionType: (q.questionType as QuestionType) ?? "Standard",
            mediaFileName: q.mediaFileName ?? null,
            answerImageFileName: q.answerImageFileName ?? null,
          })),
        };
      });

      setCategories(normalized);
      setSelectedCategoryId("");
      resetQuestionForm();
      setImportedFileName(file.name);
      savePlanImportedFileName(file.name);
      // Prune any pre-existing blobs that aren't referenced by the new import
      void pruneOrphanedPlanMedia(normalized);
    } catch {
      alert("Failed to import questions: the ZIP file may be corrupted or contain invalid data");
    }
    e.target.value = "";
  };

  return (
    <div className="remote-page">
      <div className="remote-container plan-container">
        <div className="plan-header">
          <h1 className="plan-title">Quiz Planner</h1>
          <p className="plan-subtitle">
            Build and edit quiz boards offline. Nothing is sent to the server –
            everything is stored in your browser. Export a ZIP to load into the
            Remote Control when you're ready to play.
          </p>
        </div>

        <div className="remote-panel">
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
              {categories.map((c) => (
                <li key={c.id}>
                  <span>
                    {c.name} ({c.questions.length} questions)
                  </span>
                  <button
                    className="btn-remove"
                    onClick={() => handleRemoveCategory(c.id)}
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
                onChange={(e) => {
                  setSelectedCategoryId(e.target.value);
                  resetQuestionForm();
                }}
              >
                <option value="">Select category</option>
                {categories.map((c) => (
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
              <div className="plan-form-actions">
                <button onClick={handleAddOrUpdateQuestion} disabled={!selectedCategoryId}>
                  {editingQuestionId ? "Save Changes" : "Add Question"}
                </button>
                {editingQuestionId && (
                  <button className="btn-cancel-edit" onClick={resetQuestionForm}>
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>
            {selectedCategoryId && selectedCategoryQuestions && selectedCategoryQuestions.length > 0 && (
              <>
                <button className="btn-sort" onClick={handleSortByPoints}>
                  Sort by Points ↑
                </button>
                <ul className="item-list">
                  {selectedCategoryQuestions.map((q, idx) => (
                    <li key={q.id} className={editingQuestionId === q.id ? "is-editing" : undefined}>
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
                          onClick={() => handleMoveQuestion(q.id, "up")}
                          title="Move up"
                        >
                          ▲
                        </button>
                        <button
                          className="btn-move"
                          disabled={idx === selectedCategoryQuestions.length - 1}
                          onClick={() => handleMoveQuestion(q.id, "down")}
                          title="Move down"
                        >
                          ▼
                        </button>
                        <button
                          className="btn-remove"
                          onClick={() => handleRemoveQuestion(q.id)}
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
            {importedFileName && (
              <p className="plan-imported-name">Current file: {importedFileName}</p>
            )}
            <div className="input-row">
              <button onClick={handleExport}>📤 Export Questions</button>
              <label className="btn-import">
                📥 Import Questions
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleImport}
                  hidden
                />
              </label>
            </div>
            <p className="plan-hint">
              Exports a "Questions only" ZIP that is fully compatible with the
              Import on the Remote Control's Setup page.
            </p>
          </section>

          <section className="remote-section">
            <h2>Reset</h2>
            <button className="btn-reset" onClick={() => setShowResetModal(true)}>
              Reset Plan
            </button>
          </section>
        </div>

        {showResetModal && (
          <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>Reset Plan</h2>
              <p>
                Are you sure you want to reset the plan? This will delete all
                categories, questions and uploaded media files from your browser.
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

        <ExportProgressModal
          visible={exporting}
          progress={exportProgress}
          message={exportMessage}
        />
        <UploadProgressModal
          visible={busy}
          progress={busyProgress}
          message={busyMessage}
        />
      </div>
    </div>
  );
}

export default Plan;
