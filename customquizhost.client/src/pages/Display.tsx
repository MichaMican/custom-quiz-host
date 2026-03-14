import { useSignalR } from "../hooks/useSignalR";
import type { Question } from "../types/GameState";
import { useEffect, useRef, useState } from "react";
import "./Display.css";

function QuestionDisplay({ question, revealed, mediaPlaying, mozaikRevealing, questionTextRevealed, answerRevealed, mediaVolume, imageFullscreen }: {
  question: Question;
  revealed: boolean;
  mediaPlaying: boolean;
  mozaikRevealing: boolean;
  questionTextRevealed: boolean;
  answerRevealed: boolean;
  mediaVolume: number;
  imageFullscreen: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
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

  // Mozaik blur animation
  useEffect(() => {
    if (question.questionType !== "ImageMozaik") return;
    if (!mozaikRevealing) return;

    const interval = setInterval(() => {
      setMozaikBlur((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - 0.5;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [mozaikRevealing, question.questionType]);

  if (!revealed) {
    return (
      <>
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
            <div className="display-answer-text">{question.answer}</div>
          )}
        </>
      );

    case "ImageMozaik":
      return (
        <>
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
            <div className="display-answer-text">{question.answer}</div>
          )}
        </>
      );

    case "Audio":
      return (
        <>
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
            <div className="display-answer-text">{question.answer}</div>
          )}
        </>
      );

    default:
      return (
        <>
          <div className="display-question-points">{question.points}</div>
          <div className="display-question-text">{question.text}</div>
          {answerRevealed && (
            <div className="display-answer-text">{question.answer}</div>
          )}
        </>
      );
  }
}

function Display() {
  const { gameState, connectionStatus } = useSignalR();
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

  return (
    <div className="display-container">
      <div className={`display-view-wrapper ${viewAnimClass}`}>
        {activeView === "question" && displayQuestion ? (
          <>
            <div className="display-question">
              <QuestionDisplay
                key={displayQuestion.id}
                question={gameState.currentQuestion || displayQuestion}
                revealed={gameState.questionRevealed}
                mediaPlaying={gameState.mediaPlaying}
                mozaikRevealing={gameState.mozaikRevealing}
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
    </div>
  );
}

export default Display;
