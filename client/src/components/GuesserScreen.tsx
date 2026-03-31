import { useGameStore } from '../store';
import Timer from './Timer';

export default function GuesserScreen() {
  const phase = useGameStore(s => s.phase);
  const cards = useGameStore(s => s.cards);
  const timerEnd = useGameStore(s => s.timerEnd);
  const scores = useGameStore(s => s.scores);
  const activeTeam = useGameStore(s => s.activeTeam);
  const tabooBuzzes = useGameStore(s => s.tabooBuzzes);
  const clueGiverId = useGameStore(s => s.clueGiverId);
  const players = useGameStore(s => s.players);

  const clueGiverName = players.find(p => p.id === clueGiverId)?.name;
  const correctCards = cards.filter(c => c.result === 'correct');
  const remaining = cards.filter(c => c.result === null).length;
  const buzzedWords = Object.entries(tabooBuzzes).filter(([_, c]) => c > 0);
  const totalBuzzes = buzzedWords.reduce((sum, [_, c]) => sum + c, 0);
  const liveScore = correctCards.length * 3 - totalBuzzes;

  if (phase === 'TABOO_INPUT') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 gap-6 animate-fade-in">
        <div className="glass-card rounded-2xl p-6 border border-white/5 max-w-xs text-center">
          <div className="font-display text-xl text-white tracking-wider mb-2">
            Opponents are setting taboo words...
          </div>
          <div className="text-gray-500 text-sm">
            {clueGiverName} will be giving clues.
          </div>
        </div>
        <div className="flex items-center gap-3 text-gray-600 text-sm">
          <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          Get ready to guess!
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-6 animate-fade-in">
      {timerEnd && <Timer endTime={timerEnd} />}

      <div className="text-right">
        <div className={`font-display text-3xl ${liveScore >= 0 ? 'text-emerald-400' : 'text-team-b-glow'}`}>
          {liveScore >= 0 ? '+' : ''}{liveScore}
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 border border-white/5 w-full max-w-xs text-center">
        <div className="font-display text-xl text-white tracking-wider mb-4">
          Listen and guess!
        </div>
        <div className="text-gray-400 text-sm">
          {clueGiverName} is giving clues
        </div>
      </div>

      {/* Got words */}
      {correctCards.length > 0 && (
        <div className="w-full max-w-xs space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-emerald-400/60 mb-1">Got</div>
          {correctCards.map((card, i) => (
            <div key={i} className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-sm font-medium">
              ✓ {card.word} <span className="text-emerald-400/60">+3</span>
            </div>
          ))}
        </div>
      )}

      <div className="text-gray-500 text-sm">
        {remaining} word{remaining !== 1 ? 's' : ''} remaining
        {totalBuzzes > 0 && <span className="text-team-b-glow"> · {totalBuzzes} buzz{totalBuzzes !== 1 ? 'es' : ''}</span>}
      </div>

      {/* Buzzed taboo words revealed */}
      {buzzedWords.length > 0 && (
        <div className="flex flex-wrap gap-1.5 justify-center">
          {buzzedWords.map(([word, count]) => (
            <span key={word} className="px-2 py-1 bg-team-b/10 text-team-b-glow/80 rounded-lg text-xs border border-team-b/15">
              {word}{count > 1 && ` ×${count}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
