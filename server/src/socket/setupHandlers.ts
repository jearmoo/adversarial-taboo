import { GamePhase, TeamId } from '../game/types';
import { Room } from '../game/Room';
import { Server } from 'socket.io';
import { SocketContext } from './context';
import { logger } from '../logger';

export function registerSetupHandlers(ctx: SocketContext) {
  const { io, socket, rooms } = ctx;

  // Helper: get the team this player's TM is creating a challenge FOR (the opposing team)
  function getChallengeTarget(): TeamId | null {
    const playerId = ctx.getPlayerId();
    if (!playerId) return null;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return null;
    const player = room.getPlayer(playerId);
    if (!player?.team) return null;
    return room.getOpposingTeam(player.team); // TM creates challenge for opposing team
  }

  function emitSetupStatus() {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return;
    io.to(room.code).emit('setup:status', room.getSetupStatus());
  }

  // Pick clue-giver for OWN team
  socket.on('setup:pick-clue-giver', ({ clueGiverId }: { clueGiverId: string }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game || room.game.phase !== GamePhase.PARALLEL_SETUP) return;
    const player = room.getPlayer(playerId);
    if (!player?.team) return;

    // Only TM can pick clue-giver
    if (playerId !== room.tabooMasters[player.team]) return;

    if (room.setClueGiver(player.team, clueGiverId)) {
      const cgName = room.getPlayer(clueGiverId)?.name;
      logger.info('setup', 'Clue-giver picked', { room: room.code, team: player.team, clueGiver: cgName });
      // Notify own team
      for (const p of room.getTeamPlayers(player.team)) {
        io.to(p.socketId).emit('setup:clue-giver-set', { team: player.team, clueGiverId });
      }
      emitSetupStatus();
    }
  });

  // Suggest taboo word (for opposing team's challenge)
  socket.on('setup:suggest', ({ word }: { word: string }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game || room.game.phase !== GamePhase.PARALLEL_SETUP) return;
    const forTeam = getChallengeTarget();
    if (!forTeam) return;

    const suggestions = room.suggestTabooWord(forTeam, word);
    // Broadcast to own team (the ones setting up)
    const player = room.getPlayer(playerId);
    if (!player?.team) return;
    for (const p of room.getTeamPlayers(player.team)) {
      io.to(p.socketId).emit('setup:taboo-updated', { forTeam, words: suggestions });
    }
    emitSetupStatus();
  });

  // Remove taboo word
  socket.on('setup:remove', ({ word }: { word: string }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game || room.game.phase !== GamePhase.PARALLEL_SETUP) return;
    const forTeam = getChallengeTarget();
    if (!forTeam) return;
    // Only TM can remove
    const player = room.getPlayer(playerId);
    if (!player?.team || playerId !== room.tabooMasters[player.team]) return;

    const suggestions = room.removeTabooWord(forTeam, word);
    for (const p of room.getTeamPlayers(player.team)) {
      io.to(p.socketId).emit('setup:taboo-updated', { forTeam, words: suggestions });
    }
    emitSetupStatus();
  });

  // Refresh a word
  socket.on('setup:refresh-word', async ({ cardIndex }: { cardIndex: number }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game || room.game.phase !== GamePhase.PARALLEL_SETUP) return;
    const forTeam = getChallengeTarget();
    if (!forTeam) return;
    const player = room.getPlayer(playerId);
    if (!player?.team || playerId !== room.tabooMasters[player.team]) return;

    const newWord = await room.refreshWord(forTeam, cardIndex);
    if (!newWord || !room.game) return;

    logger.info('setup', 'Word refreshed', { room: room.code, forTeam, index: cardIndex, newWord });
    for (const p of room.getTeamPlayers(player.team)) {
      io.to(p.socketId).emit('setup:cards-updated', {
        forTeam,
        cards: room.game.challenges[forTeam].cards.map(c => ({ word: c.word, result: c.result })),
      });
    }
  });

  // Lock in challenge
  socket.on('setup:confirm', () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game || room.game.phase !== GamePhase.PARALLEL_SETUP) return;
    const forTeam = getChallengeTarget();
    if (!forTeam) return;
    const player = room.getPlayer(playerId);
    if (!player?.team || playerId !== room.tabooMasters[player.team]) return;

    // Also need clue-giver for own team — and they must still be connected
    const clueGiverId = room.game.challenges[player.team].clueGiverId;
    if (!clueGiverId) {
      socket.emit('room:error', { message: 'Pick your team\'s clue-giver first' });
      return;
    }
    const clueGiver = room.getPlayer(clueGiverId);
    if (!clueGiver?.connected) {
      socket.emit('room:error', { message: 'Your clue-giver has disconnected — pick a new one' });
      return;
    }

    if (!room.confirmChallenge(forTeam)) {
      socket.emit('room:error', { message: 'Need at least 1 taboo word' });
      return;
    }

    logger.info('setup', 'Challenge locked in', { room: room.code, by: player.team, forTeam });
    emitSetupStatus();

    // If both ready, start cluing
    if (room.bothChallengesReady()) {
      logger.info('game', 'Both teams ready, preparing CLUING_A', { room: room.code });
      prepareCluingPhase(room, 'A', io);
    }
  });

  // Unlock challenge
  socket.on('setup:unconfirm', () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game || room.game.phase !== GamePhase.PARALLEL_SETUP) return;
    const forTeam = getChallengeTarget();
    if (!forTeam) return;
    const player = room.getPlayer(playerId);
    if (!player?.team || playerId !== room.tabooMasters[player.team]) return;

    if (room.unconfirmChallenge(forTeam)) {
      logger.info('setup', 'Challenge unlocked', { room: room.code, by: player.team, forTeam });
      emitSetupStatus();
    }
  });
}

// Shared: prepare a cluing phase (no timer — clue-giver presses "Begin" to start)
export function prepareCluingPhase(room: Room, team: TeamId, io: Server) {
  if (!room.game) return;
  const opposingTeam = room.getOpposingTeam(team);
  const challenge = room.game.challenges[team];

  room.prepareCluingPhase(team);

  const basePayload = {
    clueGiverId: challenge.clueGiverId,
    timerEnd: null, phase: room.game.phase, team,
  };
  const realCards = challenge.cards.map(c => ({ word: c.word, result: c.result }));
  const maskedCards = challenge.cards.map(c => ({ word: '???', result: c.result }));

  // Clue-giver: sees real words, no taboo info
  const clueGiver = challenge.clueGiverId ? room.getPlayer(challenge.clueGiverId) : null;
  if (clueGiver) {
    io.to(clueGiver.socketId).emit('clue:start', {
      ...basePayload, cards: realCards, tabooWords: [], tabooBuzzes: {},
    });
  }

  // Same-team guessers: masked words, no taboo info
  for (const p of room.getTeamPlayers(team).filter(p => p.id !== challenge.clueGiverId)) {
    io.to(p.socketId).emit('clue:start', {
      ...basePayload, cards: maskedCards, tabooWords: [], tabooBuzzes: {},
    });
  }

  // Opposing team: real words + taboo info
  for (const p of room.getTeamPlayers(opposingTeam)) {
    io.to(p.socketId).emit('clue:start', {
      ...basePayload, cards: realCards,
      tabooWords: challenge.tabooWords, tabooBuzzes: challenge.tabooBuzzes,
    });
  }
}
