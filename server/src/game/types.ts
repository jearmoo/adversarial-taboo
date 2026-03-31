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
  PARALLEL_SETUP = 'PARALLEL_SETUP',
  CLUING_A = 'CLUING_A',
  CLUING_B = 'CLUING_B',
  ROUND_RESULT = 'ROUND_RESULT',
  GAME_OVER = 'GAME_OVER',
}

export interface WordCard {
  word: string;
  result: 'correct' | null;
}

export interface TabooBuzzes {
  [tabooWord: string]: number;
}

// Challenge created BY one team FOR the other team to clue
export interface ChallengeSetup {
  cards: WordCard[];
  tabooWords: string[];         // locked-in taboo words
  tabooSuggestions: string[];   // during setup
  tabooBuzzes: TabooBuzzes;     // during cluing
  ready: boolean;               // creating TM locked in
  clueGiverId: string | null;   // target team's chosen clue-giver
}

export interface TurnScoreData {
  correct: number;
  missed: number;
  buzzes: number;
  points: number;
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
  scores: { A: number; B: number };
  // challenges[X] = challenge FOR team X (created BY opposing TM)
  challenges: { A: ChallengeSetup; B: ChallengeSetup };
  timerEnd: number | null;
  tabooMasters: { A: string | null; B: string | null };
  turnResults: { A: TurnScoreData | null; B: TurnScoreData | null };
}


export interface TeamRoundData {
  cards: WordCard[];
  tabooWords: string[];
  tabooBuzzes: TabooBuzzes;
  turnScore: TurnScoreData;
  clueGiverName: string;
  tabooMasterName: string;
}

export interface RoundArchiveEntry {
  round: number;
  teams: { A: TeamRoundData; B: TeamRoundData };
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
