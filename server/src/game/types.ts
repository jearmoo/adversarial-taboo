export interface Player {
  id: string;
  name: string;
  team: 'A' | 'B' | null;
  socketId: string;
  connected: boolean;
  disconnectedAt?: number;
}

export type TeamId = 'A' | 'B';

export enum GamePhase {
  LOBBY = 'LOBBY',
  ROUND_SETUP = 'ROUND_SETUP',
  TABOO_INPUT = 'TABOO_INPUT',
  CLUING = 'CLUING',
  TURN_RESULT = 'TURN_RESULT',
  GAME_OVER = 'GAME_OVER',
}

export interface WordCard {
  word: string;
  result: 'correct' | null; // null = pending
}

export interface TabooBuzzes {
  [tabooWord: string]: number; // buzz count per taboo word
}

export interface TurnState {
  activeTeam: TeamId;
  clueGiverId: string | null;
  cards: WordCard[];
  tabooWords: string[];         // finalized taboo words (up to 20)
  tabooSuggestions: string[];   // during input phase
  tabooBuzzes: TabooBuzzes;     // per-taboo-word buzz counts
  timerEnd: number | null;
}

export interface TurnScoreData {
  correct: number;
  missed: number;
  buzzes: number;
  points: number; // correct * 3 - buzzes
}

export interface RoomSettings {
  rounds: number;
  timerSeconds: number;
  wordsPerTurn: number;
  maxTabooWords: number;
}

export interface GameState {
  phase: GamePhase;
  round: number;
  turnInRound: number;
  firstTeam: TeamId;
  scores: { A: number; B: number };
  turn: TurnState;
  tabooMasters: { A: string | null; B: string | null };
}

export interface PlayerDTO {
  id: string;
  name: string;
  team: 'A' | 'B' | null;
  connected: boolean;
}

export interface RoomDTO {
  code: string;
  hostId: string;
  players: PlayerDTO[];
  settings: RoomSettings;
  phase: GamePhase | null;
  tabooMasters: { A: string | null; B: string | null };
}
