import { Server } from 'socket.io';
import { RoomManager } from '../game/RoomManager';
import { SocketContext } from './context';
import { registerLobbyHandlers } from './lobbyHandlers';
import { registerSetupHandlers } from './setupHandlers';
import { registerGameHandlers } from './gameHandlers';
import { registerConnectionHandlers } from './connectionHandlers';
import { logger } from '../logger';

export function registerHandlers(io: Server, rooms: RoomManager) {
  io.on('connection', (socket) => {
    let playerId: string | null = null;

    logger.debug('conn', 'Socket connected', { socketId: socket.id });

    const ctx: SocketContext = {
      io, socket, rooms,
      getPlayerId: () => playerId,
      setPlayerId: (id) => { playerId = id; },
    };

    registerLobbyHandlers(ctx);
    registerSetupHandlers(ctx);
    registerGameHandlers(ctx);
    registerConnectionHandlers(ctx);
  });
}
