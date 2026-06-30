import { useRef, useState } from "react";
import JSZip from "jszip";
import type { Category, Question, QuestionType } from "../types/GameState";
import ExportProgressModal from "../components/ExportProgressModal";
import UploadProgressModal from "../components/UploadProgressModal";
import "./RemoteControl.css";
import "./Plan.css";

const VALID_QUESTION_TYPES: ReadonlySet<QuestionType> = new Set<QuestionType>([
  "Standard", "Image", "ImageMozaik", "Audio", "Video",
]);

function normalizeQuestionType(value: unknown): QuestionType {
  return typeof value === "string" && (VALID_QUESTION_TYPES as ReadonlySet<string>).has(value)
    ? (value as QuestionType)
    : "Standard";
}

function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx) : "";
}

interface SourceFile {
  id: string;
  file: File;
}

interface CategoryPreview {
  name: string;
  questionCount: number;
  sourceCount: number;
}

function Merge() {
  const [sources, setSources] = useState<SourceFile[]>([]);
  const [merging, setMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState(0);
  const [mergeMessage, setMergeMessage] = useState("");
  const [preview, setPreview] = useState<CategoryPreview[] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyProgress, setBusyProgress] = useState(0);
  const [busyMessage, setBusyMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const additions: SourceFile[] = [];
    for (let i = 0; i < fileList.length; i++) {
      additions.push({ id: crypto.randomUUID(), file: fileList[i] });
    }
    const next = [...sources, ...additions];
    setSources(next);
    // Reset the input so the same file can be re-selected if it was removed
    if (fileInputRef.current) fileInputRef.current.value = "";
    await refreshPreview(next);
  };

  const handleRemoveSource = async (id: string) => {
    const next = sources.filter((s) => s.id !== id);
    setSources(next);
    await refreshPreview(next);
  };

  const handleClearSources = () => {
    setSources([]);
    setPreview(null);
    setPreviewError(null);
  };

  const refreshPreview = async (currentSources: SourceFile[]) => {
    setPreviewError(null);
    if (currentSources.length === 0) {
      setPreview(null);
      return;
    }
    setBusy(true);
    setBusyProgress(0);
    setBusyMessage("Reading ZIP files…");
    try {
      // Map of lowercased trimmed name -> { displayName, questionCount, sourceCount, sourceIds }
      const acc = new Map<
        string,
        { displayName: string; questionCount: number; sourceIds: Set<string> }
      >();
      for (let i = 0; i < currentSources.length; i++) {
        const s = currentSources[i];
        setBusyMessage(
          `Reading file ${i + 1} of ${currentSources.length}: ${s.file.name}`,
        );
        const zip = await JSZip.loadAsync(s.file);
        const jsonFile = zip.file("quiz-questions.json");
        if (!jsonFile) {
          throw new Error(
            `"${s.file.name}" does not contain a quiz-questions.json file`,
          );
        }
        const jsonText = await jsonFile.async("string");
        const data = JSON.parse(jsonText);
        const cats: unknown = data.categories ?? data.Categories;
        if (!Array.isArray(cats)) {
          throw new Error(`"${s.file.name}" has no categories`);
        }
        for (const c of cats as Category[]) {
          const display = (c.name ?? "").trim();
          const key = display.toLowerCase();
          const existing = acc.get(key);
          const qCount = Array.isArray(c.questions) ? c.questions.length : 0;
          if (existing) {
            existing.questionCount += qCount;
            existing.sourceIds.add(s.id);
          } else {
            acc.set(key, {
              displayName: display || "(unnamed)",
              questionCount: qCount,
              sourceIds: new Set([s.id]),
            });
          }
        }
        setBusyProgress(((i + 1) / currentSources.length) * 100);
      }
      const list: CategoryPreview[] = Array.from(acc.values()).map((v) => ({
        name: v.displayName,
        questionCount: v.questionCount,
        sourceCount: v.sourceIds.size,
      }));
      setPreview(list);
    } catch (err) {
      setPreview(null);
      setPreviewError(
        err instanceof Error
          ? err.message
          : "Failed to read one of the selected ZIP files",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleMerge = async () => {
    if (sources.length < 2) {
      alert("Please add at least two ZIP files to merge.");
      return;
    }
    setMerging(true);
    setMergeProgress(0);
    setMergeMessage("Reading files…");
    try {
      // Map of lowercased trimmed name -> merged Category (with new id)
      const mergedByName = new Map<string, Category>();
      // Map of media file name -> Blob, used to detect collisions
      const mergedMedia = new Map<string, Blob>();
      const totalFiles = sources.length;

      for (let i = 0; i < sources.length; i++) {
        const src = sources[i];
        const baseProgress = (i / totalFiles) * 80;
        setMergeProgress(baseProgress);
        setMergeMessage(
          `Processing file ${i + 1} of ${totalFiles}: ${src.file.name}`,
        );

        const zip = await JSZip.loadAsync(src.file);
        const jsonFile = zip.file("quiz-questions.json");
        if (!jsonFile) {
          throw new Error(
            `"${src.file.name}" does not contain a quiz-questions.json file`,
          );
        }
        const jsonText = await jsonFile.async("string");
        const data = JSON.parse(jsonText);
        const cats: unknown = data.categories ?? data.Categories;
        if (!Array.isArray(cats)) {
          throw new Error(`"${src.file.name}" has no categories`);
        }

        // Pull media files out of the zip and remap names that collide
        const localMediaMap = new Map<string, string>(); // originalName -> finalName
        const mediaFolder = zip.folder("media");
        if (mediaFolder) {
          const entries: { name: string; obj: JSZip.JSZipObject }[] = [];
          mediaFolder.forEach((relativePath, f) => {
            if (!f.dir) entries.push({ name: relativePath, obj: f });
          });
          for (let j = 0; j < entries.length; j++) {
            const { name, obj } = entries[j];
            setMergeMessage(
              `Reading media from ${src.file.name} (${j + 1}/${entries.length}): ${name}`,
            );
            const blob = await obj.async("blob");
            let finalName = name;
            if (mergedMedia.has(finalName)) {
              // Collision: keep a new uuid-based filename so both files survive
              finalName = `${crypto.randomUUID()}${getExtension(name)}`;
            }
            mergedMedia.set(finalName, blob);
            localMediaMap.set(name, finalName);
          }
        }

        // Merge categories by trimmed, case-insensitive name
        for (const cat of cats as Category[]) {
          const displayName = (cat.name ?? "").trim();
          const key = displayName.toLowerCase();
          let target = mergedByName.get(key);
          if (!target) {
            target = {
              id: crypto.randomUUID(),
              name: displayName || (cat.name ?? ""),
              questions: [],
            };
            mergedByName.set(key, target);
          }
          const sourceQuestions = Array.isArray(cat.questions)
            ? cat.questions
            : [];
          for (const q of sourceQuestions as Question[]) {
            target.questions.push({
              id: crypto.randomUUID(),
              text: q.text ?? "",
              answer: q.answer ?? "",
              points: typeof q.points === "number" ? q.points : 200,
              isAnswered: false,
              categoryId: target.id,
              questionType: normalizeQuestionType(q.questionType),
              mediaFileName: q.mediaFileName
                ? (localMediaMap.get(q.mediaFileName) ?? q.mediaFileName)
                : null,
              answerImageFileName: q.answerImageFileName
                ? (localMediaMap.get(q.answerImageFileName) ?? q.answerImageFileName)
                : null,
            });
          }
        }
      }

      setMergeProgress(85);
      setMergeMessage("Generating merged ZIP file…");

      const mergedCategories = Array.from(mergedByName.values());
      const out = new JSZip();
      out.file(
        "quiz-questions.json",
        JSON.stringify({ categories: mergedCategories }, null, 2),
      );
      const mediaFolder = out.folder("media")!;
      for (const [name, blob] of mergedMedia) {
        mediaFolder.file(name, blob);
      }

      const blob = await out.generateAsync({ type: "blob" });
      setMergeProgress(100);
      setMergeMessage("Download ready");

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "quiz-questions-merged.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to merge the selected ZIP files.";
      alert(message);
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="remote-page">
      <div className="remote-container plan-container">
        <div className="plan-header">
          <h1 className="plan-title">Quiz Merger</h1>
          <p className="plan-subtitle">
            Combine two or more quiz ZIPs (exported from the Planner or as
            "Questions only" from the Remote Control) into a single merged
            ZIP. Categories that share the same name are merged into one,
            keeping all of their questions. Everything runs in your browser –
            nothing is sent to the server and the running game is not
            touched.
          </p>
        </div>

        <div className="remote-panel">
          <section className="remote-section">
            <h2>Source ZIPs</h2>
            <div className="input-row">
              <label className="btn-import">
                📥 Add ZIP files
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  multiple
                  onChange={handleAddFiles}
                  hidden
                />
              </label>
              {sources.length > 0 && (
                <button className="btn-reset" onClick={handleClearSources}>
                  Clear list
                </button>
              )}
            </div>
            {sources.length === 0 && (
              <p className="plan-hint">
                Add at least two ZIP files to enable merging. You can add
                files one at a time or select several at once.
              </p>
            )}
            {sources.length > 0 && (
              <ul className="item-list">
                {sources.map((s) => (
                  <li key={s.id}>
                    <span>{s.file.name}</span>
                    <button
                      className="btn-remove"
                      onClick={() => handleRemoveSource(s.id)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {previewError && (
            <section className="remote-section">
              <h2>Preview</h2>
              <p className="plan-hint" style={{ color: "#fca5a5" }}>
                {previewError}
              </p>
            </section>
          )}

          {preview && preview.length > 0 && (
            <section className="remote-section">
              <h2>Merged Preview</h2>
              <p className="plan-hint">
                {preview.length} categor{preview.length === 1 ? "y" : "ies"}{" "}
                will be produced from {sources.length} file
                {sources.length === 1 ? "" : "s"}.
              </p>
              <ul className="item-list">
                {preview.map((p) => (
                  <li key={p.name}>
                    <span>
                      {p.name} ({p.questionCount} question
                      {p.questionCount === 1 ? "" : "s"}
                      {p.sourceCount > 1 ? `, merged from ${p.sourceCount} files` : ""}
                      )
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="remote-section">
            <h2>Merge</h2>
            <div className="input-row">
              <button
                onClick={handleMerge}
                disabled={sources.length < 2 || merging}
              >
                🔀 Merge & Download ZIP
              </button>
            </div>
            <p className="plan-hint">
              The resulting ZIP uses the same format as the Planner export
              and can be imported directly on the Remote Control's Setup
              tab or in the Planner.
            </p>
          </section>
        </div>

        <ExportProgressModal
          visible={merging}
          progress={mergeProgress}
          message={mergeMessage}
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

export default Merge;
