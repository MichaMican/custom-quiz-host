import { useEffect, useMemo, useRef, useState } from "react";
import "./RemoteControl.css";
import "./Plan.css";
import "./Admin.css";

interface MediaFile {
  fileName: string;
  size: number;
  lastModified: string;
  referenced: boolean;
}

const ADMIN_PASSWORD_STORAGE_KEY = "adminPagePassword";

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
  const [password, setPassword] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(
    () => sessionStorage.getItem(ADMIN_PASSWORD_STORAGE_KEY) !== null
  );
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    let ignore = false;
    const stored = sessionStorage.getItem(ADMIN_PASSWORD_STORAGE_KEY);
    if (!stored) {
      return;
    }
    fetch("/api/admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: stored }),
    })
      .then((res) => {
        if (ignore) return;
        if (res.ok) {
          setPassword(stored);
        } else {
          sessionStorage.removeItem(ADMIN_PASSWORD_STORAGE_KEY);
        }
      })
      .catch(() => {
        if (!ignore) sessionStorage.removeItem(ADMIN_PASSWORD_STORAGE_KEY);
      })
      .finally(() => {
        if (!ignore) setCheckingAuth(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const handleUnauthorized = () => {
    sessionStorage.removeItem(ADMIN_PASSWORD_STORAGE_KEY);
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
      sessionStorage.setItem(ADMIN_PASSWORD_STORAGE_KEY, passwordInput);
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
          if (!ignore) {
            sessionStorage.removeItem(ADMIN_PASSWORD_STORAGE_KEY);
            setPassword(null);
            setAuthError("Session expired. Please enter the password again.");
          }
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

  if (checkingAuth) {
    return (
      <div className="remote-page">
        <div className="remote-container plan-container">
          <p className="plan-hint">Checking access…</p>
        </div>
      </div>
    );
  }

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
      </div>
      {toast && (
        <div className="admin-toast" role="alert">
          ⚠️ {toast}
        </div>
      )}
    </div>
  );
}

export default Admin;
