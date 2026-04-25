import { useSignalR } from "../hooks/useSignalR";
import { useWakeLock } from "../hooks/useWakeLock";
import { useDuplicateDisplayDetection } from "../hooks/useDuplicateDisplayDetection";
import DuplicateTabWarning from "../components/DuplicateTabWarning";
import Avatar from "../components/Avatar";
import type { Player, Question, HighScoreEntry, MozaikDistortion } from "../types/GameState";
import { useEffect, useRef, useState } from "react";
import "./Display.css";

/**
 * Renders the Image Mozaik media using one of several distortion methods.
 * The `intensity` is a 0–100 scalar (0 = fully revealed, 100 = fully distorted).
 *
 *  - "Blur"     → CSS `blur()` filter (max 40 px at intensity 100).
 *  - "Pixelate" → Canvas-based downscale-then-upscale to produce real
 *                 pixel blocks (max ~40 px blocks at intensity 100).
 *  - "Warp"     → SVG `feTurbulence` + `feDisplacementMap` filter that
 *                 distorts the image with smooth pseudo-random displacement,
 *                 producing a warping / morphing effect. At intensity 100
 *                 the displacement scale is at its maximum; at intensity 0
 *                 there is no displacement and the image is fully clear.
 */
function MozaikDistortedImage({ src, distortion, intensity, fullscreen }: {
  src: string;
  distortion: MozaikDistortion;
  intensity: number;
  fullscreen: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  // Reset the loaded flag during render whenever the source or method changes,
  // following the "adjust state on prop change" pattern from the React docs.
  const [prevImageKey, setPrevImageKey] = useState<string>(`${src}|${distortion}`);
  const imageKey = `${src}|${distortion}`;
  if (imageKey !== prevImageKey) {
    setPrevImageKey(imageKey);
    setImageLoaded(false);
  }

  // Preload the image for the canvas (Pixelate) renderer.
  useEffect(() => {
    if (distortion !== "Pixelate") return;
    imageRef.current = null;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.onerror = () => {
      imageRef.current = null;
    };
    img.src = src;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, distortion]);

  // Redraw the pixelated canvas whenever the intensity changes.
  useEffect(() => {
    if (distortion !== "Pixelate") return;
    if (!imageLoaded) return;
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    if (naturalW === 0 || naturalH === 0) return;

    if (canvas.width !== naturalW) canvas.width = naturalW;
    if (canvas.height !== naturalH) canvas.height = naturalH;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Block size scales with intensity. At intensity 0 we draw 1:1 (fully clear).
    const blockSize = Math.max(1, Math.round((intensity / 100) * 40));
    const smallW = Math.max(1, Math.floor(naturalW / blockSize));
    const smallH = Math.max(1, Math.floor(naturalH / blockSize));

    ctx.imageSmoothingEnabled = blockSize === 1;
    ctx.clearRect(0, 0, naturalW, naturalH);
    if (blockSize === 1) {
      ctx.drawImage(img, 0, 0, naturalW, naturalH);
    } else {
      // Two-pass: downscale (smoothed) then upscale (nearest-neighbour) to
      // produce the chunky pixel-block aesthetic.
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, smallW, smallH);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(canvas, 0, 0, smallW, smallH, 0, 0, naturalW, naturalH);
    }
  }, [intensity, imageLoaded, distortion]);

  const className = `display-question-image mozaik${fullscreen ? " fullscreen" : ""}`;

  if (distortion === "Pixelate") {
    return (
      <canvas
        ref={canvasRef}
        className={className}
        style={{ imageRendering: "pixelated" }}
      />
    );
  }

  let filter: string;
  switch (distortion) {
    case "Warp":
      // Warp is rendered below using an inline SVG <filter>; no CSS filter.
      filter = "none";
      break;
    case "Blur":
    default:
      // intensity 100 → blur 40px; intensity 0 → blur 0px.
      filter = `blur(${(intensity * 0.4).toFixed(2)}px)`;
      break;
  }

  if (distortion === "Warp") {
    // Use an SVG displacement-map filter driven by Perlin turbulence to warp
    // the image. The `scale` of feDisplacementMap is bound to intensity so
    // that intensity 0 leaves the image undistorted and intensity 100 yields
    // the strongest morphing (~120 px of displacement).
    // A unique filter id per src+intensity isn't required — id collisions are
    // fine across instances since the filter definition is identical.
    const scale = (intensity / 100) * 120;
    const filterId = "mozaik-warp-filter";
    return (
      <>
        <svg
          aria-hidden="true"
          width="0"
          height="0"
          style={{ position: "absolute", width: 0, height: 0 }}
        >
          <defs>
            <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.012 0.018"
                numOctaves="2"
                seed="7"
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale={scale}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>
        <img
          src={src}
          alt="Question"
          className={className}
          style={{ filter: `url(#${filterId})` }}
        />
      </>
    );
  }

  return (
    <img
      src={src}
      alt="Question"
      className={className}
      style={{ filter }}
    />
  );
}

function QuestionDisplay({ question, categoryName, revealed, mediaPlaying, mozaikRevealing, mozaikRevealSpeed, mozaikDistortion, questionTextRevealed, answerRevealed, mediaVolume, imageFullscreen, mediaVisible }: {
  question: Question;
  categoryName: string;
  revealed: boolean;
  mediaPlaying: boolean;
  mozaikRevealing: boolean;
  mozaikRevealSpeed: number;
  mozaikDistortion: MozaikDistortion;
  questionTextRevealed: boolean;
  answerRevealed: boolean;
  mediaVolume: number;
  imageFullscreen: boolean;
  mediaVisible: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Distortion intensity for the Image Mozaik question type, expressed on a
  // 0 – 100 scale where 100 means "fully distorted" and 0 means "fully revealed".
  // The same scalar drives every distortion method (blur strength, pixel size,
  // warp displacement), and is decremented over time while revealing.
  const [mozaikIntensity, setMozaikIntensity] = useState(100);
  // Reset to fully-distorted whenever the host switches the distortion method
  // so the new effect starts from its strongest setting. Done at render time
  // (not in an effect) per React's "adjust state on prop change" pattern.
  const [prevMozaikDistortion, setPrevMozaikDistortion] = useState(mozaikDistortion);
  if (mozaikDistortion !== prevMozaikDistortion) {
    setPrevMozaikDistortion(mozaikDistortion);
    setMozaikIntensity(100);
  }
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

  // Mozaik reveal animation – ticks the shared intensity scalar down toward 0.
  // At speed 5 a reveal from 100 → 0 takes ~8 s, matching the prior blur-only
  // timing (decrement = speed * 0.25 per 100 ms tick).
  useEffect(() => {
    if (question.questionType !== "ImageMozaik") return;
    if (!mozaikRevealing) return;

    const decrement = mozaikRevealSpeed * 0.25;
    const interval = setInterval(() => {
      setMozaikIntensity((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return Math.max(0, prev - decrement);
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
            <MozaikDistortedImage
              src={mediaUrl}
              distortion={mozaikDistortion}
              intensity={mozaikIntensity}
              fullscreen={imageFullscreen}
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
                    mozaikDistortion={gameState.mozaikDistortion}
                    questionTextRevealed={gameState.questionTextRevealed}
                    answerRevealed={gameState.answerRevealed}
                    mediaVolume={gameState.mediaVolume}
                    imageFullscreen={gameState.imageFullscreen}
                    mediaVisible={gameState.mediaVisible}
                  />
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
              return (
                <div key={player.id} className={`display-player-score ${anim ? `score-${anim.type}` : ""}`}>
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
