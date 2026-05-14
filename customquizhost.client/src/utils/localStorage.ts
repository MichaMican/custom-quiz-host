import type { GameState } from "../types/GameState";

const STORAGE_KEY = "quiz-game-state";
const IMPORTED_GAME_FILENAME_KEY = "quiz-imported-game-filename";
const IMPORTED_QUESTIONS_FILENAME_KEY = "quiz-imported-questions-filename";

export function saveGameState(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Silently ignore storage errors (e.g. quota exceeded)
  }
}

export function loadGameState(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

export function clearGameState(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function saveImportedGameFileName(name: string | null): void {
  try {
    if (name) {
      localStorage.setItem(IMPORTED_GAME_FILENAME_KEY, name);
    } else {
      localStorage.removeItem(IMPORTED_GAME_FILENAME_KEY);
    }
  } catch {
    // Silently ignore storage errors
  }
}

export function loadImportedGameFileName(): string | null {
  try {
    return localStorage.getItem(IMPORTED_GAME_FILENAME_KEY);
  } catch {
    return null;
  }
}

export function saveImportedQuestionsFileName(name: string | null): void {
  try {
    if (name) {
      localStorage.setItem(IMPORTED_QUESTIONS_FILENAME_KEY, name);
    } else {
      localStorage.removeItem(IMPORTED_QUESTIONS_FILENAME_KEY);
    }
  } catch {
    // Silently ignore storage errors
  }
}

export function loadImportedQuestionsFileName(): string | null {
  try {
    return localStorage.getItem(IMPORTED_QUESTIONS_FILENAME_KEY);
  } catch {
    return null;
  }
}

export function clearImportedFileNames(): void {
  localStorage.removeItem(IMPORTED_GAME_FILENAME_KEY);
  localStorage.removeItem(IMPORTED_QUESTIONS_FILENAME_KEY);
}

const QUESTION_TIMER_DURATION_KEY = "quiz-question-timer-duration";

export function saveQuestionTimerDuration(seconds: number): void {
  try {
    localStorage.setItem(QUESTION_TIMER_DURATION_KEY, String(seconds));
  } catch {
    // Silently ignore storage errors
  }
}

export function loadQuestionTimerDuration(): number | null {
  try {
    const raw = localStorage.getItem(QUESTION_TIMER_DURATION_KEY);
    if (!raw) return null;
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}
