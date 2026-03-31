import { Server } from 'socket.io';
import { RoomManager } from '../game/RoomManager';
import { SocketContext } from './context';
import { registerLobbyHandlers } from './lobbyHandlers';
import { registerGameHandlers } from './gameHandlers';
import { registerConnectionHandlers } from './connectionHandlers';

export function registerHandlers(io: Server, rooms: RoomManager) {
  io.on('connection', (socket) => {
    let playerId: string | null = null;

    const ctx: SocketContext = {
      io, socket, rooms,
      getPlayerId: () => playerId,
      setPlayerId: (id) => { playerId = id; },
    };

    registerLobbyHandlers(ctx);
    registerGameHandlers(ctx);
    registerConnectionHandlers(ctx);
  });
}
