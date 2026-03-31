import { socket } from './socket';
import { useGameStore, initialState } from './store';

const SESSION_KEY = 'adtaboo_session';

function saveSession() {
  const { roomCode, playerId, playerName } = useGameStore.getState();
  if (roomCode && playerId) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode, playerId, playerName }));
  }
}

// Connection
socket.on('connect', () => { useGameStore.setState({ connected: true }); });
socket.on('disconnect', () => { useGameStore.setState({ connected: false }); });

// Room lifecycle
socket.on('room:created', ({ roomCode, playerId, room }) => {
  useGameStore.setState({
    roomCode, playerId, hostId: room.hostId,
    players: room.players, settings: room.settings,
    tabooMasters: room.tabooMasters, phase: 'LOBBY',
  });
  saveSession();
  window.history.replaceState(null, '', `/${roomCode}`);
});

socket.on('room:joined', ({ roomCode, playerId, room }) => {
  useGameStore.setState({
    roomCode, playerId, hostId: room.hostId,
    players: room.players, settings: room.settings,
    tabooMasters: room.tabooMasters, phase: room.phase || 'LOBBY',
  });
  saveSession();
  window.history.replaceState(null, '', `/${roomCode}`);
});

socket.on('room:rejoined', ({ roomCode, playerId, room, game }) => {
  const update: any = {
    roomCode, playerId, hostId: room.hostId,
    players: room.players, settings: room.settings,
    tabooMasters: room.tabooMasters, phase: room.phase || 'LOBBY',
  };
  if (game) {
    update.phase = game.phase;
    update.round = game.round;
    update.scores = game.scores;
    update.activeTeam = game.turn.activeTeam;
    update.clueGiverId = game.turn.clueGiverId;
    update.timerEnd = game.turn.timerEnd;
    update.cards = game.turn.cards || [];
    update.tabooWords = game.turn.tabooWords || [];
    update.tabooSuggestions = game.turn.tabooSuggestions || [];
    update.tabooBuzzes = game.turn.tabooBuzzes || {};
  }
  useGameStore.setState(update);
  saveSession();
  window.history.replaceState(null, '', `/${roomCode}`);
});

// Player updates
socket.on('room:player-joined', ({ player }) => {
  useGameStore.setState(s => ({ players: [...s.players, player] }));
});

socket.on('room:player-left', ({ hostId, players }) => {
  useGameStore.setState({ players, hostId });
});

socket.on('room:player-disconnected', ({ playerId: pid }) => {
  useGameStore.setState(s => ({
    players: s.players.map(p => p.id === pid ? { ...p, connected: false } : p),
  }));
});

socket.on('room:player-reconnected', ({ playerId: pid }) => {
  useGameStore.setState(s => ({
    players: s.players.map(p => p.id === pid ? { ...p, connected: true } : p),
  }));
});

// Lobby updates
socket.on('team:updated', ({ players }) => { useGameStore.setState({ players }); });
socket.on('settings:updated', ({ settings }) => { useGameStore.setState({ settings }); });
socket.on('taboo-master:updated', ({ tabooMasters }) => { useGameStore.setState({ tabooMasters }); });
socket.on('room:error', ({ message }) => { console.error('Room error:', message); });

// Game flow
socket.on('game:started', ({ phase, round, activeTeam, scores, tabooMasters }) => {
  useGameStore.setState({
    phase, round, activeTeam, scores, tabooMasters,
    cards: [], tabooWords: [], tabooSuggestions: [], tabooBuzzes: {},
    clueGiverId: null, tabooMasterId: null,
    timerEnd: null, turnScore: null,
  });
});

socket.on('round:clue-giver-set', ({ clueGiverId, tabooMasterId, phase }) => {
  useGameStore.setState({ clueGiverId, tabooMasterId, phase, cards: [] });
});

socket.on('round:cards', ({ cards }) => {
  useGameStore.setState({ cards });
});

socket.on('taboo:words-updated', ({ words }) => {
  useGameStore.setState({ tabooSuggestions: words });
});

// Cluing phase
socket.on('clue:start', ({ timerEnd, phase, cards, tabooWords, tabooBuzzes }) => {
  useGameStore.setState({ timerEnd, phase, cards, tabooWords, tabooBuzzes });
});

socket.on('clue:card-resolved', ({ cardIndex, word, result, scores }) => {
  useGameStore.setState(s => {
    const newCards = [...s.cards];
    newCards[cardIndex] = { word, result };
    return { cards: newCards, scores };
  });
});

socket.on('clue:card-undone', ({ cardIndex, scores }) => {
  useGameStore.setState(s => {
    const newCards = [...s.cards];
    if (newCards[cardIndex]) newCards[cardIndex] = { ...newCards[cardIndex], result: null };
    return { cards: newCards, scores };
  });
});

socket.on('taboo:buzzed', ({ scores, tabooBuzzes }) => {
  useGameStore.setState({ scores, tabooBuzzes });
});

socket.on('taboo:unbuzzed', ({ scores, tabooBuzzes }) => {
  useGameStore.setState({ scores, tabooBuzzes });
});

// Turn/round transitions
socket.on('turn:ended', ({ phase, scores, round, nextActiveTeam, turnScore }) => {
  useGameStore.setState({ phase, scores, round, nextActiveTeam, turnScore, timerEnd: null });
});

socket.on('round:setup', ({ phase, round, activeTeam, scores, tabooMasters }) => {
  if (tabooMasters) useGameStore.setState({ tabooMasters });
  useGameStore.setState({
    phase, round, activeTeam, scores,
    cards: [], tabooWords: [], tabooSuggestions: [], tabooBuzzes: {},
    clueGiverId: null, tabooMasterId: null,
    timerEnd: null, turnScore: null,
  });
});

socket.on('game:reset', ({ room }) => {
  useGameStore.setState({
    ...initialState,
    connected: true,
    playerId: useGameStore.getState().playerId,
    playerName: useGameStore.getState().playerName,
    roomCode: room.code,
    hostId: room.hostId,
    players: room.players,
    settings: room.settings,
    tabooMasters: room.tabooMasters,
    phase: 'LOBBY',
  });
});
