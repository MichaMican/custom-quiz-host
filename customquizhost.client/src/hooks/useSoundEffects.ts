import { useEffect, useRef, useCallback } from "react";

/**
 * Winner sound effect file paths. Files are served from the public/sounds directory.
 */
const WINNER_SOUND_PATHS = {
  winnerMusic: "/sounds/winner-music.mp3",
  winnerApplause: "/sounds/winner-applause.mp3",
  winnerCheering: "/sounds/winner-cheering.mp3",
} as const;

type WinnerSoundName = keyof typeof WINNER_SOUND_PATHS;

/**
 * Preloads winner sound effects and provides functions to play/stop them.
 *
 * When `muted` is true, `playWinnerTracks` becomes a no-op and any
 * currently playing winner tracks are stopped. This does NOT affect
 * audio/video question media playback.
 */
export function useSoundEffects(muted = false) {
  const preloaded = useRef<Map<WinnerSoundName, HTMLAudioElement>>(new Map());
  const winnerTracks = useRef<HTMLAudioElement[]>([]);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  // Preload winner sound effects on mount
  useEffect(() => {
    for (const [name, path] of Object.entries(WINNER_SOUND_PATHS)) {
      const audio = new Audio(path);
      audio.preload = "auto";
      audio.load();
      preloaded.current.set(name as WinnerSoundName, audio);
    }
  }, []);

  /**
   * Start all three winner tracks simultaneously.
   * The music track loops; applause and cheering play once.
   * Returns nothing — call `stopWinnerTracks` to silence them.
   */
  const playWinnerTracks = useCallback(() => {
    if (mutedRef.current) return;
    // Stop any previously playing winner tracks first
    for (const t of winnerTracks.current) {
      t.pause();
      t.removeAttribute("src");
      t.load();
    }
    winnerTracks.current = [];

    const names: WinnerSoundName[] = ["winnerMusic", "winnerApplause", "winnerCheering"];
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

  // Stop winner tracks immediately when muted
  useEffect(() => {
    if (muted) {
      for (const t of winnerTracks.current) {
        t.pause();
        t.removeAttribute("src");
        t.load();
      }
      winnerTracks.current = [];
    }
  }, [muted]);

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

  return { playWinnerTracks, stopWinnerTracks };
}
