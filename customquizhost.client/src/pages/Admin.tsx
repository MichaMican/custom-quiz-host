import { useEffect, useMemo, useRef, useState } from "react";
import UploadProgressModal from "../components/UploadProgressModal";
import { uploadFileWithProgress } from "../utils/uploadWithProgress";
import {
  buildQuizArchive,
  getArchiveText,
  listArchiveMedia,
  readQuizArchive,
} from "../utils/quizArchive";
import "./RemoteControl.css";
import "./Plan.css";
import "./Admin.css";

interface SoundboardSound {
  id: string;
  name: string;
  fileName: string;
}

/** Name of the metadata file inside an exported soundboard ZIP. */
const SOUNDBOARD_JSON = "soundboard.json";

interface MediaFile {
  fileName: string;
  size: number;
  lastModified: string;
  referenced: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function Admin() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  // Kept in memory only (never persisted) to avoid storing the password in clear text
  const [password, setPassword] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sounds, setSounds] = useState<SoundboardSound[]>([]);
  const [soundName, setSoundName] = useState("");
  const [soundFile, setSoundFile] = useState<File | null>(null);
  const [soundError, setSoundError] = useState<string | null>(null);
  const [soundBusy, setSoundBusy] = useState(false);
  const [selectedSoundId, setSelectedSoundId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState("");
  const soundFileInputRef = useRef<HTMLInputElement>(null);
  const soundImportInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"media" | "soundboard">("media");

  const showToast = (message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(null), 6000);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleUnauthorized = () => {
    setPassword(null);
    setAuthError("Session expired. Please enter the password again.");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput }),
      });
      if (res.status === 401) {
        setAuthError("Incorrect password.");
        return;
      }
      if (!res.ok) throw new Error(`Verification failed (${res.status})`);
      setPassword(passwordInput);
      setPasswordInput("");
      setLoading(true);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setAuthBusy(false);
    }
  };

  useEffect(() => {
    if (!password) return;
    let ignore = false;
    fetch("/api/media", { headers: { "X-Admin-Password": password } })
      .then(async (res) => {
        if (res.status === 401) {
          if (!ignore) handleUnauthorized();
          return;
        }
        if (!res.ok) throw new Error(`Failed to load media (${res.status})`);
        const data: MediaFile[] = await res.json();
        if (ignore) return;
        setError(null);
        setFiles(data);
        setSelected((prev) => {
          const names = new Set(data.map((f) => f.fileName));
          return new Set([...prev].filter((n) => names.has(n)));
        });
      })
      .catch((e: unknown) => {
        if (ignore) return;
        setError(e instanceof Error ? e.message : "Failed to load media files.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [reloadToken, password]);

  useEffect(() => {
    if (!password) return;
    let ignore = false;
    fetch("/api/soundboard", { headers: { "X-Admin-Password": password } })
      .then(async (res) => {
        if (res.status === 401) {
          if (!ignore) handleUnauthorized();
          return;
        }
        if (!res.ok) throw new Error(`Failed to load sounds (${res.status})`);
        const data: SoundboardSound[] = await res.json();
        if (ignore) return;
        setSoundError(null);
        setSounds(data);
        setSelectedSoundId((prev) =>
          data.some((s) => s.id === prev) ? prev : ""
        );
      })
      .catch((e: unknown) => {
        if (ignore) return;
        setSoundError(e instanceof Error ? e.message : "Failed to load sounds.");
      });
    return () => {
      ignore = true;
    };
  }, [reloadToken, password]);

  const loadFiles = () => setReloadToken((t) => t + 1);

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    loadFiles();
  };

  const allSelected = files.length > 0 && selected.size === files.length;

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(files.map((f) => f.fileName)));
  };

  const toggleSelect = (fileName: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fileName)) next.delete(fileName);
      else next.add(fileName);
      return next;
    });
  };

  const totalSize = useMemo(
    () => files.reduce((sum, f) => sum + f.size, 0),
    [files]
  );

  const handleDownloadSelected = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/media/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": password ?? "",
        },
        body: JSON.stringify({ fileNames: [...selected] }),
      });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) throw new Error(await res.text() || `Download failed (${res.status})`);
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^";]+)"?/);
      triggerBlobDownload(blob, match?.[1] ?? "media.zip");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    if (
      !window.confirm(
        `Delete ${selected.size} selected file${selected.size === 1 ? "" : "s"}? This cannot be undone.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/media/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": password ?? "",
        },
        body: JSON.stringify({ fileNames: [...selected] }),
      });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) throw new Error(await res.text() || `Delete failed (${res.status})`);
      const result: { deleted: string[]; skippedReferenced: string[]; errors: string[] } =
        await res.json();
      if (result.errors.length > 0) {
        setError(result.errors.join(" "));
      }
      if (result.skippedReferenced.length > 0) {
        showToast(
          `${result.skippedReferenced.length} file${result.skippedReferenced.length === 1 ? " is" : "s are"} still referenced by the current game and ${result.skippedReferenced.length === 1 ? "was" : "were"} not deleted.`
        );
      }
      setSelected(new Set());
      loadFiles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
      loadFiles();
    } finally {
      setBusy(false);
    }
  };

  const handleAddSound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!soundFile || soundName.trim().length === 0) return;
    setSoundBusy(true);
    setSoundError(null);
    setUploading(true);
    setUploadProgress(0);
    setUploadMessage(`Uploading ${soundFile.name}…`);
    try {
      const { fileName } = await uploadFileWithProgress(soundFile, (percent) =>
        setUploadProgress(percent)
      );
      setUploading(false);
      const res = await fetch("/api/soundboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": password ?? "",
        },
        body: JSON.stringify({ name: soundName.trim(), fileName }),
      });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) throw new Error((await res.text()) || `Upload failed (${res.status})`);
      setSounds(await res.json());
      setSoundName("");
      setSoundFile(null);
      if (soundFileInputRef.current) soundFileInputRef.current.value = "";
      loadFiles();
    } catch (err) {
      setSoundError(err instanceof Error ? err.message : "Adding the sound failed.");
    } finally {
      setUploading(false);
      setSoundBusy(false);
    }
  };

  const handleDeleteSound = async () => {
    if (!selectedSoundId) return;
    const sound = sounds.find((s) => s.id === selectedSoundId);
    if (!window.confirm(`Delete the sound "${sound?.name ?? ""}"? This cannot be undone.`)) {
      return;
    }
    setSoundBusy(true);
    setSoundError(null);
    try {
      const res = await fetch("/api/soundboard/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": password ?? "",
        },
        body: JSON.stringify({ id: selectedSoundId }),
      });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) throw new Error((await res.text()) || `Delete failed (${res.status})`);
      setSounds(await res.json());
      setSelectedSoundId("");
      loadFiles();
    } catch (err) {
      setSoundError(err instanceof Error ? err.message : "Deleting the sound failed.");
    } finally {
      setSoundBusy(false);
    }
  };

  const handleExportSounds = async () => {
    if (sounds.length === 0) return;
    setSoundBusy(true);
    setSoundError(null);
    try {
      const media = new Map<string, Blob>();
      for (const sound of sounds) {
        if (media.has(sound.fileName)) continue;
        const res = await fetch(`/uploads/${encodeURIComponent(sound.fileName)}`);
        if (!res.ok) throw new Error(`Could not download "${sound.fileName}".`);
        media.set(sound.fileName, await res.blob());
      }
      const metadata = {
        sounds: sounds.map((s) => ({ name: s.name, fileName: s.fileName })),
      };
      const blob = await buildQuizArchive(SOUNDBOARD_JSON, metadata, media);
      triggerBlobDownload(
        blob,
        `soundboard-${new Date().toISOString().slice(0, 10)}.zip`
      );
    } catch (err) {
      setSoundError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setSoundBusy(false);
    }
  };

  const handleImportSounds = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSoundBusy(true);
    setSoundError(null);
    try {
      const archive = await readQuizArchive(file);
      const jsonText = getArchiveText(archive, SOUNDBOARD_JSON);
      if (jsonText === null) {
        throw new Error(`The ZIP file does not contain a ${SOUNDBOARD_JSON} file.`);
      }
      const parsed: unknown = JSON.parse(jsonText);
      const importedSounds = (parsed as { sounds?: unknown })?.sounds;
      if (!Array.isArray(importedSounds) || importedSounds.length === 0) {
        throw new Error("The ZIP file does not contain any sounds.");
      }

      const mediaEntries = new Map(
        listArchiveMedia(archive).map((entry) => [entry.name, entry.data])
      );

      // Upload every referenced audio file once and remember its new server
      // name, so imported sounds never overwrite existing uploads.
      const uploadedNames = new Map<string, string>();
      const wanted = importedSounds
        .map((s) => (s as { fileName?: string }).fileName)
        .filter((n): n is string => typeof n === "string" && mediaEntries.has(n));
      const uniqueNames = [...new Set(wanted)];

      setUploading(true);
      setUploadProgress(0);
      for (let i = 0; i < uniqueNames.length; i++) {
        const name = uniqueNames[i];
        setUploadMessage(`Uploading file ${i + 1} of ${uniqueNames.length}: ${name}`);
        const blob = new Blob([mediaEntries.get(name)! as BlobPart]);
        const { fileName } = await uploadFileWithProgress(
          blob,
          (percent) =>
            setUploadProgress(((i + percent / 100) / uniqueNames.length) * 100),
          name
        );
        uploadedNames.set(name, fileName);
      }
      setUploading(false);

      let imported = 0;
      let skipped = 0;
      let latest: SoundboardSound[] | null = null;
      for (const entry of importedSounds) {
        const { name, fileName } = (entry ?? {}) as {
          name?: string;
          fileName?: string;
        };
        const uploadedName = fileName ? uploadedNames.get(fileName) : undefined;
        if (!name || !name.trim() || !uploadedName) {
          skipped++;
          continue;
        }
        const res = await fetch("/api/soundboard", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Password": password ?? "",
          },
          body: JSON.stringify({ name: name.trim(), fileName: uploadedName }),
        });
        if (res.status === 401) {
          handleUnauthorized();
          return;
        }
        if (!res.ok) throw new Error((await res.text()) || `Import failed (${res.status})`);
        latest = await res.json();
        imported++;
      }

      if (latest) setSounds(latest);
      loadFiles();
      showToast(
        `Imported ${imported} sound${imported === 1 ? "" : "s"}` +
          (skipped > 0 ? `, skipped ${skipped} invalid entr${skipped === 1 ? "y" : "ies"}.` : ".")
      );
    } catch (err) {
      setSoundError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setUploading(false);
      setSoundBusy(false);
    }
  };

  if (!password) {
    return (
      <div className="remote-page">
        <div className="remote-container plan-container">
          <div className="plan-header">
            <h1 className="plan-title">Media Admin</h1>
            <p className="plan-subtitle">This page is password protected.</p>
          </div>
          <div className="remote-panel">
            <section className="remote-section">
              <h2>Enter Password</h2>
              <form className="admin-login-form" onSubmit={handleLogin}>
                <input
                  type="password"
                  className="admin-password-input"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Admin password"
                  autoFocus
                  disabled={authBusy}
                  aria-label="Admin password"
                />
                <button
                  type="submit"
                  className="btn-sort"
                  disabled={authBusy || passwordInput.length === 0}
                >
                  {authBusy ? "Checking…" : "Unlock"}
                </button>
              </form>
              {authError && <p className="plan-hint admin-error">{authError}</p>}
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="remote-page">
      <div className="remote-container plan-container">
        <div className="plan-header">
          <h1 className="plan-title">Media Admin</h1>
          <p className="plan-subtitle">
            Manage the media files stored on the server.
          </p>
        </div>

        <div className="remote-tabs">
          <button
            className={`tab-btn ${tab === "media" ? "active" : ""}`}
            onClick={() => setTab("media")}
          >
            Media Files
          </button>
          <button
            className={`tab-btn ${tab === "soundboard" ? "active" : ""}`}
            onClick={() => setTab("soundboard")}
          >
            Soundboard
          </button>
        </div>

        {tab === "media" && (
        <div className="remote-panel">
          <section className="remote-section">
            <h2>Media Files</h2>
            <div className="admin-toolbar">
              <button
                className="btn-sort"
                onClick={toggleSelectAll}
                disabled={busy || files.length === 0}
              >
                {allSelected ? "Deselect All" : "Select All"}
              </button>
              <button
                className="btn-sort"
                onClick={handleDownloadSelected}
                disabled={busy || selected.size === 0}
              >
                Download Selected ({selected.size})
              </button>
              <button
                className="btn-remove"
                onClick={handleDeleteSelected}
                disabled={busy || selected.size === 0}
              >
                Delete Selected ({selected.size})
              </button>
              <button className="btn-sort" onClick={handleRefresh} disabled={busy || loading}>
                Refresh
              </button>
            </div>

            {error && (
              <p className="plan-hint admin-error">{error}</p>
            )}

            {loading ? (
              <p className="plan-hint">Loading media files…</p>
            ) : files.length === 0 ? (
              <p className="plan-hint">No media files found on the server.</p>
            ) : (
              <>
                <p className="plan-hint">
                  {files.length} file{files.length === 1 ? "" : "s"}, {formatSize(totalSize)} total
                </p>
                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th className="admin-col-check">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={toggleSelectAll}
                            disabled={busy}
                            aria-label="Select all files"
                          />
                        </th>
                        <th>File Name</th>
                        <th className="admin-col-size">Size</th>
                        <th className="admin-col-date">Last Modified</th>
                        <th className="admin-col-actions">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {files.map((f) => (
                        <tr key={f.fileName}>
                          <td className="admin-col-check">
                            <input
                              type="checkbox"
                              checked={selected.has(f.fileName)}
                              onChange={() => toggleSelect(f.fileName)}
                              disabled={busy}
                              aria-label={`Select ${f.fileName}`}
                            />
                          </td>
                          <td className="admin-file-name">
                            {f.fileName}
                            {f.referenced && (
                              <span
                                className="admin-referenced-badge"
                                title="Referenced by the current game on /remote — cannot be deleted"
                              >
                                In use
                              </span>
                            )}
                          </td>
                          <td className="admin-col-size">{formatSize(f.size)}</td>
                          <td className="admin-col-date">{formatDate(f.lastModified)}</td>
                          <td className="admin-col-actions">
                            <a
                              className="admin-download-link"
                              href={`/uploads/${encodeURIComponent(f.fileName)}`}
                              download={f.fileName}
                            >
                              Download
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
        )}

        {tab === "soundboard" && (
        <div className="remote-panel">
          <section className="remote-section">
            <h2>Soundboard</h2>
            <p className="plan-hint">
              Sounds added here appear as buttons on the Remote Control's Sounds
              tab and are played on the Display.
            </p>
            <form className="admin-sound-form" onSubmit={handleAddSound}>
              <input
                type="text"
                className="admin-password-input"
                value={soundName}
                onChange={(e) => setSoundName(e.target.value)}
                placeholder="Sound name"
                aria-label="Sound name"
                disabled={soundBusy}
              />
              <input
                type="file"
                accept="audio/*"
                ref={soundFileInputRef}
                onChange={(e) => setSoundFile(e.target.files?.[0] ?? null)}
                aria-label="Sound file"
                disabled={soundBusy}
              />
              <button
                type="submit"
                className="btn-sort"
                disabled={soundBusy || !soundFile || soundName.trim().length === 0}
              >
                {soundBusy ? "Uploading…" : "Add Sound"}
              </button>
            </form>

            {soundError && <p className="plan-hint admin-error">{soundError}</p>}

            <h3 className="admin-subheading">Import / Export</h3>
            <p className="plan-hint">
              Export packs all sounds into a ZIP file containing the audio files
              and a {SOUNDBOARD_JSON} file with their names. Importing such a ZIP
              adds its sounds to the current soundboard.
            </p>
            <div className="admin-sound-form">
              <button
                type="button"
                className="btn-sort"
                onClick={handleExportSounds}
                disabled={soundBusy || sounds.length === 0}
              >
                Export Sounds
              </button>
              <button
                type="button"
                className="btn-sort"
                onClick={() => soundImportInputRef.current?.click()}
                disabled={soundBusy}
              >
                Import Sounds
              </button>
              <input
                type="file"
                accept=".zip"
                ref={soundImportInputRef}
                onChange={handleImportSounds}
                aria-label="Soundboard ZIP file"
                hidden
              />
            </div>

            <h3 className="admin-subheading">Delete Sound</h3>
            {sounds.length === 0 ? (
              <p className="plan-hint">No sounds on the soundboard yet.</p>
            ) : (
              <div className="admin-sound-form">
                <select
                  className="admin-password-input"
                  value={selectedSoundId}
                  onChange={(e) => setSelectedSoundId(e.target.value)}
                  aria-label="Sound to delete"
                  disabled={soundBusy}
                >
                  <option value="">Select a sound…</option>
                  {sounds.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-remove"
                  onClick={handleDeleteSound}
                  disabled={soundBusy || !selectedSoundId}
                >
                  Delete
                </button>
              </div>
            )}
          </section>
        </div>
        )}
      </div>
      <UploadProgressModal
        visible={uploading}
        progress={uploadProgress}
        message={uploadMessage}
      />
      {toast && (
        <div className="admin-toast" role="alert">
          ⚠️ {toast}
        </div>
      )}
    </div>
  );
}

export default Admin;
