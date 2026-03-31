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

export function getRoom(ctx: SocketContext): Room | undefined {
  const pid = ctx.getPlayerId();
  if (!pid) return undefined;
  return ctx.rooms.getRoomForPlayer(pid);
}

export function buildGameState(room: Room) {
  if (!room.game) return null;
  return {
    phase: room.game.phase,
    round: room.game.round,
    scores: room.game.scores,
    turn: {
      activeTeam: room.game.turn.activeTeam,
      clueGiverId: room.game.turn.clueGiverId,
      timerEnd: room.game.turn.timerEnd,
      cards: room.game.turn.cards,
      tabooWords: room.game.turn.tabooWords,
      tabooSuggestions: room.game.turn.tabooSuggestions,
      tabooBuzzes: room.game.turn.tabooBuzzes,
    },
  };
}
