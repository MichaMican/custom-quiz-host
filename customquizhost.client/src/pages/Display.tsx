import { useSignalR } from "../hooks/useSignalR";
import { useWakeLock } from "../hooks/useWakeLock";
import { useDuplicateDisplayDetection } from "../hooks/useDuplicateDisplayDetection";
import DuplicateTabWarning from "../components/DuplicateTabWarning";
import Avatar from "../components/Avatar";
import { QRCodeSVG } from "qrcode.react";
import type { Player, Question, HighScoreEntry } from "../types/GameState";
import { useCallback, useEffect, useRef, useState } from "react";
import "./Display.css";

function QuestionDisplay({ question, categoryName, revealed, mediaPlaying, mozaikRevealing, mozaikRevealSpeed, questionTextRevealed, answerRevealed, mediaVolume, imageFullscreen, mediaVisible }: {
  question: Question;
  categoryName: string;
  revealed: boolean;
  mediaPlaying: boolean;
  mozaikRevealing: boolean;
  mozaikRevealSpeed: number;
  questionTextRevealed: boolean;
  answerRevealed: boolean;
  mediaVolume: number;
  imageFullscreen: boolean;
  mediaVisible: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mozaikBlur, setMozaikBlur] = useState(40);
  const [videoBuffering, setVideoBuffering] = useState(false);

  // Audio volume control
  useEffect(() => {
    if (question.questionType !== "Audio" || !audioRef.current) return;
    audioRef.current.volume = Math.max(0, Math.min(1, mediaVolume / 100));
  }, [mediaVolume, question.questionType]);

  // Audio playback control
  useEffect(() => {
    if (question.questionType !== "Audio" || !audioRef.current) return;
    if (mediaPlaying) {
      audioRef.current.play().catch((err) => {
        console.error("Audio playback failed:", err);
      });
    } else {
      audioRef.current.pause();
    }
  }, [mediaPlaying, question.questionType]);

  // Video volume control
  useEffect(() => {
    if (question.questionType !== "Video" || !videoRef.current) return;
    videoRef.current.volume = Math.max(0, Math.min(1, mediaVolume / 100));
  }, [mediaVolume, question.questionType]);

  // Video playback control
  useEffect(() => {
    if (question.questionType !== "Video" || !videoRef.current) return;
    if (mediaPlaying) {
      videoRef.current.play().catch((err) => {
        console.error("Video playback failed:", err);
      });
    } else {
      videoRef.current.pause();
    }
  }, [mediaPlaying, question.questionType]);

  // Video buffering detection
  useEffect(() => {
    if (question.questionType !== "Video") return;
    const video = videoRef.current;
    if (!video) return;

    const onWaiting = () => setVideoBuffering(true);
    const onPlaying = () => setVideoBuffering(false);

    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);

    return () => {
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
    };
  }, [question.questionType]);

  // Mozaik blur animation
  useEffect(() => {
    if (question.questionType !== "ImageMozaik") return;
    if (!mozaikRevealing) return;

    const decrement = mozaikRevealSpeed * 0.1;
    const interval = setInterval(() => {
      setMozaikBlur((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - decrement;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [mozaikRevealing, mozaikRevealSpeed, question.questionType]);

  const mediaUrl = question.mediaFileName ? `/uploads/${question.mediaFileName}` : null;

  // Handle Video questions in both revealed and unrevealed states
  // to keep the same <video> element in the React tree and preserve buffered data
  if (question.questionType === "Video") {
    return (
      <>
        {(!revealed || !imageFullscreen || !mediaVisible) && (
          <div className="display-question-category">{categoryName}</div>
        )}
        {(!revealed || !imageFullscreen || !mediaVisible) && (
          <div className="display-question-points">{question.points}</div>
        )}
        {mediaUrl && (
          <div className={`display-video-wrapper${!revealed || !mediaVisible ? " preloading" : ""}`}>
            <video
              ref={videoRef}
              src={mediaUrl}
              preload="auto"
              className={`display-question-video${revealed && mediaVisible && imageFullscreen ? " fullscreen" : ""}`}
            />
            {revealed && mediaVisible && videoBuffering && mediaPlaying && (
              <div className={`display-video-spinner-overlay${imageFullscreen ? " fullscreen" : ""}`}>
                <div className="display-video-spinner" />
              </div>
            )}
          </div>
        )}
        {!revealed && questionTextRevealed && question.text && (
          <div className="display-question-text">{question.text}</div>
        )}
        {revealed && (!imageFullscreen || !mediaVisible) && questionTextRevealed && question.text && (
          <div className="display-question-text">{question.text}</div>
        )}
        {revealed && (!imageFullscreen || !mediaVisible) && answerRevealed && (
          <div className="display-answer-section">
            {question.answer && <div className="display-answer-text">{question.answer}</div>}
            {question.answerImageFileName && (
              <img
                src={`/uploads/${question.answerImageFileName}`}
                alt="Answer"
                className="display-answer-image"
              />
            )}
          </div>
        )}
      </>
    );
  }

  if (!revealed) {
    return (
      <>
        <div className="display-question-category">{categoryName}</div>
        <div className="display-question-points">
          {question.points}
        </div>
        {questionTextRevealed && question.text && question.questionType !== "Standard" && (
          <div className="display-question-text">{question.text}</div>
        )}
      </>
    );
  }

  switch (question.questionType) {
    case "Image":
      return (
        <>
          {(!imageFullscreen || !mediaVisible) && <div className="display-question-category">{categoryName}</div>}
          {(!imageFullscreen || !mediaVisible) && <div className="display-question-points">{question.points}</div>}
          {mediaUrl && mediaVisible && (
            <img
              src={mediaUrl}
              alt="Question"
              className={`display-question-image${imageFullscreen ? " fullscreen" : ""}`}
            />
          )}
          {(!imageFullscreen || !mediaVisible) && questionTextRevealed && question.text && (
            <div className="display-question-text">{question.text}</div>
          )}
          {(!imageFullscreen || !mediaVisible) && answerRevealed && (
            <div className="display-answer-section">
              {question.answer && <div className="display-answer-text">{question.answer}</div>}
              {question.answerImageFileName && (
                <img
                  src={`/uploads/${question.answerImageFileName}`}
                  alt="Answer"
                  className="display-answer-image"
                />
              )}
            </div>
          )}
        </>
      );

    case "ImageMozaik":
      return (
        <>
          {(!imageFullscreen || !mediaVisible) && <div className="display-question-category">{categoryName}</div>}
          {(!imageFullscreen || !mediaVisible) && <div className="display-question-points">{question.points}</div>}
          {mediaUrl && mediaVisible && (
            <img
              src={mediaUrl}
              alt="Question"
              className={`display-question-image mozaik${imageFullscreen ? " fullscreen" : ""}`}
              style={{ filter: `blur(${mozaikBlur}px)` }}
            />
          )}
          {(!imageFullscreen || !mediaVisible) && questionTextRevealed && question.text && (
            <div className="display-question-text">{question.text}</div>
          )}
          {(!imageFullscreen || !mediaVisible) && answerRevealed && (
            <div className="display-answer-section">
              {question.answer && <div className="display-answer-text">{question.answer}</div>}
              {question.answerImageFileName && (
                <img
                  src={`/uploads/${question.answerImageFileName}`}
                  alt="Answer"
                  className="display-answer-image"
                />
              )}
            </div>
          )}
        </>
      );

    case "Audio":
      return (
        <>
          <div className="display-question-category">{categoryName}</div>
          <div className="display-question-points">{question.points}</div>
          {mediaVisible && (
            <div className="display-audio-indicator">
              {mediaPlaying ? "🔊 Playing..." : "🔇 Waiting for host..."}
            </div>
          )}
          {mediaUrl && (
            <audio ref={audioRef} src={mediaUrl} preload="auto" />
          )}
          {questionTextRevealed && question.text && (
            <div className="display-question-text">{question.text}</div>
          )}
          {answerRevealed && (
            <div className="display-answer-section">
              {question.answer && <div className="display-answer-text">{question.answer}</div>}
              {question.answerImageFileName && (
                <img
                  src={`/uploads/${question.answerImageFileName}`}
                  alt="Answer"
                  className="display-answer-image"
                />
              )}
            </div>
          )}
        </>
      );

    default:
      return (
        <>
          <div className="display-question-category">{categoryName}</div>
          <div className="display-question-points">{question.points}</div>
          <div className="display-question-text">{question.text}</div>
          {answerRevealed && (
            <div className="display-answer-section">
              {question.answer && <div className="display-answer-text">{question.answer}</div>}
              {question.answerImageFileName && (
                <img
                  src={`/uploads/${question.answerImageFileName}`}
                  alt="Answer"
                  className="display-answer-image"
                />
              )}
            </div>
          )}
        </>
      );
  }
}

/**
 * Lazily-created shared AudioContext used to synthesize the question-timer beep
 * and "timer expired" sounds via Web Audio API oscillators. Using oscillators
 * (instead of bundling audio assets) keeps the bundle small and lets us tune
 * the sounds without binary files.
 */
let _questionTimerAudioCtx: AudioContext | null = null;
function getQuestionTimerAudioCtx(): AudioContext | null {
  if (_questionTimerAudioCtx) return _questionTimerAudioCtx;
  const Ctx =
    typeof window !== "undefined"
      ? window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;
  if (!Ctx) return null;
  try {
    _questionTimerAudioCtx = new Ctx();
    return _questionTimerAudioCtx;
  } catch {
    return null;
  }
}

/** Short, bright beep played at each of the final 3 seconds (3, 2, 1). */
function playQuestionTimerBeep() {
  const ctx = getQuestionTimerAudioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  const now = ctx.currentTime;
  const duration = 0.14;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.35, now + 0.01);
  gain.gain.linearRampToValueAtTime(0.35, now + duration - 0.04);
  gain.gain.linearRampToValueAtTime(0, now + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration);
}

/** Longer descending tone played when the countdown reaches 0. */
function playQuestionTimerExpired() {
  const ctx = getQuestionTimerAudioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  const now = ctx.currentTime;
  const duration = 0.7;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(523, now);
  osc.frequency.exponentialRampToValueAtTime(196, now + duration);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.32, now + 0.02);
  gain.gain.linearRampToValueAtTime(0.32, now + duration - 0.15);
  gain.gain.linearRampToValueAtTime(0, now + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration);
}

/**
 * Container that keeps the countdown visible for a short "hold" period after it
 * naturally reaches 0, then plays an exit animation before unmounting. When the
 * server clears the timer state (e.g. due to ShowQuestion / ReturnToBoard /
 * DismissQuestion / explicit Stop) *before* natural expiry, the timer is
 * unmounted immediately.
 */
function QuestionCountdownContainer({
  active,
  startedAt,
  durationSeconds,
}: {
  active: boolean;
  startedAt: string | null;
  durationSeconds: number;
}) {
  type Phase = "idle" | "running" | "hold" | "exiting";
  const [phase, setPhase] = useState<Phase>("idle");
  const [snapshot, setSnapshot] = useState<
    { startedAt: string; durationSeconds: number } | null
  >(null);
  const expiredRef = useRef(false);
  const holdTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);

  const clearPendingTimers = useCallback(() => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (exitTimerRef.current !== null) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  // Start (or restart) the countdown whenever a new timer arrives. We have to
  // capture the incoming props into local snapshot state so the countdown can
  // outlive `active` becoming false (during the post-expiry hold/exit phases).
  useEffect(() => {
    if (active && startedAt) {
      clearPendingTimers();
      expiredRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSnapshot({ startedAt, durationSeconds });
      setPhase("running");
    }
  }, [active, startedAt, durationSeconds, clearPendingTimers]);

  // If the server clears the timer state before natural expiry (explicit
  // stop / question transition), unmount the countdown immediately so it
  // doesn't linger over a different view.
  useEffect(() => {
    if (!active && phase === "running" && !expiredRef.current) {
      clearPendingTimers();
      setPhase("idle");
      setSnapshot(null);
    }
  }, [active, phase, clearPendingTimers]);

  useEffect(() => () => clearPendingTimers(), [clearPendingTimers]);

  // Called by the child when its local countdown reaches 0.
  const handleExpire = useCallback(() => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    playQuestionTimerExpired();
    setPhase("hold");
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      setPhase("exiting");
      exitTimerRef.current = window.setTimeout(() => {
        exitTimerRef.current = null;
        setPhase("idle");
        setSnapshot(null);
        expiredRef.current = false;
      }, 600);
    }, 3000);
  }, []);

  if (phase === "idle" || !snapshot) return null;
  return (
    <QuestionCountdown
      key={snapshot.startedAt}
      startedAt={snapshot.startedAt}
      durationSeconds={snapshot.durationSeconds}
      onExpire={handleExpire}
      exiting={phase === "exiting"}
    />
  );
}

function QuestionCountdown({
  startedAt,
  durationSeconds,
  onExpire,
  exiting,
}: {
  startedAt: string;
  durationSeconds: number;
  onExpire: () => void;
  exiting: boolean;
}) {
  // Compute remaining seconds locally, ticking ~10x per second for a smooth animation.
  // Anchor the countdown to the client's clock at the moment a new timer instance
  // becomes visible (i.e. when the `startedAt` prop changes). Using the server's
  // `startedAt` directly would make the countdown drift by the host↔client clock
  // skew (e.g. start at 13 and end at 3 when the server clock is 3s ahead).
  const totalMs = durationSeconds * 1000;

  const [remainingMs, setRemainingMs] = useState(totalMs);
  const lastBeepSecondRef = useRef<number | null>(null);
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    const clientStartMs = Date.now();
    const computeRemaining = () => Math.max(0, totalMs - (Date.now() - clientStartMs));
    const interval = setInterval(() => {
      setRemainingMs(computeRemaining());
    }, 100);
    // Fire the natural-expiry callback exactly at totalMs so the hold/exit
    // animation begins precisely when the visible "0" appears, regardless of
    // when the server's clear message arrives.
    const expireTimer = window.setTimeout(() => {
      onExpireRef.current();
    }, totalMs);
    return () => {
      clearInterval(interval);
      clearTimeout(expireTimer);
    };
  }, [startedAt, durationSeconds, totalMs]);

  const remainingSeconds = Math.ceil(remainingMs / 1000);

  // Beep on each of the last 3 visible seconds (3, 2, 1).
  useEffect(() => {
    if (remainingMs <= 0) return;
    if (remainingSeconds >= 1 && remainingSeconds <= 3) {
      if (lastBeepSecondRef.current !== remainingSeconds) {
        lastBeepSecondRef.current = remainingSeconds;
        playQuestionTimerBeep();
      }
    }
  }, [remainingMs, remainingSeconds]);

  const fraction = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  // SVG circle: radius 54 -> circumference ~339.29
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - fraction);
  const isUrgent = remainingMs > 0 && remainingMs <= 5000;
  const isFinished = remainingMs <= 0;

  return (
    <div
      className={`display-question-timer${isUrgent ? " urgent" : ""}${isFinished ? " finished" : ""}${exiting ? " exiting" : ""}`}
    >
      <svg viewBox="0 0 120 120" className="display-question-timer-svg">
        <circle
          className="display-question-timer-track"
          cx="60"
          cy="60"
          r={radius}
        />
        <circle
          className="display-question-timer-progress"
          cx="60"
          cy="60"
          r={radius}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: dashOffset,
          }}
        />
      </svg>
      <div className="display-question-timer-value">{remainingSeconds}</div>
    </div>
  );
}

/**
 * Formats the time delta between consecutive buzz-ins for display.
 * Returns null if the delta exceeds 3 seconds (not shown).
 * - < 500ms: shown in milliseconds (e.g. "120ms")
 * - >= 500ms and < 1000ms: seconds with 2 decimal places (e.g. "0.52s")
 * - >= 1000ms: seconds with 1 decimal place (e.g. "1.3s")
 */
function formatBuzzDelta(deltaMs: number): string | null {
  if (deltaMs > 3000) return null;
  if (deltaMs < 500) return `${Math.round(deltaMs)}ms`;
  if (deltaMs < 1000) return `${(deltaMs / 1000).toFixed(2)}s`;
  return `${(deltaMs / 1000).toFixed(1)}s`;
}

interface RankedPlayer extends Player {
  rank: number;
}

function getRankedPlayers(players: Player[]): RankedPlayer[] {
  if (players.length === 0) return [];
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const ranked: RankedPlayer[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const rank = i === 0 || sorted[i].score !== sorted[i - 1].score
      ? i + 1
      : ranked[i - 1].rank;
    ranked.push({ ...sorted[i], rank });
  }
  return ranked;
}

function getRankColor(rank: number): string {
  switch (rank) {
    case 1: return "#fbbf24"; // Gold
    case 2: return "#c0c0c0"; // Silver
    case 3: return "#cd7f32"; // Bronze
    default: return "#e2e8f0"; // Light gray
  }
}

function getRankLabel(rank: number): string {
  switch (rank) {
    case 1: return "🥇";
    case 2: return "🥈";
    case 3: return "🥉";
    default: return `#${rank}`;
  }
}

const CONFETTI_COUNT = 80;
const CONFETTI_COLORS = ["#fbbf24", "#f59e0b", "#818cf8", "#c7d2fe", "#4ade80", "#f87171", "#38bdf8", "#fb923c"];

function ConfettiPiece({ pieceIndex }: { pieceIndex: number }) {
  const color = CONFETTI_COLORS[pieceIndex % CONFETTI_COLORS.length];
  const [style] = useState(() => ({
    left: Math.random() * 100,
    delay: Math.random() * 3,
    duration: 2.5 + Math.random() * 2,
    size: 6 + Math.random() * 8,
    rotation: Math.random() * 360,
  }));

  return (
    <div
      className="confetti-piece"
      style={{
        left: `${style.left}%`,
        width: `${style.size}px`,
        height: `${style.size * 0.6}px`,
        backgroundColor: color,
        animationDelay: `${style.delay}s`,
        animationDuration: `${style.duration}s`,
        transform: `rotate(${style.rotation}deg)`,
      }}
    />
  );
}

const WINNER_SOUND_TRACKS = [
  "/winner-music.mp3",
  "/winner-applause.mp3",
  "/winner-cheering.mp3",
];

const RANDOM_WHEEL_COLORS = [
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ef4444",
  "#a855f7",
  "#14b8a6",
];

const RANDOM_WHEEL_SPIN_DURATION_MS = 5500;
// Number of full clockwise rotations the wheel performs before stopping.
const RANDOM_WHEEL_FULL_SPINS = 6;
// Fractional position of the wedge center along its arc (0.5 = middle).
const RANDOM_WHEEL_WEDGE_CENTER = 0.5;
// Fraction of a wedge width used as random jitter at the stop position
// so the wheel doesn't always land on the exact wedge center.
const RANDOM_WHEEL_JITTER_FACTOR = 0.6;

function RandomWheelOverlay({
  players,
  selectedPlayerId,
  spinId,
}: {
  players: Player[];
  selectedPlayerId: string | null;
  spinId: string | null;
}) {
  const [rotation, setRotation] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [showName, setShowName] = useState(false);

  const selectedIndex = selectedPlayerId
    ? players.findIndex((p) => p.id === selectedPlayerId)
    : -1;
  const selectedPlayer = selectedIndex >= 0 ? players[selectedIndex] : null;

  useEffect(() => {
    if (!spinId || selectedIndex < 0 || players.length === 0) return;
    const wedgeAngle = 360 / players.length;
    // Add a small random offset within the wedge for a natural-looking stop.
    const jitter = (Math.random() - 0.5) * wedgeAngle * RANDOM_WHEEL_JITTER_FACTOR;
    const target =
      360 * RANDOM_WHEEL_FULL_SPINS -
      (selectedIndex + RANDOM_WHEEL_WEDGE_CENTER) * wedgeAngle +
      jitter;

    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;

    // Phase 1 (async): ensure starting rotation is 0 with no transition.
    raf1 = requestAnimationFrame(() => {
      if (cancelled) return;
      setRotation(0);
      setAnimating(false);
      setShowName(false);
      // Phase 2 (next frame): enable the transition and rotate to target.
      raf2 = requestAnimationFrame(() => {
        if (cancelled) return;
        setAnimating(true);
        setRotation(target);
      });
    });

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      setShowName(true);
    }, RANDOM_WHEEL_SPIN_DURATION_MS + 100);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(timer);
    };
  }, [spinId, selectedIndex, players.length]);

  const wedgeAngle = players.length > 0 ? 360 / players.length : 0;
  const conicGradient = players.length > 0
    ? `conic-gradient(from 0deg, ${players
        .map((_, i) => {
          const color = RANDOM_WHEEL_COLORS[i % RANDOM_WHEEL_COLORS.length];
          const start = i * wedgeAngle;
          const end = (i + 1) * wedgeAngle;
          return `${color} ${start}deg ${end}deg`;
        })
        .join(", ")})`
    : undefined;

  return (
    <div className="random-wheel-overlay">
      <div className="random-wheel-title">🎡 Random Player</div>
      <div className="random-wheel-stage">
        <div className="random-wheel-pointer" aria-hidden="true">▼</div>
        <div className="random-wheel-frame" aria-hidden="true" />
        <div
          key={spinId ?? "static"}
          className="random-wheel-spinner"
          style={{
            background: conicGradient,
            transform: `rotate(${rotation}deg)`,
            transition: animating
              ? `transform ${RANDOM_WHEEL_SPIN_DURATION_MS}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`
              : "none",
          }}
        >
          {players.map((p, i) => {
            const angle = (i + RANDOM_WHEEL_WEDGE_CENTER) * wedgeAngle - 90;
            return (
              <div
                key={p.id}
                className="random-wheel-slice-label"
                style={{ transform: `rotate(${angle}deg)` }}
              >
                <div className="random-wheel-slice-inner">
                  <div className="random-wheel-slice-avatar">
                    <Avatar fileName={p.avatarFileName} alt={p.name} />
                  </div>
                  <div className="random-wheel-slice-name">{p.name}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="random-wheel-hub" aria-hidden="true" />
      </div>
      <div className={`random-wheel-result ${showName && selectedPlayer ? "visible" : ""}`}>
        {selectedPlayer ? selectedPlayer.name : ""}
      </div>
    </div>
  );
}

function WinnerOverlay({ players, highScores, lowScores, showHighScores, winnerName, mediaVolume }: { players: RankedPlayer[]; highScores: HighScoreEntry[]; lowScores: HighScoreEntry[]; showHighScores: boolean; winnerName: string | null; mediaVolume: number }) {
  const winnerAudioRef = useRef<HTMLAudioElement[]>([]);

  // Play all winner sound tracks on mount, stop on unmount
  useEffect(() => {
    const audioElements: HTMLAudioElement[] = WINNER_SOUND_TRACKS.map((src) => {
      const audio = new Audio(src);
      audio.play().catch((err) => {
        console.error(`Winner sound playback failed (${src}):`, err);
      });
      return audio;
    });
    winnerAudioRef.current = audioElements;

    return () => {
      for (const audio of audioElements) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
    };
  }, []);

  // Update volume when mediaVolume changes
  useEffect(() => {
    const volume = Math.max(0, Math.min(1, mediaVolume / 100));
    for (const audio of winnerAudioRef.current) {
      // eslint-disable-next-line react-hooks/immutability -- setting DOM Audio element volume, not mutating React state
      audio.volume = volume;
    }
  }, [mediaVolume]);

  const confettiPieces = Array.from({ length: CONFETTI_COUNT }, (_, i) => (
    <ConfettiPiece key={i} pieceIndex={i} />
  ));

  // Podium: first 3 visual slots (regardless of tied ranks)
  const podiumPlayers = players.slice(0, 3);
  const restPlayers = players.slice(3);

  return (
    <div className="winner-overlay">
      <div className="confetti-container">{confettiPieces}</div>
      <div className={`winner-layout ${showHighScores ? "with-highscores" : ""}`}>
        <div className="winner-content">
          <div className="winner-trophy">🏆</div>
          <div className="winner-title">Results</div>
          <div className="podium">
            {podiumPlayers.map((p, i) => (
              <div key={p.id} className={`podium-entry podium-entry-${i + 1}`}>
                <div className="podium-avatar">
                  <Avatar fileName={p.avatarFileName} alt={p.name} />
                </div>
                <div
                  className="podium-rank"
                  style={{ color: getRankColor(p.rank) }}
                >
                  {getRankLabel(p.rank)}
                </div>
                <div className="podium-name">{p.name}</div>
                <div
                  className="podium-score"
                  style={{ color: getRankColor(p.rank) }}
                >
                  {p.score} pts
                </div>
              </div>
            ))}
          </div>
          {restPlayers.length > 0 && (
            <div className="runner-up-list">
              {restPlayers.map((p) => (
                <div key={p.id} className="runner-up-entry">
                  <span
                    className="runner-up-rank"
                    style={{ color: getRankColor(p.rank) }}
                  >
                    #{p.rank}
                  </span>
                  <span className="runner-up-name">{p.name}</span>
                  <span className="runner-up-score">{p.score} pts</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {showHighScores && (
          <div className="score-boards-sidebar">
            <HighScoreBoard entries={highScores} winnerName={winnerName} />
            <LowScoreBoard entries={lowScores} />
          </div>
        )}
      </div>
    </div>
  );
}

function HighScoreBoard({ entries, winnerName }: { entries: HighScoreEntry[]; winnerName: string | null }) {
  // Find the most recently added entry that matches the current winner
  const newestWinnerEntryId = (() => {
    if (!winnerName) return null;
    const matching = entries.filter(e => e.playerName === winnerName);
    if (matching.length === 0) return null;
    return matching.reduce((latest, e) =>
      new Date(e.achievedAt).getTime() > new Date(latest.achievedAt).getTime() ? e : latest
    ).id;
  })();

  return (
    <div className="highscore-board">
      <div className="highscore-header">
        <span className="highscore-icon">⭐</span>
        <span className="highscore-title">Hall of Fame</span>
      </div>
      <div className="highscore-list">
        {entries.map((entry, index) => {
          const isNew = entry.id === newestWinnerEntryId;
          return (
            <div
              key={entry.id}
              className={`highscore-entry ${isNew ? "highscore-entry-new" : ""}`}
              style={{ animationDelay: `${0.6 + index * 0.08}s` }}
            >
              <span className="highscore-position" style={{ color: getRankColor(index + 1) }}>
                {index < 3 ? getRankLabel(index + 1) : `#${index + 1}`}
              </span>
              <span className="highscore-name">{entry.playerName}</span>
              <span className="highscore-score">{entry.score} pts</span>
            </div>
          );
        })}
        {entries.length === 0 && (
          <div className="highscore-empty">No highscores yet</div>
        )}
      </div>
    </div>
  );
}

function LowScoreBoard({ entries }: { entries: HighScoreEntry[] }) {
  // Find the most recently added entry
  const newestLoserEntryId = (() => {
    if (entries.length === 0) return null;
    return entries.reduce((latest, e) =>
      new Date(e.achievedAt).getTime() > new Date(latest.achievedAt).getTime() ? e : latest
    ).id;
  })();

  return (
    <div className="lowscore-board">
      <div className="lowscore-header">
        <span className="lowscore-icon">💀</span>
        <span className="lowscore-title">Hall of Shame</span>
      </div>
      <div className="lowscore-list">
        {entries.map((entry, index) => {
          const isNew = entry.id === newestLoserEntryId;
          return (
            <div
              key={entry.id}
              className={`lowscore-entry ${isNew ? "lowscore-entry-new" : ""}`}
              style={{ animationDelay: `${0.6 + index * 0.08}s` }}
            >
              <span className="lowscore-position">
                {index === 0 ? "💩" : `#${index + 1}`}
              </span>
              <span className="lowscore-name">{entry.playerName}</span>
              <span className="lowscore-score">{entry.score} pts</span>
            </div>
          );
        })}
        {entries.length === 0 && (
          <div className="lowscore-empty">No lowscores yet</div>
        )}
      </div>
    </div>
  );
}

function QrCodeOverlay() {
  const buzzerUrl = `${window.location.origin}/buzzer`;
  return (
    <div className="display-qr-overlay">
      <div className="display-qr-card">
        <QRCodeSVG
          value={buzzerUrl}
          className="display-qr-code"
          level="M"
          marginSize={2}
        />
        <div className="display-qr-url">{buzzerUrl}</div>
      </div>
    </div>
  );
}

function Display() {
  const { gameState, connectionStatus } = useSignalR();
  useWakeLock();
  const { isDuplicate: isDuplicateTab, dismissed: duplicateDismissed, dismiss: dismissDuplicate } = useDuplicateDisplayDetection();
  const prevBuzzCountRef = useRef(0);
  const preloadedBuzzerRef = useRef<HTMLAudioElement | null>(null);

  // === View transition management ===
  const [activeView, setActiveView] = useState<"board" | "question">("board");
  const [viewAnimClass, setViewAnimClass] = useState("");
  const [prevQuestionId, setPrevQuestionId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [lastQuestion, setLastQuestion] = useState<Question | null>(null);
  const [transitionType, setTransitionType] = useState<"board-to-question" | "question-to-board" | "question-change" | null>(null);

  // === Score animation tracking ===
  const [prevScores, setPrevScores] = useState<Map<string, number>>(new Map());
  const [scoreAnimations, setScoreAnimations] = useState<Map<string, { type: "increase" | "decrease"; delta: number }>>(new Map());
  const [pendingScoreClear, setPendingScoreClear] = useState(false);

  // Preload buzzer sound on mount so playback is instant
  useEffect(() => {
    const audio = new Audio("/buzzer.mp3");
    audio.preload = "auto";
    audio.load();
    preloadedBuzzerRef.current = audio;
  }, []);

  // Preload video content as soon as a video question is selected,
  // even before the view transition, to give streaming a head start
  const preloadVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoPreloadUrl = gameState?.currentQuestion?.questionType === "Video" && gameState?.currentQuestion?.mediaFileName
    ? `/uploads/${gameState.currentQuestion.mediaFileName}`
    : null;

  useEffect(() => {
    const cleanupPreload = () => {
      if (preloadVideoRef.current) {
        preloadVideoRef.current.removeAttribute("src");
        preloadVideoRef.current.load();
        preloadVideoRef.current = null;
      }
    };

    cleanupPreload();
    if (videoPreloadUrl) {
      const video = document.createElement("video");
      video.preload = "auto";
      video.src = videoPreloadUrl;
      video.load();
      preloadVideoRef.current = video;
    }
    return cleanupPreload;
  }, [videoPreloadUrl]);

  const currentQuestion = gameState?.currentQuestion ?? null;
  const currentQuestionId = currentQuestion?.id ?? null;

  // Detect question transitions (render-time state adjustment per React 19 pattern)
  if (currentQuestionId !== prevQuestionId) {
    const wasShowing = prevQuestionId !== null;
    const willShow = currentQuestionId !== null;

    setPrevQuestionId(currentQuestionId);
    if (currentQuestion) {
      setLastQuestion(currentQuestion);
    }

    if (!initialized) {
      setInitialized(true);
      if (willShow) {
        setActiveView("question");
      }
    } else if (willShow && !wasShowing) {
      setTransitionType("board-to-question");
      setViewAnimClass("anim-board-exit");
    } else if (!willShow && wasShowing) {
      setTransitionType("question-to-board");
      setViewAnimClass("anim-question-exit");
    } else if (willShow && wasShowing) {
      setTransitionType("question-change");
      setViewAnimClass("anim-question-exit");
    }
  }

  // Execute timed view transitions (only setTimeout callbacks set state - async, not synchronous)
  useEffect(() => {
    if (!transitionType) return;
    const delay = transitionType === "question-change" ? 250 : 350;
    const timer = setTimeout(() => {
      if (transitionType === "board-to-question") {
        setActiveView("question");
        setViewAnimClass("anim-question-enter");
      } else if (transitionType === "question-to-board") {
        setActiveView("board");
        setLastQuestion(null);
        setViewAnimClass("anim-board-enter");
      } else {
        setViewAnimClass("anim-question-enter");
      }
      setTransitionType(null);
    }, delay);
    return () => clearTimeout(timer);
  }, [transitionType]);

  // Clear enter/exit animation classes after they complete
  useEffect(() => {
    if (!viewAnimClass) return;
    const isEnter = viewAnimClass.includes("enter");
    if (!isEnter) return;
    const timer = setTimeout(() => setViewAnimClass(""), 500);
    return () => clearTimeout(timer);
  }, [viewAnimClass]);

  // Detect score changes (render-time state adjustment)
  const players = gameState?.players;
  if (players) {
    const scoresChanged = players.some(p => prevScores.get(p.id) !== p.score);
    if (scoresChanged) {
      const changes = new Map<string, { type: "increase" | "decrease"; delta: number }>();
      for (const p of players) {
        const prev = prevScores.get(p.id);
        if (prev !== undefined && prev !== p.score) {
          changes.set(p.id, {
            type: p.score > prev ? "increase" : "decrease",
            delta: p.score - prev,
          });
        }
      }
      setPrevScores(new Map(players.map(p => [p.id, p.score])));
      if (changes.size > 0) {
        setScoreAnimations(changes);
        setPendingScoreClear(true);
      }
    }
  }

  // Clear score animations after delay
  useEffect(() => {
    if (!pendingScoreClear) return;
    const timer = setTimeout(() => {
      setScoreAnimations(new Map());
      setPendingScoreClear(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [pendingScoreClear]);

  const buzzCount = gameState?.buzzOrder.length ?? 0;

  // Play buzzer sound when a new player buzzes in
  useEffect(() => {
    if (buzzCount > prevBuzzCountRef.current && preloadedBuzzerRef.current) {
      const newBuzzes = buzzCount - prevBuzzCountRef.current;
      for (let i = 0; i < newBuzzes; i++) {
        const audio = preloadedBuzzerRef.current.cloneNode(true) as HTMLAudioElement;
        audio.addEventListener("ended", () => {
          audio.removeAttribute("src");
          audio.load();
        });
        audio.play().catch((err) => {
          console.error("Buzzer sound playback failed:", err);
        });
      }
    }
    prevBuzzCountRef.current = buzzCount;
  }, [buzzCount]);

  if (connectionStatus !== "Connected") {
    return (
      <div className="display-container">
        <div className="display-status">
          Connecting... ({connectionStatus})
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="display-container">
        <div className="display-status">Waiting for game data...</div>
      </div>
    );
  }

  const maxQuestions = Math.max(...gameState.categories.map(c => c.questions.length));

  // Use the latest question data, or the last known question during exit animation
  const displayQuestion = gameState.currentQuestion || lastQuestion;
  const displayCategoryName = displayQuestion
    ? gameState.categories.find(c => c.id === displayQuestion.categoryId)?.name ?? ""
    : "";

  return (
    <div className="display-container">
      <DuplicateTabWarning visible={isDuplicateTab && !duplicateDismissed} onDismiss={dismissDuplicate} />
      {gameState.randomWheelActive && (
        <RandomWheelOverlay
          players={gameState.players}
          selectedPlayerId={gameState.randomWheelSelectedPlayerId}
          spinId={gameState.randomWheelSpinId}
        />
      )}
      {gameState.showQrCode && <QrCodeOverlay />}
      {gameState.winnerDeclared ? (
        <WinnerOverlay
          players={getRankedPlayers(gameState.players)}
          highScores={gameState.highScoreBoard || []}
          lowScores={gameState.lowScoreBoard || []}
          showHighScores={gameState.showHighScoreBoard}
          mediaVolume={gameState.mediaVolume}
          winnerName={
            gameState.players.length > 0
              ? [...gameState.players].sort((a, b) => b.score - a.score)[0].name
              : null
          }
        />
      ) : (
        <>
          <div className={`display-view-wrapper ${viewAnimClass}`}>
            {activeView === "question" && displayQuestion ? (
              <>
                <div className="display-question">
                  <QuestionDisplay
                    key={displayQuestion.id}
                    question={gameState.currentQuestion || displayQuestion}
                    categoryName={displayCategoryName}
                    revealed={gameState.questionRevealed}
                    mediaPlaying={gameState.mediaPlaying}
                    mozaikRevealing={gameState.mozaikRevealing}
                    mozaikRevealSpeed={gameState.mozaikRevealSpeed}
                    questionTextRevealed={gameState.questionTextRevealed}
                    answerRevealed={gameState.answerRevealed}
                    mediaVolume={gameState.mediaVolume}
                    imageFullscreen={gameState.imageFullscreen}
                    mediaVisible={gameState.mediaVisible}
                  />
                  {gameState.currentQuestion && (
                    <QuestionCountdownContainer
                      active={gameState.questionTimerActive}
                      startedAt={gameState.questionTimerStartedAt}
                      durationSeconds={gameState.questionTimerDurationSeconds}
                    />
                  )}
                </div>
                {gameState.buzzerActive && gameState.buzzOrder.length > 0 && (
                  <div className="display-buzz-order">
                    <h3>Buzz Order</h3>
                    <ol>
                      {gameState.buzzOrder.map((buzz, index) => {
                        let deltaLabel: string | null = null;
                        if (index > 0) {
                          const prevTime = new Date(gameState.buzzOrder[index - 1].timestamp).getTime();
                          const currTime = new Date(buzz.timestamp).getTime();
                          deltaLabel = formatBuzzDelta(currTime - prevTime);
                        }
                        return (
                          <li key={buzz.playerId} className={index === gameState.highlightedBuzzIndex ? "first-buzz" : ""}>
                            {deltaLabel && (
                              <span className="buzz-delta-bubble">+{deltaLabel}</span>
                            )}
                            {buzz.playerName}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}
                {gameState.playerAnswersRevealed && gameState.playerAnswers && gameState.playerAnswers.length > 0 && (
                  <div className="display-player-answers">
                    <h3>Player Answers</h3>
                    <div className="answers-list">
                      {gameState.playerAnswers.map((answer) => (
                        <div key={answer.playerId} className="player-answer-item">
                          <span className="answer-player-name">{answer.playerName}:</span>
                          <span className="answer-text">{answer.answer}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div
                className="display-board"
                style={{
                  gridTemplateColumns: `repeat(${gameState.categories.length}, 1fr)`,
                  gridTemplateRows: `auto repeat(${maxQuestions}, 1fr)`,
                  visibility: gameState.hideBoard ? "hidden" : "visible",
                }}
              >
                {gameState.categories.map((category) => (
                  <div
                    key={category.id}
                    className="display-category"
                    style={{
                      gridRow: `span ${maxQuestions + 1}`,
                    }}
                  >
                    <div className="display-category-header">{category.name}</div>
                    {category.questions.map((question) => (
                      <div
                        key={question.id}
                        className={`display-cell ${question.isAnswered ? "answered" : ""}`}
                      >
                        {!question.isAnswered ? question.points : ""}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="display-scoreboard">
            {gameState.players.map((player) => {
              const anim = scoreAnimations.get(player.id);
              const isSelector =
                (gameState.selectorHighlightEnabled ?? true) &&
                gameState.currentSelectorPlayerId === player.id;
              return (
                <div
                  key={player.id}
                  className={`display-player-score ${anim ? `score-${anim.type}` : ""} ${isSelector ? "is-selector" : ""}`}
                >
                  <div className="player-avatar">
                    <Avatar fileName={player.avatarFileName} alt={player.name} />
                  </div>
                  <span className="player-name">{player.name}</span>
                  <span className="player-score">{player.score}</span>
                  {anim && (
                    <span className={`score-delta ${anim.type}`}>
                      {anim.delta > 0 ? "+" : ""}{anim.delta}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default Display;
