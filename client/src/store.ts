import { create } from 'zustand';

export type GamePhase = 'LOBBY' | 'PARALLEL_SETUP' | 'CLUING_A' | 'CLUING_B' | 'ROUND_RESULT' | 'GAME_OVER';
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

export interface SetupStatus {
  A: { ready: boolean; tabooCount: number; hasClueGiver: boolean };
  B: { ready: boolean; tabooCount: number; hasClueGiver: boolean };
}

export interface TeamRoundData {
  cards: WordCard[];
  tabooWords: string[];
  tabooBuzzes: TabooBuzzes;
  turnScore: TurnScore;
  clueGiverName: string;
  tabooMasterName: string;
}

export interface RoundArchiveEntry {
  round: number;
  teams: { A: TeamRoundData; B: TeamRoundData };
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
  scores: { A: number; B: number };

  // Parallel setup
  challengeCards: WordCard[];     // cards this team's TM is setting up (for opposing team)
  tabooSuggestions: string[];     // taboo words being added
  ownClueGiverId: string | null;  // own team's clue-giver
  setupStatus: SetupStatus;

  // Cluing phase
  cluingTeam: TeamId | null;
  activeCluingClueGiverId: string | null;  // server-provided clue-giver ID for current cluing phase
  cards: WordCard[];              // active cluing cards
  tabooWords: string[];
  tabooBuzzes: TabooBuzzes;
  timerEnd: number | null;

  // Results
  turnResults: { A: TurnScore | null; B: TurnScore | null };

  // History
  roundHistory: RoundArchiveEntry[];

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
  scores: { A: 0, B: 0 },
  challengeCards: [],
  tabooSuggestions: [],
  ownClueGiverId: null,
  setupStatus: { A: { ready: false, tabooCount: 0, hasClueGiver: false }, B: { ready: false, tabooCount: 0, hasClueGiver: false } },
  cluingTeam: null,
  activeCluingClueGiverId: null,
  cards: [],
  tabooWords: [],
  tabooBuzzes: {},
  timerEnd: null,
  turnResults: { A: null, B: null },
  roundHistory: [],
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
  const phase = useGameStore(s => s.phase);
  const cluingTeam = useGameStore(s => s.cluingTeam);
  const tabooMasters = useGameStore(s => s.tabooMasters);

  const me = players.find(p => p.id === playerId);
  if (!me?.team) return null;

  if (phase === 'PARALLEL_SETUP') {
    return me.id === tabooMasters[me.team] ? 'taboo-master' : 'taboo-watcher';
  }

  if (!cluingTeam) return null;
  const opposingTeam = cluingTeam === 'A' ? 'B' : 'A';

  const activeCGId = useGameStore.getState().activeCluingClueGiverId;

  if (me.team === cluingTeam) {
    return me.id === activeCGId ? 'clue-giver' : 'guesser';
  } else {
    return me.id === tabooMasters[me.team] ? 'taboo-master' : 'taboo-watcher';
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
