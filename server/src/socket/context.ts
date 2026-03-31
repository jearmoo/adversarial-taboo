import { Server, Socket } from 'socket.io';
import { RoomManager } from '../game/RoomManager';
import { Room } from '../game/Room';

export interface SocketContext {
  io: Server;
  socket: Socket;
  rooms: RoomManager;
  getPlayerId: () => string | null;
  setPlayerId: (id: string | null) => void;
}

export function buildGameState(room: Room) {
  if (!room.game) return null;
  return {
    phase: room.game.phase,
    round: room.game.round,
    scores: room.game.scores,
    challenges: {
      A: {
        cards: room.game.challenges.A.cards,
        tabooWords: room.game.challenges.A.tabooWords,
        tabooSuggestions: room.game.challenges.A.tabooSuggestions,
        tabooBuzzes: room.game.challenges.A.tabooBuzzes,
        ready: room.game.challenges.A.ready,
        clueGiverId: room.game.challenges.A.clueGiverId,
      },
      B: {
        cards: room.game.challenges.B.cards,
        tabooWords: room.game.challenges.B.tabooWords,
        tabooSuggestions: room.game.challenges.B.tabooSuggestions,
        tabooBuzzes: room.game.challenges.B.tabooBuzzes,
        ready: room.game.challenges.B.ready,
        clueGiverId: room.game.challenges.B.clueGiverId,
      },
    },
    timerEnd: room.game.timerEnd,
    tabooMasters: room.game.tabooMasters,
    turnResults: room.game.turnResults,
    roundHistory: room.getRoundHistory(),
  };
}
