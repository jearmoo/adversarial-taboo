import { SocketContext } from './context';

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

    // Auto-reassign taboo master if needed
    if (player.team && room.tabooMasters[player.team] === playerId) {
      room.ensureTabooMaster(player.team);
      io.to(room.code).emit('taboo-master:updated', { tabooMasters: room.tabooMasters });
    }

    setTimeout(() => {
      if (player.connected) return;
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
  if (player?.team) socket.leave(`${room.code}:team${player.team}`);
  socket.leave(room.code);
  room.removePlayer(playerId);
  rooms.untrackPlayer(playerId);

  if (room.players.size === 0) {
    rooms.deleteRoom(room.code);
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
