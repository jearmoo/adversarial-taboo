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
      A: { ...room.game.challenges.A },
      B: { ...room.game.challenges.B },
    },
    timerEnd: room.game.timerEnd,
    tabooMasters: room.game.tabooMasters,
    turnResults: room.game.turnResults,
    roundHistory: room.getRoundHistory(),
  };
}
