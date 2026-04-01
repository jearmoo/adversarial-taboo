import { SocketContext } from './context';
import { GamePhase } from '../game/types';
import { logger } from '../logger';
import { handleTurnEnd } from './gameHandlers';

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

    // If disconnected player is a clue giver, handle it
    if (room.game && player.team) {
      const phase = room.game.phase;
      if (phase === GamePhase.PARALLEL_SETUP) {
        // Clear clueGiverId if this player was selected as clue giver for their team
        const challenge = room.game.challenges[player.team];
        if (challenge.clueGiverId === playerId) {
          challenge.clueGiverId = null;
          logger.info('conn', 'Clue giver cleared (disconnected during setup)', {
            room: room.code, team: player.team, player: player.name,
          });
          io.to(room.code).emit('setup:status', room.getSetupStatus());
          io.to(room.code).emit('setup:clue-giver-set', { team: player.team, clueGiverId: null });
        }
      } else if (phase === GamePhase.CLUING_A || phase === GamePhase.CLUING_B) {
        const cluingTeam = room.getCluingTeam();
        if (cluingTeam) {
          const challenge = room.game.challenges[cluingTeam];
          if (challenge.clueGiverId === playerId) {
            logger.info('conn', 'Clue giver disconnected during cluing, auto-ending turn', {
              room: room.code, team: cluingTeam, player: player.name,
            });
            handleTurnEnd(room, cluingTeam, io);
          }
        }
      }
    }

    if (player.team && room.tabooMasters[player.team] === playerId) {
      const newTM = room.ensureTabooMaster(player.team);
      const newTMName = newTM ? room.getPlayer(newTM)?.name : null;
      io.to(room.code).emit('taboo-master:updated', { tabooMasters: room.tabooMasters });
      logger.info('conn', 'Taboo master auto-reassigned', {
        room: room.code, team: player.team, oldTM: player.name, newTM: newTMName,
      });
    }

    if (room.hostId === playerId) {
      const newHost = Array.from(room.players.values()).find(p => p.connected && p.id !== playerId);
      if (newHost) {
        room.hostId = newHost.id;
        io.to(room.code).emit('room:host-updated', { hostId: newHost.id });
        logger.info('conn', 'Host auto-reassigned', {
          room: room.code, oldHost: player.name, newHost: newHost.name,
        });
      }
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
  if (player?.team) socket.leave(`${room.code}:team${player.team}`);
  socket.leave(room.code);
  room.removePlayer(playerId);
  const softRemoved = !!room.getPlayer(playerId);
  if (!softRemoved) {
    rooms.untrackPlayer(playerId);
  }

  const activePlayers = room.getActivePlayers();
  if (activePlayers.length === 0) {
    rooms.deleteRoom(room.code);
    logger.info('room', 'Room deleted (empty)', { room: room.code });
  } else if (!softRemoved) {
    if (room.hostId === playerId) {
      const nextHost = activePlayers.find(p => p.connected);
      if (nextHost) room.hostId = nextHost.id;
    }
    io.to(room.code).emit('room:player-left', {
      playerId, hostId: room.hostId, players: room.playerDTOs(),
    });
  }
  ctx.setPlayerId(null);
}
