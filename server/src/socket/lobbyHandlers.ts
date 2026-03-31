import { GamePhase, TeamId } from '../game/types';
import { SocketContext, buildGameState } from './context';
import { randomUUID } from 'crypto';

export function registerLobbyHandlers(ctx: SocketContext) {
  const { io, socket, rooms } = ctx;

  socket.on('room:create', ({ playerName }: { playerName: string }) => {
    const playerId = randomUUID();
    ctx.setPlayerId(playerId);
    const room = rooms.createRoom(playerId);
    room.addPlayer(playerId, playerName, socket.id);
    rooms.trackPlayer(playerId, room.code);
    socket.join(room.code);
    socket.emit('room:created', { roomCode: room.code, playerId, room: room.toDTO() });
  });

  socket.on('room:join', ({ roomCode, playerName, sessionId }: { roomCode: string; playerName: string; sessionId?: string }) => {
    const room = rooms.getRoom(roomCode);
    if (!room) { socket.emit('room:error', { message: 'Room not found' }); return; }

    const existingByName = room.getPlayerByName(playerName);
    const existingBySession = sessionId ? room.getPlayer(sessionId) : undefined;
    const existing = existingByName || existingBySession;

    if (existing) {
      if (existing.connected) {
        existing.socketId = socket.id;
      } else {
        existing.connected = true;
        existing.socketId = socket.id;
        existing.disconnectedAt = undefined;
      }
      ctx.setPlayerId(existing.id);
      rooms.trackPlayer(existing.id, room.code);
      socket.join(room.code);
      if (existing.team) socket.join(`${room.code}:team${existing.team}`);

      socket.emit('room:rejoined', {
        roomCode: room.code, playerId: existing.id, room: room.toDTO(),
        game: buildGameState(room),
      });
      if (!existing.connected) {
        io.to(room.code).emit('room:player-reconnected', { playerId: existing.id });
      }
      return;
    }

    if (room.game && room.game.phase !== GamePhase.LOBBY) {
      socket.emit('room:error', { message: 'Game in progress. Use the same name to reconnect.' });
      return;
    }

    const playerId = randomUUID();
    ctx.setPlayerId(playerId);
    room.addPlayer(playerId, playerName, socket.id);
    rooms.trackPlayer(playerId, room.code);
    socket.join(room.code);
    socket.emit('room:joined', { roomCode: room.code, playerId, room: room.toDTO() });
    socket.to(room.code).emit('room:player-joined', {
      player: { id: playerId, name: playerName, team: null, connected: true },
    });
  });

  socket.on('team:join', ({ team }: { team: TeamId }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    const player = room.getPlayer(playerId);
    if (!player) return;
    if (player.team) socket.leave(`${room.code}:team${player.team}`);
    player.team = team;
    socket.join(`${room.code}:team${team}`);
    io.to(room.code).emit('team:updated', { players: room.playerDTOs() });
  });

  socket.on('taboo-master:set', ({ team, masterId }: { team: TeamId; masterId: string }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    if (room.setTabooMaster(team, masterId)) {
      if (room.game) room.game.tabooMasters[team] = masterId;
      io.to(room.code).emit('taboo-master:updated', { tabooMasters: room.tabooMasters });
    }
  });

  socket.on('settings:update', ({ rounds, timerSeconds, wordsPerTurn, maxTabooWords }: {
    rounds?: number; timerSeconds?: number; wordsPerTurn?: number; maxTabooWords?: number;
  }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room || room.hostId !== playerId) return;
    if (rounds !== undefined) room.settings.rounds = Math.max(1, Math.min(5, rounds));
    if (timerSeconds !== undefined) room.settings.timerSeconds = Math.max(10, Math.min(600, timerSeconds));
    if (wordsPerTurn !== undefined) room.settings.wordsPerTurn = Math.max(1, Math.min(10, wordsPerTurn));
    if (maxTabooWords !== undefined) room.settings.maxTabooWords = Math.max(5, Math.min(30, maxTabooWords));
    io.to(room.code).emit('settings:updated', { settings: room.settings });
  });

  socket.on('game:start', () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room || room.hostId !== playerId) return;
    const check = room.canStart();
    if (!check.ok) { socket.emit('room:error', { message: check.reason }); return; }
    room.startGame();
    io.to(room.code).emit('game:started', {
      phase: GamePhase.ROUND_SETUP,
      round: room.game!.round,
      activeTeam: room.game!.turn.activeTeam,
      scores: room.game!.scores,
      tabooMasters: room.game!.tabooMasters,
    });
  });
}
