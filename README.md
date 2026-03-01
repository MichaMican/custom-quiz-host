# Custom Jeopardy Host

A web-based Jeopardy-style game hosting application built with ASP.NET Core and React. This application allows you to create and host interactive Jeopardy games with multiple players, custom categories, questions, and multimedia support including images and audio.

## Features

- **Real-time Game Play**: Powered by SignalR for instant synchronization across all connected devices
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
- **Buzzer System**: Track player buzz-in order with timestamps
- **Media Support**: Upload and play images and audio files
- **Score Tracking**: Automatic score updates based on correct/incorrect answers
- **Persistent State**: Auto-save and restore game state using localStorage
- **Import/Export**: Export game state for backup or reuse

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

## Prerequisites

- **.NET SDK 10.0** or later
- **Node.js 20.x** or later
- **npm** (comes with Node.js)

## Getting Started

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/MichaMican/custom-jeopardy-host.git
   cd custom-jeopardy-host
   ```

2. **Install frontend dependencies**
   ```bash
   cd customjeopardyhost.client
   npm install
   cd ..
   ```

3. **Run the application**
   
   Option A: Using .NET CLI (runs both frontend and backend)
   ```bash
   cd CustomJeopardyHost.Server
   dotnet run
   ```
   
   Option B: Run frontend and backend separately
   ```bash
   # Terminal 1 - Backend
   cd CustomJeopardyHost.Server
   dotnet run
   
   # Terminal 2 - Frontend
   cd customjeopardyhost.client
   npm run dev
   ```

4. **Access the application**
   - Display View: `https://localhost:5173/` or `https://localhost:5173/display`
   - Remote Control: `https://localhost:5173/remote`
   - Buzzer: `https://localhost:5173/buzzer`

### Docker Deployment

1. **Build the Docker image**
   ```bash
   docker build -f CustomJeopardyHost.Server/Dockerfile -t custom-jeopardy-host .
   ```

2. **Run the container**
   ```bash
   docker run -p 8080:8080 -p 8081:8081 custom-jeopardy-host
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
     - Question type (Standard, Image, Image Mozaik, Audio)
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

- Use number keys to quickly award/deduct points
- Navigate through buzzer queue
- Manage game flow efficiently

## Project Structure

```
custom-jeopardy-host/
├── CustomJeopardyHost.Server/       # ASP.NET Core backend
│   ├── Controllers/                 # API controllers
│   ├── Hubs/                       # SignalR hubs
│   ├── Models/                     # Data models
│   ├── Services/                   # Business logic
│   └── Program.cs                  # Application entry point
├── customjeopardyhost.client/       # React frontend
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
cd customjeopardyhost.client
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
```

### Backend Development

```bash
cd CustomJeopardyHost.Server
dotnet build         # Build the project
dotnet run          # Run the application
```

## Configuration

### Backend Configuration

Configuration can be modified in `CustomJeopardyHost.Server/appsettings.json`:
- Logging levels
- CORS settings (if needed)
- SignalR configuration

### Frontend Configuration

Vite configuration in `customjeopardyhost.client/vite.config.ts`:
- Proxy settings for API calls
- Build optimization settings

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the MIT License.

## Support

For issues, questions, or contributions, please open an issue on the GitHub repository.

## Acknowledgments

Built with modern web technologies to bring the classic Jeopardy game experience to any device.