import { useSignalR } from "../hooks/useSignalR";
import { useWakeLock } from "../hooks/useWakeLock";
import type { Player, Question } from "../types/GameState";
import { useEffect, useRef, useState } from "react";
import "./Display.css";

function QuestionDisplay({ question, categoryName, revealed, mediaPlaying, mozaikRevealing, mozaikRevealSpeed, questionTextRevealed, answerRevealed, mediaVolume, imageFullscreen }: {
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
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mozaikBlur, setMozaikBlur] = useState(40);

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

  const mediaUrl = question.mediaFileName ? `/uploads/${question.mediaFileName}` : null;

  switch (question.questionType) {
    case "Image":
      return (
        <>
          {!imageFullscreen && <div className="display-question-category">{categoryName}</div>}
          {!imageFullscreen && <div className="display-question-points">{question.points}</div>}
          {mediaUrl && (
            <img
              src={mediaUrl}
              alt="Question"
              className={`display-question-image${imageFullscreen ? " fullscreen" : ""}`}
            />
          )}
          {!imageFullscreen && questionTextRevealed && question.text && (
            <div className="display-question-text">{question.text}</div>
          )}
          {!imageFullscreen && answerRevealed && (
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
          {!imageFullscreen && <div className="display-question-category">{categoryName}</div>}
          {!imageFullscreen && <div className="display-question-points">{question.points}</div>}
          {mediaUrl && (
            <img
              src={mediaUrl}
              alt="Question"
              className={`display-question-image mozaik${imageFullscreen ? " fullscreen" : ""}`}
              style={{ filter: `blur(${mozaikBlur}px)` }}
            />
          )}
          {!imageFullscreen && questionTextRevealed && question.text && (
            <div className="display-question-text">{question.text}</div>
          )}
          {!imageFullscreen && answerRevealed && (
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
          <div className="display-audio-indicator">
            {mediaPlaying ? "🔊 Playing..." : "🔇 Waiting for host..."}
          </div>
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

    case "Video":
      return (
        <>
          {!imageFullscreen && <div className="display-question-category">{categoryName}</div>}
          {!imageFullscreen && <div className="display-question-points">{question.points}</div>}
          {mediaUrl && (
            <video
              ref={videoRef}
              src={mediaUrl}
              preload="auto"
              className={`display-question-video${imageFullscreen ? " fullscreen" : ""}`}
            />
          )}
          {!imageFullscreen && questionTextRevealed && question.text && (
            <div className="display-question-text">{question.text}</div>
          )}
          {!imageFullscreen && answerRevealed && (
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
  const left = Math.random() * 100;
  const delay = Math.random() * 3;
  const duration = 2.5 + Math.random() * 2;
  const size = 6 + Math.random() * 8;
  const rotation = Math.random() * 360;

  return (
    <div
      className="confetti-piece"
      style={{
        left: `${left}%`,
        width: `${size}px`,
        height: `${size * 0.6}px`,
        backgroundColor: color,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
        transform: `rotate(${rotation}deg)`,
      }}
    />
  );
}

function WinnerOverlay({ players }: { players: RankedPlayer[] }) {
  const confettiPieces = Array.from({ length: CONFETTI_COUNT }, (_, i) => (
    <ConfettiPiece key={i} pieceIndex={i} />
  ));

  // Podium: first 3 visual slots (regardless of tied ranks)
  const podiumPlayers = players.slice(0, 3);
  const restPlayers = players.slice(3);

  return (
    <div className="winner-overlay">
      <div className="confetti-container">{confettiPieces}</div>
      <div className="winner-content">
        <div className="winner-trophy">🏆</div>
        <div className="winner-title">Results</div>
        <div className="podium">
          {podiumPlayers.map((p, i) => (
            <div key={p.id} className={`podium-entry podium-entry-${i + 1}`}>
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
    </div>
  );
}

function Display() {
  const { gameState, connectionStatus } = useSignalR();
  useWakeLock();
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
      {gameState.winnerDeclared ? (
        <WinnerOverlay players={getRankedPlayers(gameState.players)} />
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
                  />
                </div>
                {gameState.buzzerActive && gameState.buzzOrder.length > 0 && (
                  <div className="display-buzz-order">
                    <h3>Buzz Order</h3>
                    <ol>
                      {gameState.buzzOrder.map((buzz, index) => (
                        <li key={buzz.playerId} className={index === gameState.highlightedBuzzIndex ? "first-buzz" : ""}>
                          {buzz.playerName}
                        </li>
                      ))}
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
