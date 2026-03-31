import { SocketContext } from './context';
import { logger } from '../logger';

const RECONNECT_GRACE_MS = 120_000;

export function registerConnectionHandlers(ctx: SocketContext) {
  const { io, socket, rooms } = ctx;

  socket.on('room:leave', () => handleLeave(ctx));

  socket.on('disconnect', () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    const player = room.getPlayer(playerId);
    if (!player) return;

    player.connected = false;
    player.disconnectedAt = Date.now();
    io.to(room.code).emit('room:player-disconnected', { playerId });
    logger.info('conn', 'Player disconnected', { room: room.code, player: player.name });

    if (player.team && room.tabooMasters[player.team] === playerId) {
      const newTM = room.ensureTabooMaster(player.team);
      const newTMName = newTM ? room.getPlayer(newTM)?.name : null;
      io.to(room.code).emit('taboo-master:updated', { tabooMasters: room.tabooMasters });
      logger.info('conn', 'Taboo master auto-reassigned', {
        room: room.code, team: player.team, oldTM: player.name, newTM: newTMName,
      });
    }

    setTimeout(() => {
      if (player.connected) return;
      logger.info('conn', 'Player removed after grace period', { room: room.code, player: player.name });
      handleLeave(ctx);
    }, RECONNECT_GRACE_MS);
  });
}

function handleLeave(ctx: SocketContext) {
  const { io, socket, rooms } = ctx;
  const playerId = ctx.getPlayerId();
  if (!playerId) return;
  const room = rooms.getRoomForPlayer(playerId);
  if (!room) return;
  const player = room.getPlayer(playerId);
  const playerName = player?.name;
  if (player?.team) socket.leave(`${room.code}:team${player.team}`);
  socket.leave(room.code);
  room.removePlayer(playerId);
  rooms.untrackPlayer(playerId);

  if (room.players.size === 0) {
    rooms.deleteRoom(room.code);
    logger.info('room', 'Room deleted (empty)', { room: room.code });
  } else {
    if (room.hostId === playerId) {
      const nextHost = Array.from(room.players.values()).find(p => p.connected);
      if (nextHost) room.hostId = nextHost.id;
    }
    io.to(room.code).emit('room:player-left', {
      playerId, hostId: room.hostId, players: room.playerDTOs(),
    });
  }
  ctx.setPlayerId(null);
}
