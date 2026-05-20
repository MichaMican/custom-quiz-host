import type { Category } from "../types/GameState";

const CATEGORIES_KEY = "quiz-plan-categories";
const IMPORTED_FILE_NAME_KEY = "quiz-plan-imported-filename";

const DB_NAME = "quiz-plan-db";
const DB_VERSION = 1;
const MEDIA_STORE = "media";

// ---------- Categories (localStorage) ----------

export function savePlanCategories(categories: Category[]): void {
  try {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  } catch {
    // Silently ignore storage errors (e.g. quota exceeded)
  }
}

export function loadPlanCategories(): Category[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Category[]) : [];
  } catch {
    return [];
  }
}

export function clearPlanCategories(): void {
  try {
    localStorage.removeItem(CATEGORIES_KEY);
  } catch {
    // ignore
  }
}

export function savePlanImportedFileName(name: string | null): void {
  try {
    if (name) {
      localStorage.setItem(IMPORTED_FILE_NAME_KEY, name);
    } else {
      localStorage.removeItem(IMPORTED_FILE_NAME_KEY);
    }
  } catch {
    // ignore
  }
}

export function loadPlanImportedFileName(): string | null {
  try {
    return localStorage.getItem(IMPORTED_FILE_NAME_KEY);
  } catch {
    return null;
  }
}

// ---------- Media blobs (IndexedDB) ----------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MEDIA_STORE)) {
        db.createObjectStore(MEDIA_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePlanMedia(fileName: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, "readwrite");
    tx.objectStore(MEDIA_STORE).put(blob, fileName);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}

export async function loadPlanMedia(fileName: string): Promise<Blob | null> {
  const db = await openDb();
  const result = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, "readonly");
    const req = tx.objectStore(MEDIA_STORE).get(fileName);
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function deletePlanMedia(fileNames: string[]): Promise<void> {
  if (fileNames.length === 0) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, "readwrite");
    const store = tx.objectStore(MEDIA_STORE);
    for (const name of fileNames) store.delete(name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}

export async function listPlanMediaKeys(): Promise<string[]> {
  const db = await openDb();
  const keys = await new Promise<string[]>((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, "readonly");
    const req = tx.objectStore(MEDIA_STORE).getAllKeys();
    req.onsuccess = () => resolve((req.result as string[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return keys;
}

export async function clearPlanMedia(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, "readwrite");
    tx.objectStore(MEDIA_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}

/**
 * Collect every media filename referenced anywhere in the given categories
 * (both question media and answer images).
 */
export function collectReferencedMediaFileNames(categories: Category[]): string[] {
  const names = new Set<string>();
  for (const cat of categories) {
    for (const q of cat.questions) {
      if (q.mediaFileName) names.add(q.mediaFileName);
      if (q.answerImageFileName) names.add(q.answerImageFileName);
    }
  }
  return [...names];
}

/**
 * Remove any blobs in IndexedDB that are no longer referenced by the given
 * categories. Safe to call after deleting/editing questions.
 */
export async function pruneOrphanedPlanMedia(categories: Category[]): Promise<void> {
  try {
    const referenced = new Set(collectReferencedMediaFileNames(categories));
    const stored = await listPlanMediaKeys();
    const orphans = stored.filter((name) => !referenced.has(name));
    if (orphans.length > 0) {
      await deletePlanMedia(orphans);
    }
  } catch {
    // ignore – pruning is best-effort
  }
}
