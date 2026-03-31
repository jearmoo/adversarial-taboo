import { GamePhase } from '../game/types';
import { SocketContext } from './context';

export function registerGameHandlers(ctx: SocketContext) {
  const { io, socket, rooms } = ctx;

  socket.on('round:pick-clue-giver', async ({ clueGiverId: cgId }: { clueGiverId: string }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game || room.game.phase !== GamePhase.ROUND_SETUP) return;

    const activeTeam = room.game.turn.activeTeam;
    const activeTeamTM = room.ensureTabooMaster(activeTeam);
    if (playerId !== activeTeamTM) {
      socket.emit('room:error', { message: 'Only your team\'s taboo master can pick the clue-giver' });
      return;
    }

    if (!room.setClueGiver(cgId)) {
      socket.emit('room:error', { message: 'Invalid clue-giver selection' });
      return;
    }

    const opposingTeam = room.getOpposingTeam(activeTeam);
    const opposingTM = room.getTabooMasterForOpposing();

    io.to(room.code).emit('round:clue-giver-set', {
      clueGiverId: cgId, tabooMasterId: opposingTM, phase: GamePhase.TABOO_INPUT,
    });

    const cards = await room.fetchAndSetWords();
    const opposingPlayers = room.getTeamPlayers(opposingTeam);
    for (const p of opposingPlayers) {
      io.to(p.socketId).emit('round:cards', {
        cards: cards.map(c => ({ word: c.word, result: c.result })),
      });
    }
  });

  socket.on('taboo:refresh-word', async ({ cardIndex }: { cardIndex: number }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game || room.game.phase !== GamePhase.TABOO_INPUT) return;
    if (playerId !== room.getTabooMasterForOpposing()) return;

    const newWord = await room.refreshWord(cardIndex);
    if (!newWord) return;

    const opposingTeam = room.getOpposingTeam(room.game.turn.activeTeam);
    const opposingPlayers = room.getTeamPlayers(opposingTeam);
    for (const p of opposingPlayers) {
      io.to(p.socketId).emit('round:cards', {
        cards: room.game.turn.cards.map(c => ({ word: c.word, result: c.result })),
      });
    }
  });

  socket.on('taboo:suggest', ({ word }: { word: string }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game || room.game.phase !== GamePhase.TABOO_INPUT) return;
    const player = room.getPlayer(playerId);
    if (!player || player.team === room.game.turn.activeTeam) return;

    const suggestions = room.suggestTabooWord(word);
    const opposingTeam = room.getOpposingTeam(room.game.turn.activeTeam);
    for (const p of room.getTeamPlayers(opposingTeam)) {
      io.to(p.socketId).emit('taboo:words-updated', { words: suggestions });
    }
  });

  socket.on('taboo:remove', ({ word }: { word: string }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game || room.game.phase !== GamePhase.TABOO_INPUT) return;
    if (playerId !== room.getTabooMasterForOpposing()) return;

    const suggestions = room.removeTabooWord(word);
    const opposingTeam = room.getOpposingTeam(room.game.turn.activeTeam);
    for (const p of room.getTeamPlayers(opposingTeam)) {
      io.to(p.socketId).emit('taboo:words-updated', { words: suggestions });
    }
  });

  socket.on('taboo:confirm', () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game || room.game.phase !== GamePhase.TABOO_INPUT) return;
    if (playerId !== room.getTabooMasterForOpposing()) return;

    if (!room.confirmTabooWords()) {
      socket.emit('room:error', { message: 'Need at least 1 taboo word' });
      return;
    }

    const timerEnd = room.startTimer(() => {
      const result = room.endTurn();
      io.to(room.code).emit('turn:ended', {
        phase: result.nextPhase, scores: room.game!.scores,
        round: room.game!.round, nextActiveTeam: result.nextActiveTeam, turnScore: result.turnScore,
      });
    });

    const activeTeam = room.game.turn.activeTeam;
    const opposingTeam = room.getOpposingTeam(activeTeam);

    const clueGiver = room.getPlayer(room.game.turn.clueGiverId!);
    if (clueGiver) {
      io.to(clueGiver.socketId).emit('clue:start', {
        timerEnd, phase: GamePhase.CLUING,
        cards: room.game.turn.cards.map(c => ({ word: c.word, result: c.result })),
        tabooWords: [], tabooBuzzes: {},
      });
    }

    for (const p of room.getTeamPlayers(activeTeam).filter(p => p.id !== room.game!.turn.clueGiverId)) {
      io.to(p.socketId).emit('clue:start', {
        timerEnd, phase: GamePhase.CLUING,
        cards: room.game.turn.cards.map(c => ({ word: '???', result: c.result })),
        tabooWords: [], tabooBuzzes: {},
      });
    }

    for (const p of room.getTeamPlayers(opposingTeam)) {
      io.to(p.socketId).emit('clue:start', {
        timerEnd, phase: GamePhase.CLUING,
        cards: room.game.turn.cards.map(c => ({ word: c.word, result: c.result })),
        tabooWords: room.game.turn.tabooWords, tabooBuzzes: room.game.turn.tabooBuzzes,
      });
    }
  });

  socket.on('clue:got-it', ({ cardIndex }: { cardIndex: number }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game || room.game.phase !== GamePhase.CLUING) return;
    if (playerId !== room.game.turn.clueGiverId) return;

    if (!room.resolveCard(cardIndex)) return;
    const card = room.game.turn.cards[cardIndex];
    io.to(room.code).emit('clue:card-resolved', {
      cardIndex, word: card.word, result: 'correct', scores: room.game.scores,
    });

    if (room.allCardsResolved()) {
      const result = room.endTurn();
      io.to(room.code).emit('turn:ended', {
        phase: result.nextPhase, scores: room.game!.scores,
        round: room.game!.round, nextActiveTeam: result.nextActiveTeam, turnScore: result.turnScore,
      });
    }
  });

  socket.on('clue:undo', ({ cardIndex }: { cardIndex: number }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game || room.game.phase !== GamePhase.CLUING) return;
    if (playerId !== room.game.turn.clueGiverId) return;
    if (!room.undoCard(cardIndex)) return;
    io.to(room.code).emit('clue:card-undone', { cardIndex, scores: room.game.scores });
  });

  socket.on('taboo:buzz', ({ tabooWord }: { tabooWord: string }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game || room.game.phase !== GamePhase.CLUING) return;
    if (playerId !== room.getTabooMasterForOpposing()) return;

    const count = room.buzzTabooWord(tabooWord);
    if (count === 0) return;
    io.to(room.code).emit('taboo:buzzed', {
      tabooWord, count, scores: room.game.scores, tabooBuzzes: room.game.turn.tabooBuzzes,
    });
  });

  socket.on('taboo:undo-buzz', ({ tabooWord }: { tabooWord: string }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game || room.game.phase !== GamePhase.CLUING) return;
    if (playerId !== room.getTabooMasterForOpposing()) return;

    const count = room.undoBuzzTabooWord(tabooWord);
    io.to(room.code).emit('taboo:unbuzzed', {
      tabooWord, count, scores: room.game.scores, tabooBuzzes: room.game.turn.tabooBuzzes,
    });
  });

  socket.on('round:next', () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return;
    room.ensureTabooMaster('A');
    room.ensureTabooMaster('B');
    room.advanceFromTurnResult();
    io.to(room.code).emit('round:setup', {
      phase: room.game.phase, round: room.game.round,
      activeTeam: room.game.turn.activeTeam, scores: room.game.scores,
      tabooMasters: room.tabooMasters,
    });
  });

  socket.on('game:play-again', () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    room.resetToLobby();
    io.to(room.code).emit('game:reset', { room: room.toDTO() });
  });
}
