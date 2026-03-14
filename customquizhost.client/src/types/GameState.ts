export type QuestionType = "Standard" | "Image" | "ImageMozaik" | "Audio";

export interface Player {
  id: string;
  name: string;
  score: number;
}

export interface Question {
  id: string;
  text: string;
  answer: string;
  points: number;
  isAnswered: boolean;
  categoryId: string;
  questionType: QuestionType;
  mediaFileName: string | null;
}

export interface Category {
  id: string;
  name: string;
  questions: Question[];
}

export interface BuzzIn {
  playerId: string;
  playerName: string;
  timestamp: string;
}

export interface PlayerAnswer {
  playerId: string;
  playerName: string;
  answer: string;
  timestamp: string;
}

export interface GameState {
  players: Player[];
  categories: Category[];
  currentQuestion: Question | null;
  questionRevealed: boolean;
  buzzerActive: boolean;
  buzzOrder: BuzzIn[];
  playerAnswers: PlayerAnswer[];
  highlightedBuzzIndex: number;
  mediaPlaying: boolean;
  mozaikRevealing: boolean;
  questionTextRevealed: boolean;
  playerAnswersRevealed: boolean;
  answerRevealed: boolean;
  mediaVolume: number;
  pauseOnBuzz: boolean;
  imageFullscreen: boolean;
}
