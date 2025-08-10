import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type PointValue = 100 | 200 | 300 | 600 | 1000;
export const POINT_VALUES: PointValue[] = [100, 200, 300, 600, 1000];

export type Question = {
  prompt: string;
  notes: string;
};

export type Category = {
  name: string;
  questions: Record<PointValue, Question>;
};

export type Player = {
  id: string;
  name: string;
  color: string; // hex color, e.g. #ff0000
};

export type GameData = {
  categories: Category[];
  players: Player[];
};

const defaultQuestion: Question = { prompt: '', notes: '' };

const createEmptyCategory = (name = ''): Category => ({
  name,
  questions: {
    100: { ...defaultQuestion },
    200: { ...defaultQuestion },
    300: { ...defaultQuestion },
    600: { ...defaultQuestion },
    1000: { ...defaultQuestion },
  },
});

const createDefaultGameData = (): GameData => ({
  categories: Array.from({ length: 6 }, (_, i) => createEmptyCategory(`Category ${i + 1}`)),
  players: [],
});

function normalizeQuestion(q: any): Question {
  return {
    prompt: typeof q?.prompt === 'string' ? q.prompt : '',
    notes: typeof q?.notes === 'string' ? q.notes : '',
  };
}

function normalizeCategory(c: any, index: number): Category {
  const name = typeof c?.name === 'string' ? c.name : `Category ${index + 1}`;
  const questions = { ...createEmptyCategory().questions } as Category['questions'];
  (POINT_VALUES as PointValue[]).forEach((pv) => {
    questions[pv] = normalizeQuestion(c?.questions?.[pv]);
  });
  return { name, questions };
}

function normalizePlayer(p: any, idx: number): Player {
  const id = typeof p?.id === 'string' ? p.id : `player-${idx}`;
  const name = typeof p?.name === 'string' ? p.name : `Player ${idx + 1}`;
  const color = typeof p?.color === 'string' ? p.color : '#3b82f6';
  return { id, name, color };
}

export function normalizeGameData(gd: any): GameData {
  const categories: Category[] = [];
  for (let i = 0; i < 6; i++) {
    categories.push(normalizeCategory(gd?.categories?.[i], i));
  }
  const rawPlayers: any[] = Array.isArray(gd?.players) ? gd.players : [];
  const players = rawPlayers.map((p, i) => normalizePlayer(p, i));
  return { categories, players };
}

export type GameDataContextType = {
  data: GameData;
  setCategoryName: (index: number, name: string) => void;
  setQuestion: (categoryIndex: number, value: PointValue, update: Partial<Question>) => void;
  resetAll: () => void;
  addPlayer: () => void;
  updatePlayer: (id: string, update: Partial<Player>) => void;
  removePlayer: (id: string) => void;
  replaceAll: (next: GameData | unknown) => void;
  // New helpers for persistence
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => void;
};

const GameDataContext = createContext<GameDataContextType | undefined>(undefined);

const STORAGE_KEY = 'jeopardy-game-data';

export function GameDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<GameData>(() => createDefaultGameData());

  const api = useMemo<GameDataContextType>(() => ({
    data,
    setCategoryName: (index, name) => {
      setData(prev => {
        const categories = [...prev.categories];
        categories[index] = { ...categories[index], name };
        return { ...prev, categories };
      });
    },
    setQuestion: (categoryIndex, value, update) => {
      setData(prev => {
        const categories = [...prev.categories];
        const cat = { ...categories[categoryIndex] };
        const q = { ...cat.questions[value], ...update };
        cat.questions = { ...cat.questions, [value]: q } as Category['questions'];
        categories[categoryIndex] = cat;
        const next = { ...prev, categories };
        // Auto-save whenever a question is updated
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
          console.error('Auto-save failed', e);
        }
        return next;
      });
    },
    resetAll: () => setData(createDefaultGameData()),
    addPlayer: () => {
      setData(prev => {
        const nextIndex = prev.players.length + 1;
        const player: Player = { id: `player-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`, name: `Player ${nextIndex}`, color: '#3b82f6' };
        return { ...prev, players: [...prev.players, player] };
      });
    },
    updatePlayer: (id, update) => {
      setData(prev => {
        const players = prev.players.map(p => (p.id === id ? { ...p, ...update } : p));
        return { ...prev, players };
      });
    },
    removePlayer: (id) => {
      setData(prev => ({ ...prev, players: prev.players.filter(p => p.id !== id) }));
    },
    replaceAll: (next) => setData(normalizeGameData(next)),
    // Persistence helpers
    saveToLocalStorage: () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        console.error('Failed to save data', e);
        alert('Failed to save to localStorage.');
      }
    },
    loadFromLocalStorage: () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          alert('No saved data found.');
          return;
        }
        const parsed = JSON.parse(raw);
        setData(normalizeGameData(parsed));
      } catch (e) {
        console.error('Failed to load data', e);
        alert('Failed to load from localStorage.');
      }
    },
  }), [data]);

  return (
    <GameDataContext.Provider value={api}>{children}</GameDataContext.Provider>
  );
}

export function useGameData() {
  const ctx = useContext(GameDataContext);
  if (!ctx) throw new Error('useGameData must be used within a GameDataProvider');
  return ctx;
}
