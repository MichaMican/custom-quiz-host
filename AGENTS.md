# AGENTS.md

## Upload Progress Bars

Always use the `UploadProgressModal` component (located at `customquizhost.client/src/components/UploadProgressModal.tsx`) when implementing user-facing file uploads. This ensures the user can see upload progress transparently.

Use the `uploadFileWithProgress` utility (located at `customquizhost.client/src/utils/uploadWithProgress.ts`) for making upload requests with progress tracking.

### Usage pattern

```tsx
import UploadProgressModal from "../components/UploadProgressModal";
import { uploadFileWithProgress } from "../utils/uploadWithProgress";

// State
const [uploading, setUploading] = useState(false);
const [uploadProgress, setUploadProgress] = useState(0);
const [uploadMessage, setUploadMessage] = useState("");

// Upload call
setUploading(true);
setUploadProgress(0);
setUploadMessage("Uploading file…");
const data = await uploadFileWithProgress(file, (percent) => setUploadProgress(percent));
setUploading(false);

// JSX
<UploadProgressModal visible={uploading} progress={uploadProgress} message={uploadMessage} />
```

## Pause on Buzz for Action Components

When implementing a new question type that has an **action component** — any interactive or animated element controlled from the host remote (e.g. audio playback, image mozaik reveal, video playback, timer countdown) — you **must** integrate with the "Pause actions on buzz" feature.

The `GameState` includes a `PauseOnBuzz` boolean. When this flag is `true` and a player buzzes in, the `BuzzIn` method in `GameService` must automatically pause every active action component. Currently this covers:
- `MediaPlaying` → set to `false` (audio playback)
- `MozaikRevealing` → set to `false` (image mozaik unveiling)

If you add a new action component, update the `BuzzIn` method in `CustomQuizHost.Server/Services/Game.cs` to also set that component's state to its paused/stopped value inside the `if (_gameState.PauseOnBuzz)` block.

## Display Animations & Transitions

All UI changes on the **Display** page (`customquizhost.client/src/pages/Display.tsx`) must use smooth transitions and animations. The Display is the audience-facing projector view, so visual polish is important.

### Guidelines

- **View transitions** (board ↔ question): Use the `display-view-wrapper` animation classes (`anim-board-exit`, `anim-question-enter`, `anim-question-exit`, `anim-board-enter`) defined in `Display.css`. The board should appear to "zoom into" the question and "zoom back out" when returning.
- **Element reveals** (answer text, question text, media): Any element that appears conditionally (e.g. when a flag like `answerRevealed` becomes true) should have a CSS entrance animation. Use `@keyframes` animations in `Display.css` with `animation` applied directly to the element class.
- **Score changes**: When a player's score changes, the scoreboard card should flash (green for increase, red for decrease) and display a floating delta indicator (e.g. "+100" or "-50").
- **Buzz-in entries**: New buzz entries should pop in with a scale/bounce animation. Use staggered `animation-delay` via `nth-child` selectors for multiple entries.
- **Player answers**: Revealed player answers should slide in with staggered delays.
- **No animation on non-Display pages**: These animation requirements apply only to the Display page. The Remote Control and Buzzer pages do not need these animations.
