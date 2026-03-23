# Custom Quiz Host

A web-based Quiz game hosting application built with ASP.NET Core and React. This application allows you to create and host interactive quiz games with multiple players, custom categories, questions, and multimedia support including images, audio, and video.

## Features

- **Real-time Gameplay**: Powered by SignalR for instant synchronization across all connected devices
- **Multiple Views**:
  - **Display View**: Main game board for audience/players to see
  - **Remote Control View**: Host interface for managing the game
  - **Buzzer View**: Player buzzer interface for answering questions
- **Player Management**: Add, remove, and track player scores in real-time
- **Custom Categories & Questions**: Create your own categories with customizable point values (200-1000)
- **Multiple Question Types**:
  - Standard text questions
  - Image questions
  - Image mozaik (reveal image progressively)
  - Audio questions
  - Video questions
- **Buzzer System**: Track player buzz-in order with timestamps
- **Media Support**: Upload and play image, audio, and video files
- **Score Tracking**: Automatic score updates based on correct/incorrect answers
- **Persistent State**: Auto-save and restore game state using localStorage
- **Import/Export**: Import and export game state for backup or reuse

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
       restart: unless-stopped

   volumes:
     uploads:
   ```

2. **Start the application**
   ```bash
   docker compose up -d
   ```

3. **Access the application**
   - Display View: `http://localhost:8080/`
   - Remote Control: `http://localhost:8080/remote`
   - Buzzer: `http://localhost:8080/buzzer`

Uploaded media files (images, audio) are persisted in the `uploads` Docker volume and survive container restarts.

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
    
    Option B: Run frontend and backend separately
    ```bash
   # Terminal 1 - Backend
   cd CustomQuizHost.Server
   dotnet run
   
   # Terminal 2 - Frontend
   cd customquizhost.client
   npm run dev
   ```

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
    ```bash
    docker run -p 8080:8080 -v custom-quiz-host-uploads:/app/uploads custom-quiz-host
    ```

3. **Access the application**
   - Navigate to `http://localhost:8080`

## Usage

### Setting Up a Game

1. **Open the Remote Control** (`/remote`)
2. **Setup Tab**:
   - Add players with their names
   - Create categories
   - Add questions to each category with:
     - Question text
      - Answer
      - Point value (200-1000)
      - Question type (Standard, Image, Image Mozaik, Audio, Video)
      - Optional media file upload

### Hosting a Game

1. **Open the Display View** (`/display`) on a screen visible to all players
2. **Open the Remote Control** (`/remote`) on the host's device
3. **Open Buzzer View** (`/buzzer`) on each player's device
   - Players select their name from the dropdown

### Playing the Game

1. **Host** selects a question from the Display View using Remote Control
2. **Host** clicks "Reveal Question" to show the question
3. **Players** click their buzzer when they know the answer
4. **Host** can see buzz order and award points for correct answers or deduct for incorrect answers
5. Game continues until all questions are answered

### Keyboard Shortcuts (Remote Control)

- Enter: Add players/categories or confirm score edits
- Escape: Cancel score edits

## Project Structure

```
custom-quiz-host/
├── CustomQuizHost.Server/       # ASP.NET Core backend
│   ├── Controllers/                 # API controllers
│   ├── Hubs/                       # SignalR hubs
│   ├── Models/                     # Data models
│   ├── Services/                   # Business logic
│   └── Program.cs                  # Application entry point
├── customquizhost.client/       # React frontend
│   ├── src/
│   │   ├── pages/                  # React page components
│   │   ├── hooks/                  # Custom React hooks
│   │   ├── types/                  # TypeScript type definitions
│   │   └── utils/                  # Utility functions
│   └── package.json
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
