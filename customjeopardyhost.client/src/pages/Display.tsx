import { useSignalR } from "../hooks/useSignalR";
import type { Question } from "../types/GameState";
import { useEffect, useRef, useState } from "react";
import "./Display.css";

function QuestionDisplay({ question, revealed, mediaPlaying, mozaikRevealing, questionTextRevealed }: {
  question: Question;
  revealed: boolean;
  mediaPlaying: boolean;
  mozaikRevealing: boolean;
  questionTextRevealed: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [mozaikBlur, setMozaikBlur] = useState(40);

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
          <div className="display-question-points">{question.points}</div>
          {mediaUrl && (
            <img
              src={mediaUrl}
              alt="Question"
              className="display-question-image"
            />
          )}
          {questionTextRevealed && question.text && (
            <div className="display-question-text">{question.text}</div>
          )}
        </>
      );

    case "ImageMozaik":
      return (
        <>
          <div className="display-question-points">{question.points}</div>
          {mediaUrl && (
            <img
              src={mediaUrl}
              alt="Question"
              className="display-question-image mozaik"
              style={{ filter: `blur(${mozaikBlur}px)` }}
            />
          )}
          {questionTextRevealed && question.text && (
            <div className="display-question-text">{question.text}</div>
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
        </>
      );

    default:
      return (
        <>
          <div className="display-question-points">{question.points}</div>
          <div className="display-question-text">{question.text}</div>
        </>
      );
  }
}

function Display() {
  const { gameState, connectionStatus } = useSignalR();

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

  if (gameState.currentQuestion) {
    return (
      <div className="display-container">
        <div className="display-question">
          <QuestionDisplay
            key={gameState.currentQuestion.id}
            question={gameState.currentQuestion}
            revealed={gameState.questionRevealed}
            mediaPlaying={gameState.mediaPlaying}
            mozaikRevealing={gameState.mozaikRevealing}
            questionTextRevealed={gameState.questionTextRevealed}
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
        {gameState.playerAnswers && gameState.playerAnswers.length > 0 && (
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
        <div className="display-scoreboard">
          {gameState.players.map((player) => (
            <div key={player.id} className="display-player-score">
              <span className="player-name">{player.name}</span>
              <span className="player-score">{player.score}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="display-container">
      <div className="display-board">
        {gameState.categories.map((category) => (
          <div key={category.id} className="display-category">
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
      <div className="display-scoreboard">
        {gameState.players.map((player) => (
          <div key={player.id} className="display-player-score">
            <span className="player-name">{player.name}</span>
            <span className="player-score">{player.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Display;
