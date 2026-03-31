import { create } from 'zustand';

export type GamePhase = 'LOBBY' | 'ROUND_SETUP' | 'TABOO_INPUT' | 'CLUING' | 'TURN_RESULT' | 'GAME_OVER';
export type TeamId = 'A' | 'B';

export interface Player {
  id: string;
  name: string;
  team: TeamId | null;
  connected: boolean;
}

export interface WordCard {
  word: string;
  result: 'correct' | null;
}

export interface TabooBuzzes {
  [word: string]: number;
}

export interface TurnScore {
  correct: number;
  missed: number;
  buzzes: number;
  points: number;
}

export interface GameStore {
  connected: boolean;
  playerId: string | null;
  playerName: string;

  roomCode: string | null;
  players: Player[];
  hostId: string | null;
  settings: { rounds: number; timerSeconds: number; wordsPerTurn: number; maxTabooWords: number };
  tabooMasters: { A: string | null; B: string | null };

  phase: GamePhase | null;
  round: number;
  activeTeam: TeamId | null;
  scores: { A: number; B: number };
  clueGiverId: string | null;
  tabooMasterId: string | null;

  cards: WordCard[];
  tabooWords: string[];
  tabooSuggestions: string[];
  tabooBuzzes: TabooBuzzes;

  timerEnd: number | null;
  turnScore: TurnScore | null;
  nextActiveTeam: TeamId | null;

  setPlayerName: (name: string) => void;
  reset: () => void;
}

export const initialState = {
  connected: false,
  playerId: null,
  playerName: '',
  roomCode: null,
  players: [],
  hostId: null,
  settings: { rounds: 3, timerSeconds: 60, wordsPerTurn: 5, maxTabooWords: 20 },
  tabooMasters: { A: null, B: null },
  phase: null,
  round: 1,
  activeTeam: null,
  scores: { A: 0, B: 0 },
  clueGiverId: null,
  tabooMasterId: null,
  cards: [],
  tabooWords: [],
  tabooSuggestions: [],
  tabooBuzzes: {},
  timerEnd: null,
  turnScore: null,
  nextActiveTeam: null,
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,
  setPlayerName: (name) => set({ playerName: name }),
  reset: () => set(initialState),
}));

// --- Reactive hooks ---

export function useMyPlayer(): Player | undefined {
  const playerId = useGameStore(s => s.playerId);
  const players = useGameStore(s => s.players);
  return players.find(p => p.id === playerId);
}

export function useMyRole(): 'clue-giver' | 'taboo-master' | 'taboo-watcher' | 'guesser' | null {
  const playerId = useGameStore(s => s.playerId);
  const players = useGameStore(s => s.players);
  const activeTeam = useGameStore(s => s.activeTeam);
  const clueGiverId = useGameStore(s => s.clueGiverId);
  const tabooMasterId = useGameStore(s => s.tabooMasterId);

  const me = players.find(p => p.id === playerId);
  if (!me?.team || !activeTeam) return null;

  if (me.team === activeTeam) {
    return me.id === clueGiverId ? 'clue-giver' : 'guesser';
  } else {
    return me.id === tabooMasterId ? 'taboo-master' : 'taboo-watcher';
  }
}

export function useIsHost(): boolean {
  return useGameStore(s => s.playerId) === useGameStore(s => s.hostId);
}

export function useTeamPlayers(team: TeamId): Player[] {
  return useGameStore(s => s.players).filter(p => p.team === team);
}

export function getRoomCodeFromUrl(): string | null {
  const path = window.location.pathname.replace(/^\//, '').toUpperCase();
  if (/^[A-Z0-9]{4}$/.test(path)) return path;
  return null;
}
