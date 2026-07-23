import { useRef, useState } from "react";
import JSZip from "jszip";
import type { Category, Question, QuestionType } from "../types/GameState";
import ExportProgressModal from "../components/ExportProgressModal";
import UploadProgressModal from "../components/UploadProgressModal";
import "./RemoteControl.css";
import "./Plan.css";
import "./Merge.css";

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

interface SourceCategory {
  // Lowercased, trimmed category name used as the merge/selection key.
  key: string;
  // Display name as it should appear to the user.
  name: string;
  questionCount: number;
  // Whether this category is included in the merge.
  selected: boolean;
}

interface SourceFile {
  id: string;
  file: File;
  categories: SourceCategory[];
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
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyProgress, setBusyProgress] = useState(0);
  const [busyMessage, setBusyMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    // Reset the input so the same file can be re-selected if it was removed
    if (fileInputRef.current) fileInputRef.current.value = "";

    setPreviewError(null);
    setBusy(true);
    setBusyProgress(0);
    setBusyMessage("Reading ZIP files…");
    try {
      const additions: SourceFile[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setBusyMessage(`Reading file ${i + 1} of ${files.length}: ${file.name}`);
        additions.push(await readSourceFile(file));
        setBusyProgress(((i + 1) / files.length) * 100);
      }
      setSources((prev) => [...prev, ...additions]);
    } catch (err) {
      setPreviewError(
        err instanceof Error
          ? err.message
          : "Failed to read one of the selected ZIP files",
      );
    } finally {
      setBusy(false);
    }
  };

  const readSourceFile = async (file: File): Promise<SourceFile> => {
    const zip = await JSZip.loadAsync(file);
    const jsonFile = zip.file("quiz-questions.json");
    if (!jsonFile) {
      throw new Error(
        `"${file.name}" does not contain a quiz-questions.json file`,
      );
    }
    const jsonText = await jsonFile.async("string");
    const data = JSON.parse(jsonText);
    const cats: unknown = data.categories ?? data.Categories;
    if (!Array.isArray(cats)) {
      throw new Error(`"${file.name}" has no categories`);
    }
    // Merge categories that share a name within the same file, preserving order.
    const byKey = new Map<string, SourceCategory>();
    for (const c of cats as Category[]) {
      const display = (c.name ?? "").trim();
      const key = display.toLowerCase();
      const qCount = Array.isArray(c.questions) ? c.questions.length : 0;
      const existing = byKey.get(key);
      if (existing) {
        existing.questionCount += qCount;
      } else {
        byKey.set(key, {
          key,
          name: display || "(unnamed)",
          questionCount: qCount,
          selected: true,
        });
      }
    }
    return { id: crypto.randomUUID(), file, categories: Array.from(byKey.values()) };
  };

  const handleRemoveSource = (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
  };

  const handleClearSources = () => {
    setSources([]);
    setPreviewError(null);
  };

  const toggleCategory = (sourceId: string, key: string) => {
    setSources((prev) =>
      prev.map((s) =>
        s.id !== sourceId
          ? s
          : {
              ...s,
              categories: s.categories.map((c) =>
                c.key === key ? { ...c, selected: !c.selected } : c,
              ),
            },
      ),
    );
  };

  const setAllCategoriesSelected = (sourceId: string, selected: boolean) => {
    setSources((prev) =>
      prev.map((s) =>
        s.id !== sourceId
          ? s
          : { ...s, categories: s.categories.map((c) => ({ ...c, selected })) },
      ),
    );
  };

  // Derived preview of the categories that will be produced from the current
  // selection, merging same-named categories across every source file.
  const preview: CategoryPreview[] = (() => {
    const acc = new Map<
      string,
      { displayName: string; questionCount: number; sourceIds: Set<string> }
    >();
    for (const s of sources) {
      for (const c of s.categories) {
        if (!c.selected) continue;
        const existing = acc.get(c.key);
        if (existing) {
          existing.questionCount += c.questionCount;
          existing.sourceIds.add(s.id);
        } else {
          acc.set(c.key, {
            displayName: c.name,
            questionCount: c.questionCount,
            sourceIds: new Set([s.id]),
          });
        }
      }
    }
    return Array.from(acc.values()).map((v) => ({
      name: v.displayName,
      questionCount: v.questionCount,
      sourceCount: v.sourceIds.size,
    }));
  })();

  const selectedCategoryCount = sources.reduce(
    (sum, s) => sum + s.categories.filter((c) => c.selected).length,
    0,
  );

  const handleMerge = async () => {
    if (sources.length < 2) {
      alert("Please add at least two ZIP files to merge.");
      return;
    }
    if (selectedCategoryCount === 0) {
      alert("Please select at least one category to merge.");
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

        // Only merge the categories the user selected for this source file.
        const selectedKeys = new Set(
          src.categories.filter((c) => c.selected).map((c) => c.key),
        );
        const selectedCats = (cats as Category[]).filter((cat) =>
          selectedKeys.has((cat.name ?? "").trim().toLowerCase()),
        );

        // Collect the media referenced by the selected categories so unused
        // media from deselected categories is not carried into the output.
        const referencedMedia = new Set<string>();
        for (const cat of selectedCats) {
          const qs = Array.isArray(cat.questions) ? cat.questions : [];
          for (const q of qs as Question[]) {
            if (q.mediaFileName) referencedMedia.add(q.mediaFileName);
            if (q.answerImageFileName) referencedMedia.add(q.answerImageFileName);
          }
        }

        // Pull referenced media files out of the zip and remap names that collide
        const localMediaMap = new Map<string, string>(); // originalName -> finalName
        const mediaFolder = zip.folder("media");
        if (mediaFolder) {
          const entries: { name: string; obj: JSZip.JSZipObject }[] = [];
          mediaFolder.forEach((relativePath, f) => {
            if (!f.dir && referencedMedia.has(relativePath)) {
              entries.push({ name: relativePath, obj: f });
            }
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

        // Merge selected categories by trimmed, case-insensitive name
        for (const cat of selectedCats) {
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
            ZIP. Pick exactly which categories to take from each uploaded
            file. Categories that share the same name are merged into one,
            keeping all of their selected questions. Everything runs in your
            browser – nothing is sent to the server and the running game is
            not touched.
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
            {sources.map((s) => {
              const selectedCount = s.categories.filter((c) => c.selected).length;
              return (
                <div key={s.id} className="merge-source">
                  <div className="merge-source-header">
                    <span className="merge-source-name">{s.file.name}</span>
                    <button
                      className="btn-remove"
                      onClick={() => handleRemoveSource(s.id)}
                    >
                      ✕
                    </button>
                  </div>
                  {s.categories.length === 0 ? (
                    <p className="plan-hint">This file has no categories.</p>
                  ) : (
                    <>
                      <div className="merge-source-actions">
                        <span className="plan-hint">
                          {selectedCount} of {s.categories.length} categor
                          {s.categories.length === 1 ? "y" : "ies"} selected
                        </span>
                        <button
                          className="btn-sort merge-select-btn"
                          onClick={() => setAllCategoriesSelected(s.id, true)}
                          disabled={selectedCount === s.categories.length}
                        >
                          Select all
                        </button>
                        <button
                          className="btn-sort merge-select-btn"
                          onClick={() => setAllCategoriesSelected(s.id, false)}
                          disabled={selectedCount === 0}
                        >
                          Select none
                        </button>
                      </div>
                      <ul className="item-list">
                        {s.categories.map((c) => (
                          <li key={c.key}>
                            <label className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={c.selected}
                                onChange={() => toggleCategory(s.id, c.key)}
                              />
                              <span>
                                {c.name} ({c.questionCount} question
                                {c.questionCount === 1 ? "" : "s"})
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              );
            })}
          </section>

          {previewError && (
            <section className="remote-section">
              <h2>Preview</h2>
              <p className="plan-hint" style={{ color: "#fca5a5" }}>
                {previewError}
              </p>
            </section>
          )}

          {preview.length > 0 && (
            <section className="remote-section">
              <h2>Merged Preview</h2>
              <p className="plan-hint">
                {preview.length} categor{preview.length === 1 ? "y" : "ies"}{" "}
                will be produced from {selectedCategoryCount} selected
                categor{selectedCategoryCount === 1 ? "y" : "ies"} across{" "}
                {sources.length} file{sources.length === 1 ? "" : "s"}.
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
                disabled={sources.length < 2 || selectedCategoryCount === 0 || merging}
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
