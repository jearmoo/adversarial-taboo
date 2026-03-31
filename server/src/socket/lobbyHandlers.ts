import { GamePhase, TeamId } from '../game/types';
import { SocketContext, buildGameState } from './context';
import { logger } from '../logger';
import { metrics } from '../metrics';
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
    metrics.roomCreated();
    metrics.playerJoined();
    logger.info('room', 'Room created', { room: room.code, player: playerName });
  });

  socket.on('room:join', ({ roomCode, playerName, sessionId }: { roomCode: string; playerName: string; sessionId?: string }) => {
    const room = rooms.getRoom(roomCode);
    if (!room) {
      logger.warn('room', 'Join failed: room not found', { room: roomCode, player: playerName });
      socket.emit('room:error', { message: 'Room not found' });
      return;
    }

    const existingByName = room.getPlayerByName(playerName);
    const existingBySession = sessionId ? room.getPlayer(sessionId) : undefined;
    const existing = existingByName || existingBySession;

    if (existing) {
      const wasDisconnected = !existing.connected;
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
      if (wasDisconnected) {
        io.to(room.code).emit('room:player-reconnected', { playerId: existing.id });
      }
      logger.info('room', wasDisconnected ? 'Player reconnected' : 'Player re-attached', {
        room: room.code, player: playerName,
      });
      return;
    }

    if (room.game && room.game.phase !== GamePhase.LOBBY) {
      logger.warn('room', 'Join rejected: game in progress', { room: room.code, player: playerName });
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
    metrics.playerJoined();
    logger.info('room', 'Player joined', { room: room.code, player: playerName });
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
    logger.info('room', 'Player joined team', { room: room.code, player: player.name, team });
  });

  socket.on('taboo-master:set', ({ team, masterId }: { team: TeamId; masterId: string }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    if (room.setTabooMaster(team, masterId)) {
      if (room.game) room.game.tabooMasters[team] = masterId;
      io.to(room.code).emit('taboo-master:updated', { tabooMasters: room.tabooMasters });
      const masterName = room.getPlayer(masterId)?.name;
      logger.info('room', 'Taboo master set', { room: room.code, team, master: masterName });
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
    logger.debug('room', 'Settings updated', { room: room.code, settings: room.settings });
  });

  socket.on('game:start', async () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room || room.hostId !== playerId) return;
    const check = room.canStart();
    if (!check.ok) { socket.emit('room:error', { message: check.reason }); return; }

    room.startGame();
    metrics.gameStarted();
    logger.info('game', 'Game started', {
      room: room.code, players: room.playerDTOs().map(p => p.name), settings: room.settings,
    });

    // Immediately emit phase change so UI transitions (cards empty = loading)
    io.to(room.code).emit('setup:started', {
      phase: GamePhase.PARALLEL_SETUP, round: room.game!.round, scores: room.game!.scores,
      challengeCards: [],
      tabooMasters: room.tabooMasters,
    });

    try {
      await room.fetchInitialWords();
    } catch (e) {
      logger.error('game', 'Failed to fetch initial words', { room: room.code, error: String(e) });
    }
    if (!room.game) return;

    // Send actual cards to each team
    emitSetupCards(room, io);
    io.to(room.code).emit('setup:status', room.getSetupStatus());
  });
}

export function emitSetupCards(room: any, io: any) {
  if (!room.game) return;
  for (const p of room.getTeamPlayers('A')) {
    io.to(p.socketId).emit('setup:cards-updated', {
      forTeam: 'B',
      cards: room.game.challenges.B.cards.map((c: any) => ({ word: c.word, result: c.result })),
    });
  }
  for (const p of room.getTeamPlayers('B')) {
    io.to(p.socketId).emit('setup:cards-updated', {
      forTeam: 'A',
      cards: room.game.challenges.A.cards.map((c: any) => ({ word: c.word, result: c.result })),
    });
  }
}
