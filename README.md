# Custom Quiz Host

A web-based Quiz game hosting application built with ASP.NET Core and React. This application allows you to create and host interactive quiz games with multiple players, custom categories, questions, and multimedia support including images, audio, and video.

## Features

- **Real-time Gameplay**: Powered by SignalR for instant synchronization across all connected devices
- **Multiple Views**:
  - **Display View** (`/` or `/display`): Main game board for the audience/projector screen
  - **Remote Control View** (`/remote`): Host interface for managing every aspect of the game
  - **Buzzer View** (`/buzzer`): Player interface for buzzing in and submitting answers
- **Player Management**: Add, remove, and track player scores in real-time; click a score to edit it directly
- **Player Avatars**: Players can take a selfie or upload a photo from the Buzzer page — avatars appear on their buzz button and on the Display
- **Custom Categories & Questions**: Create your own categories with customizable point values (200–1000)
- **Question Ordering**: Reorder questions within a category by dragging or using the ▲/▼ buttons; sort all questions by points with one click
- **Multiple Question Types**:
  - Standard text questions
  - Image questions
  - Image Mozaik (progressively reveal the image with adjustable speed and a host-selectable distortion method: blur, pixelate, brightness, or saturation)
  - Audio questions (play/pause with volume control)
  - Video questions (play/pause with volume control and fullscreen support)
- **Answer Images**: Optionally attach a reveal image to any question that is shown alongside the text answer on the Display
- **Buzzer System**: Track player buzz-in order with accurate timestamps; highlight the active buzzer; move to the next buzzer with one click
- **Pause on Buzz**: Automatically pause audio, video, or mozaik reveal when a player buzzes in
- **Buzzer Sync** *(experimental)*: NTP-like time synchronisation across devices for fair latency-compensated buzz ordering
- **Player Answer Input**: Optionally enable a text-answer field on the Buzzer page so players can type their answers, which the host can then reveal on the Display
- **Media Controls**: Show/hide media (image, audio, video) independently of revealing the question; toggle fullscreen for images and videos; adjust volume with a slider
- **Score Tracking**: Award or deduct the current question's points per player; set any score manually; double or halve all remaining unanswered question values in one click
- **Winner Declaration**: Declare the winner at the end of the game to show a winner screen on the Display
- **High Score & Low Score Boards**: Persistent halls of fame/shame across game sessions and server restarts, shown alongside the winner screen; can be shown/hidden or cleared independently
- **Event History**: Full log of points awarded/deducted and questions asked, viewable from the Remote Control (History tab) and from the Buzzer page
- **Persistent State**: Game state is auto-saved to `localStorage` and automatically restored when the Remote Control reconnects to an empty server
- **Import/Export**: Export questions-only or the full game state (including all media files) as a ZIP archive; import a previously exported ZIP to restore everything

## Technology Stack

### Backend
- **Framework**: ASP.NET Core 10.0
- **Real-time Communication**: SignalR
- **Language**: C#
- **Containerization**: Docker

### Frontend
- **Framework**: React 19.2
- **Language**: TypeScript
- **Build Tool**: Vite
- **Routing**: React Router
- **Styling**: CSS
- **Real-time Communication**: @microsoft/signalr

## Quickstart (Docker Compose)

The easiest way to get started is with Docker Compose using the pre-built image from the GitHub Container Registry:

1. **Download the `docker-compose.yml`** from this repository (or create it with the content below):

   ```yaml
   services:
     custom-quiz-host:
       image: ghcr.io/michamican/custom-quiz-host:latest
       ports:
         - "8080:8080"
       volumes:
         - uploads:/app/uploads
         - highscores:/app/highscores
       restart: unless-stopped

   volumes:
     uploads:
     highscores:
   ```

2. **Start the application**
   ```bash
   docker compose up -d
   ```

3. **Access the application**
   - Display View: `http://localhost:8080/`
   - Remote Control: `http://localhost:8080/remote`
   - Buzzer: `http://localhost:8080/buzzer`

Uploaded media files (images, audio) are persisted in the `uploads` Docker volume and survive container restarts. Highscores are stored separately in the `highscores` volume for independent persistence.

## Prerequisites

- **.NET SDK 10.0** or later
- **Node.js 20.x** or later
- **npm** (comes with Node.js)

## Getting Started

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/MichaMican/custom-quiz-host.git
   cd custom-quiz-host
   ```

2. **Install frontend dependencies**
   ```bash
   cd customquizhost.client
   npm install
   cd ..
   ```

3. **Run the application**
    
    Option A: Using .NET CLI (runs both frontend and backend through the ASP.NET Core SPA proxy)
    ```bash
    cd CustomQuizHost.Server
    dotnet run
    ```
    This starts the ASP.NET Core backend and launches the Vite development server automatically.

4. **Access the application**
    - Display View: `https://localhost:5173/` or `https://localhost:5173/display`
    - Remote Control: `https://localhost:5173/remote`
    - Buzzer: `https://localhost:5173/buzzer`
    - Backend API and SignalR hub (proxied by Vite): `https://localhost:7135/` or `http://localhost:5200/`

### Docker Deployment

1. **Build the Docker image**
   ```bash
   docker build -f CustomQuizHost.Server/Dockerfile -t custom-quiz-host .
   ```

2. **Run the container**
   
   Option A: Without a volume mount (uploads are not persisted)
   ```bash
   docker run -p 8080:8080 custom-quiz-host
   ```

   Option B: With a volume mount (uploads and highscores are persisted)
   ```bash
   docker run -p 8080:8080 -v custom-quiz-host-uploads:/app/uploads -v custom-quiz-host-highscores:/app/highscores custom-quiz-host
   ```

3. **Access the application**
   - Navigate to `http://localhost:8080`

## Usage

### Setting Up a Game

1. **Open the Remote Control** (`/remote`) and go to the **Setup** tab.
2. **Players** – Add each player by name and press Enter or click "Add".
3. **Categories** – Create one or more categories (e.g. "History", "Science").
4. **Questions** – For each category, add questions with:
   - Question type (Standard, Image, Image Mozaik, Audio, Video)
   - Question text (required for Standard; optional caption for media types)
   - Media file upload (required for Image / Mozaik / Audio / Video types)
   - Optional answer image (shown on the Display when the answer is revealed)
   - Answer text
   - Point value (200, 400, 600, 800, or 1000)
5. Use ▲/▼ to reorder questions or **Sort by Points ↑** to sort a category automatically.
6. **Import** – You can import a previously exported `.zip` file (questions-only or full game state) instead of entering questions manually.

### Hosting a Game

1. **Open the Display View** (`/` or `/display`) on a screen visible to all players (e.g. a projector or TV).
2. **Open the Remote Control** (`/remote`) on the host's device.
3. **Open the Buzzer View** (`/buzzer`) on each player's device.
   - Players select their name from the dropdown.
   - Players can optionally take a selfie or upload a photo as their avatar.

### Playing the Game

Switch to the **Host** tab on the Remote Control.

1. **Select a question** on the board (click the point value cell).
2. **Reveal** the question to the Display:
   - Standard: click "Show Question".
   - Media types: click "Show Image / Display Audio / Show Video" to display the media; use play/pause and the volume slider to control playback; use "Fullscreen" to fill the screen.
   - Image Mozaik: click "Show Image", choose a **distortion method** (blur / pixelate / brightness / saturation) from the dropdown, then "▶ Start Reveal" to progressively undo the distortion; adjust speed with the reveal-speed slider.
3. **Activate the Buzzer** to open it for players; enable *"Pause actions on buzz"* to automatically pause audio/video/mozaik when someone buzzes in.
4. **Player answers** – If *"Enable answer input for players"* is checked, players can type their answer in the Buzzer view. Use "Show Answers on Display" to reveal them.
5. **Award or deduct points** using the +/− buttons next to each player's name in the Scoreboard section.
6. **Show the answer** with "Show Answer on Display" (and the optional answer image).
7. **Dismiss the question** to return to the board, or **Return to Board** to go back without marking it answered.
8. Repeat until all questions are answered.

### Ending the Game

1. Click **🏆 Declare Winner** to show a winner screen on the Display.
2. Use **⭐ Show/Hide Highscores** to display the all-time high score and low score boards alongside the winner.
3. Use **↩ Revert Winner** if you need to continue playing.

### Import / Export

In the **Setup** tab, under **Import / Export**:

- Choose *Questions only* or *Full Game State* from the dropdown.
- **📤 Export** – Downloads a `.zip` file containing the JSON data and all referenced media files.
- **📥 Import** – Uploads a previously exported `.zip` and restores it (media files are re-uploaded automatically).

### Keyboard Shortcuts (Remote Control)

| Key    | Action                                      |
|--------|---------------------------------------------|
| Enter  | Add player / category; confirm score edit   |
| Escape | Cancel score edit                           |

## Project Structure

```
custom-quiz-host/
├── CustomQuizHost.Server/       # ASP.NET Core backend
│   ├── Controllers/                 # API controllers (upload, buzzer, game)
│   ├── Hubs/                       # SignalR hub
│   ├── Middleware/                  # Custom middleware
│   ├── Models/                     # Data models and GameState
│   ├── Services/                   # Business logic (game engine, highscores)
│   └── Program.cs                  # Application entry point
├── customquizhost.client/       # React frontend
│   ├── src/
│   │   ├── components/             # Shared UI components (Avatar, modals, etc.)
│   │   ├── hooks/                  # Custom React hooks (SignalR, wake lock, …)
│   │   ├── pages/                  # Page components (Display, RemoteControl, Buzzer)
│   │   ├── types/                  # TypeScript type definitions
│   │   └── utils/                  # Utility functions (localStorage, timeSync, upload)
│   └── package.json
├── docs/                        # Documentation assets (screenshots)
└── README.md
```

## Development

### Frontend Development

```bash
cd customquizhost.client
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
```

### Backend Development

```bash
cd CustomQuizHost.Server
dotnet build         # Build the project
dotnet run          # Run the application
```

## Configuration

### Backend Configuration

Configuration can be modified in `CustomQuizHost.Server/appsettings.json`:
- Logging levels
- CORS settings (if needed)
- SignalR configuration

### Frontend Configuration

Vite configuration in `customquizhost.client/vite.config.ts`:
- Proxy settings for API calls
- Build optimization settings

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For issues, questions, or contributions, please open an issue on the GitHub repository.
