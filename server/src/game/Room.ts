import {
  Player, GameState, GamePhase, TeamId,
  RoomSettings, TurnState, WordCard, TabooBuzzes,
  TurnScoreData, PlayerDTO, RoomDTO,
} from './types';

const WORD_API = 'http://random-word-api.herokuapp.com/word';

async function fetchWords(count: number): Promise<string[]> {
  try {
    const res = await fetch(`${WORD_API}?number=${count}&diff=1`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const words = (await res.json()) as string[];
    return words.map(w => w.toLowerCase());
  } catch (e) {
    const fallback = ['elephant', 'pizza', 'library', 'guitar', 'volcano',
      'astronaut', 'butterfly', 'chocolate', 'fireworks', 'telescope'];
    const shuffled = fallback.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }
}

export class Room {
  code: string;
  hostId: string;
  players: Map<string, Player> = new Map();
  settings: RoomSettings = { rounds: 3, timerSeconds: 60, wordsPerTurn: 5, maxTabooWords: 20 };
  game: GameState | null = null;
  lastActivity: number = Date.now();
  tabooMasters: { A: string | null; B: string | null } = { A: null, B: null };

  private timer: ReturnType<typeof setTimeout> | null = null;
  private onTimerExpired: (() => void) | null = null;
  private _refreshingWord: boolean = false;

  constructor(code: string, hostId: string) {
    this.code = code;
    this.hostId = hostId;
  }

  touch() { this.lastActivity = Date.now(); }

  addPlayer(id: string, name: string, socketId: string): Player {
    const player: Player = { id, name, team: null, socketId, connected: true };
    this.players.set(id, player);
    this.touch();
    return player;
  }

  removePlayer(id: string): void {
    this.players.delete(id);
    if (this.tabooMasters.A === id) this.tabooMasters.A = null;
    if (this.tabooMasters.B === id) this.tabooMasters.B = null;
    this.touch();
  }

  getPlayer(id: string): Player | undefined { return this.players.get(id); }

  getPlayerByName(name: string): Player | undefined {
    return Array.from(this.players.values()).find(p => p.name === name);
  }

  getTeamPlayers(team: TeamId): Player[] {
    return Array.from(this.players.values()).filter(p => p.team === team && p.connected);
  }

  getOpposingTeam(team: TeamId): TeamId { return team === 'A' ? 'B' : 'A'; }

  setTabooMaster(team: TeamId, playerId: string): boolean {
    const player = this.getPlayer(playerId);
    if (!player || player.team !== team) return false;
    this.tabooMasters[team] = playerId;
    this.touch();
    return true;
  }

  // If taboo master disconnects, auto-assign another connected team member
  ensureTabooMaster(team: TeamId): string | null {
    const currentId = this.tabooMasters[team];
    if (currentId) {
      const current = this.getPlayer(currentId);
      if (current && current.connected && current.team === team) return currentId;
    }
    // Auto-assign first connected team member
    const teamPlayers = this.getTeamPlayers(team);
    if (teamPlayers.length > 0) {
      this.tabooMasters[team] = teamPlayers[0].id;
      return teamPlayers[0].id;
    }
    return null;
  }

  canStart(): { ok: boolean; reason?: string } {
    const teamA = this.getTeamPlayers('A');
    const teamB = this.getTeamPlayers('B');
    if (teamA.length < 2) return { ok: false, reason: 'Team A needs at least 2 players' };
    if (teamB.length < 2) return { ok: false, reason: 'Team B needs at least 2 players' };
    if (!this.tabooMasters.A) return { ok: false, reason: 'Team A needs a taboo master' };
    if (!this.tabooMasters.B) return { ok: false, reason: 'Team B needs a taboo master' };
    return { ok: true };
  }

  startGame(): void {
    const firstTeam: TeamId = Math.random() < 0.5 ? 'A' : 'B';
    this.game = {
      phase: GamePhase.ROUND_SETUP,
      round: 1,
      turnInRound: 0,
      firstTeam,
      scores: { A: 0, B: 0 },
      turn: this.freshTurn(firstTeam),
      tabooMasters: { ...this.tabooMasters },
    };
    this.touch();
  }

  private freshTurn(activeTeam: TeamId): TurnState {
    return {
      activeTeam,
      clueGiverId: null,
      cards: [],
      tabooWords: [],
      tabooSuggestions: [],
      tabooBuzzes: {},
      timerEnd: null,
    };
  }

  // Step 1: Set clue-giver synchronously (fast phase transition)
  setClueGiver(playerId: string): boolean {
    if (!this.game) return false;
    const player = this.getPlayer(playerId);
    if (!player || player.team !== this.game.turn.activeTeam) return false;
    this.game.turn.clueGiverId = playerId;
    this.game.phase = GamePhase.TABOO_INPUT;
    this.touch();
    return true;
  }

  // Step 2: Fetch words asynchronously (called after phase transition emitted)
  async fetchAndSetWords(): Promise<WordCard[]> {
    const words = await fetchWords(this.settings.wordsPerTurn);
    if (!this.game) return [];
    this.game.turn.cards = words.map(w => ({ word: w, result: null }));
    this.touch();
    return this.game.turn.cards;
  }

  async refreshWord(cardIndex: number): Promise<string | null> {
    if (!this.game || this.game.phase !== GamePhase.TABOO_INPUT) return null;
    if (cardIndex < 0 || cardIndex >= this.game.turn.cards.length) return null;
    if (this._refreshingWord) return null; // prevent concurrent refreshes

    this._refreshingWord = true;
    try {
      const words = await fetchWords(1);
      if (words.length === 0 || !this.game) return null;
      this.game.turn.cards[cardIndex] = { word: words[0], result: null };
      this.touch();
      return words[0];
    } finally {
      this._refreshingWord = false;
    }
  }

  getTabooMasterForOpposing(): string | null {
    if (!this.game) return null;
    const opposing = this.getOpposingTeam(this.game.turn.activeTeam);
    return this.ensureTabooMaster(opposing);
  }

  suggestTabooWord(word: string): string[] {
    if (!this.game) return [];
    const normalized = word.trim().toLowerCase();
    if (!normalized || this.game.turn.tabooSuggestions.includes(normalized)) return this.game.turn.tabooSuggestions;
    if (this.game.turn.tabooSuggestions.length >= this.settings.maxTabooWords) return this.game.turn.tabooSuggestions;
    this.game.turn.tabooSuggestions.push(normalized);
    this.touch();
    return this.game.turn.tabooSuggestions;
  }

  removeTabooWord(word: string): string[] {
    if (!this.game) return [];
    const normalized = word.trim().toLowerCase();
    this.game.turn.tabooSuggestions = this.game.turn.tabooSuggestions.filter(w => w !== normalized);
    this.touch();
    return this.game.turn.tabooSuggestions;
  }

  confirmTabooWords(): boolean {
    if (!this.game || this.game.turn.tabooSuggestions.length < 1) return false;
    this.game.turn.tabooWords = [...this.game.turn.tabooSuggestions];
    this.game.turn.tabooBuzzes = {};
    this.game.phase = GamePhase.CLUING;
    this.touch();
    return true;
  }

  startTimer(onExpired: () => void): number {
    if (!this.game) return 0;
    const end = Date.now() + this.settings.timerSeconds * 1000;
    this.game.turn.timerEnd = end;
    this.onTimerExpired = onExpired;
    this.timer = setTimeout(() => { this.onTimerExpired?.(); }, this.settings.timerSeconds * 1000);
    this.touch();
    return end;
  }

  clearTimer(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.onTimerExpired = null;
  }

  resolveCard(cardIndex: number): boolean {
    if (!this.game || cardIndex < 0 || cardIndex >= this.game.turn.cards.length) return false;
    const card = this.game.turn.cards[cardIndex];
    if (card.result !== null) return false;
    card.result = 'correct';
    this.game.scores[this.game.turn.activeTeam] += 3;
    this.touch();
    return true;
  }

  undoCard(cardIndex: number): boolean {
    if (!this.game || cardIndex < 0 || cardIndex >= this.game.turn.cards.length) return false;
    const card = this.game.turn.cards[cardIndex];
    if (card.result !== 'correct') return false;
    card.result = null;
    this.game.scores[this.game.turn.activeTeam] -= 3;
    this.touch();
    return true;
  }

  allCardsResolved(): boolean {
    if (!this.game) return false;
    return this.game.turn.cards.every(c => c.result !== null);
  }

  buzzTabooWord(word: string): number {
    if (!this.game) return 0;
    if (!this.game.turn.tabooWords.includes(word)) return 0;
    const current = this.game.turn.tabooBuzzes[word] || 0;
    this.game.turn.tabooBuzzes[word] = current + 1;
    this.game.scores[this.game.turn.activeTeam] -= 1;
    this.touch();
    return current + 1;
  }

  undoBuzzTabooWord(word: string): number {
    if (!this.game) return 0;
    const current = this.game.turn.tabooBuzzes[word] || 0;
    if (current <= 0) return 0;
    this.game.turn.tabooBuzzes[word] = current - 1;
    this.game.scores[this.game.turn.activeTeam] += 1;
    this.touch();
    return current - 1;
  }

  turnScore(): TurnScoreData {
    if (!this.game) return { correct: 0, missed: 0, buzzes: 0, points: 0 };
    const cards = this.game.turn.cards;
    const correct = cards.filter(c => c.result === 'correct').length;
    const missed = cards.filter(c => c.result === null).length;
    const buzzes = Object.values(this.game.turn.tabooBuzzes).reduce((sum, c) => sum + c, 0);
    return { correct, missed, buzzes, points: correct * 3 - buzzes };
  }

  endTurn(): { nextPhase: GamePhase; nextActiveTeam?: TeamId; turnScore: TurnScoreData } {
    if (!this.game) return { nextPhase: GamePhase.LOBBY, turnScore: { correct: 0, missed: 0, buzzes: 0, points: 0 } };
    this.clearTimer();
    const score = this.turnScore();
    const { turnInRound, round } = this.game;

    if (turnInRound === 0) {
      this.game.turnInRound = 1;
      const nextTeam = this.getOpposingTeam(this.game.turn.activeTeam);
      this.game.turn = this.freshTurn(nextTeam);
      this.game.phase = GamePhase.TURN_RESULT;
      return { nextPhase: GamePhase.TURN_RESULT, nextActiveTeam: nextTeam, turnScore: score };
    } else {
      if (round >= this.settings.rounds) {
        this.game.phase = GamePhase.GAME_OVER;
        return { nextPhase: GamePhase.GAME_OVER, turnScore: score };
      } else {
        this.game.round += 1;
        this.game.turnInRound = 0;
        this.game.firstTeam = this.getOpposingTeam(this.game.firstTeam);
        this.game.turn = this.freshTurn(this.game.firstTeam);
        this.game.phase = GamePhase.TURN_RESULT;
        return { nextPhase: GamePhase.TURN_RESULT, nextActiveTeam: this.game.firstTeam, turnScore: score };
      }
    }
  }

  advanceFromTurnResult(): void {
    if (!this.game || this.game.phase === GamePhase.GAME_OVER) return;
    this.game.phase = GamePhase.ROUND_SETUP;
    this.touch();
  }

  resetToLobby(): void {
    this.game = null;
    this.clearTimer();
    this.touch();
  }

  toDTO(): RoomDTO {
    return {
      code: this.code,
      hostId: this.hostId,
      players: this.playerDTOs(),
      settings: { ...this.settings },
      phase: this.game?.phase ?? null,
      tabooMasters: { ...this.tabooMasters },
    };
  }

  playerDTOs(): PlayerDTO[] {
    return Array.from(this.players.values()).map(p => ({
      id: p.id, name: p.name, team: p.team, connected: p.connected,
    }));
  }
}
