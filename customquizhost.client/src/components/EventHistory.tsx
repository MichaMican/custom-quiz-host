import type { EventHistoryEntry } from "../types/GameState";
import "./EventHistory.css";

interface EventHistoryProps {
  events: EventHistoryEntry[];
  highlightPlayerName?: string;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function EventHistory({ events, highlightPlayerName }: EventHistoryProps) {
  if (events.length === 0) {
    return <p className="event-history-empty">No events yet.</p>;
  }

  const reversed = [...events].reverse();

  return (
    <ul className="event-history-list">
      {reversed.map((entry, index) => {
        const isHighlighted =
          highlightPlayerName &&
          entry.playerName &&
          entry.playerName === highlightPlayerName;

        let description: string;
        let iconClass: string;

        switch (entry.eventType) {
          case "PointsAwarded":
            description = `${entry.playerName} received +${entry.points} points`;
            iconClass = "event-icon-award";
            break;
          case "PointsDeducted":
            description = `${entry.playerName} lost ${entry.points} points`;
            iconClass = "event-icon-deduct";
            break;
          case "ScoreSet":
            description = `${entry.playerName}'s score was adjusted (${entry.points != null && entry.points >= 0 ? "+" : ""}${entry.points})`;
            iconClass = "event-icon-set";
            break;
          case "QuestionAsked":
            description = entry.categoryName
              ? `Question asked: "${entry.questionText}" (${entry.categoryName}, ${entry.points} pts)`
              : `Question asked: "${entry.questionText}" (${entry.points} pts)`;
            iconClass = "event-icon-question";
            break;
          default:
            description = "Unknown event";
            iconClass = "";
        }

        return (
          <li
            key={index}
            className={`event-history-entry ${iconClass}${isHighlighted ? " highlighted" : ""}`}
          >
            <span className="event-time">{formatTimestamp(entry.timestamp)}</span>
            <span className="event-description">{description}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default EventHistory;
