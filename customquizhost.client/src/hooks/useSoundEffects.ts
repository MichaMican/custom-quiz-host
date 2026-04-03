import { useEffect, useRef, useCallback } from "react";

/**
 * Sound effect file paths. Files are served from the public/sounds directory.
 * Replace the .mp3 files to swap out effects — the filenames are descriptive
 * so it's clear which animation each sound accompanies.
 */
const SOUND_PATHS = {
  questionSelectWoosh: "/sounds/question-select-woosh.mp3",
  questionShowBling: "/sounds/question-show-bling.mp3",
  highscoreFanfare: "/sounds/highscore-fanfare.mp3",
  pointsAddKling: "/sounds/points-add-kling.mp3",
  pointsRemoveSlash: "/sounds/points-remove-slash.mp3",
  winnerMusic: "/sounds/winner-music.mp3",
  winnerApplause: "/sounds/winner-applause.mp3",
  winnerCheering: "/sounds/winner-cheering.mp3",
} as const;

type SoundName = keyof typeof SOUND_PATHS;

/**
 * Preloads all sound effects and provides a `play` function that triggers
 * instant playback by cloning the preloaded Audio element.
 *
 * Winner tracks are returned separately so the caller can stop them when
 * the winner overlay is dismissed.
 */
export function useSoundEffects() {
  const preloaded = useRef<Map<SoundName, HTMLAudioElement>>(new Map());
  const winnerTracks = useRef<HTMLAudioElement[]>([]);

  // Preload all sound effects on mount
  useEffect(() => {
    for (const [name, path] of Object.entries(SOUND_PATHS)) {
      const audio = new Audio(path);
      audio.preload = "auto";
      audio.load();
      preloaded.current.set(name as SoundName, audio);
    }
  }, []);

  /** Play a one-shot sound effect (cloned so overlapping plays work). */
  const play = useCallback((name: SoundName) => {
    const source = preloaded.current.get(name);
    if (!source) return;
    const clone = source.cloneNode(true) as HTMLAudioElement;
    clone.addEventListener("ended", () => {
      clone.removeAttribute("src");
      clone.load();
    });
    clone.play().catch((err) => {
      console.error(`Sound playback failed (${name}):`, err);
    });
  }, []);

  /**
   * Start all three winner tracks simultaneously.
   * The music track loops; applause and cheering play once.
   * Returns nothing — call `stopWinnerTracks` to silence them.
   */
  const playWinnerTracks = useCallback(() => {
    // Stop any previously playing winner tracks first
    for (const t of winnerTracks.current) {
      t.pause();
      t.removeAttribute("src");
      t.load();
    }
    winnerTracks.current = [];

    const names: SoundName[] = ["winnerMusic", "winnerApplause", "winnerCheering"];
    for (const name of names) {
      const source = preloaded.current.get(name);
      if (!source) continue;
      const clone = source.cloneNode(true) as HTMLAudioElement;
      if (name === "winnerMusic") {
        clone.loop = true;
      }
      clone.play().catch((err) => {
        console.error(`Winner track playback failed (${name}):`, err);
      });
      winnerTracks.current.push(clone);
    }
  }, []);

  /** Stop and clean up all active winner tracks. */
  const stopWinnerTracks = useCallback(() => {
    for (const t of winnerTracks.current) {
      t.pause();
      t.removeAttribute("src");
      t.load();
    }
    winnerTracks.current = [];
  }, []);

  // Clean up winner tracks on unmount
  useEffect(() => {
    return () => {
      for (const t of winnerTracks.current) {
        t.pause();
        t.removeAttribute("src");
        t.load();
      }
    };
  }, []);

  return { play, playWinnerTracks, stopWinnerTracks };
}
