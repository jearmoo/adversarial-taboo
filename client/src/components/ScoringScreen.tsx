import { useGameStore, useIsHost } from '../store';
import { socket } from '../socket';

export default function ScoringScreen() {
  const turnScore = useGameStore(s => s.turnScore);
  const scores = useGameStore(s => s.scores);
  const nextActiveTeam = useGameStore(s => s.nextActiveTeam);
  const phase = useGameStore(s => s.phase);
  const host = useIsHost();

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-8 animate-fade-in">
      <h2 className="font-display text-2xl text-white tracking-wider">Turn Complete</h2>

      {turnScore && (
        <div className="glass-card rounded-2xl p-5 w-full max-w-xs space-y-3 border border-white/5 animate-slide-up">
          <div className="flex justify-between items-center">
            <span className="text-emerald-400 text-sm">Correct ({turnScore.correct} words)</span>
            <span className="font-display text-emerald-400 text-lg">+{turnScore.correct * 3}</span>
          </div>
          {turnScore.missed > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-gray-500 text-sm">Missed ({turnScore.missed} words)</span>
              <span className="font-display text-gray-500 text-lg">0</span>
            </div>
          )}
          {turnScore.buzzes > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-team-b-glow text-sm">Buzzes ({turnScore.buzzes}x)</span>
              <span className="font-display text-team-b-glow text-lg">-{turnScore.buzzes}</span>
            </div>
          )}
          <div className="border-t border-white/10 pt-3 flex justify-between items-center">
            <span className="text-white font-medium text-sm">Turn total</span>
            <span className="font-display text-white text-xl">
              {turnScore.points >= 0 ? '+' : ''}{turnScore.points}
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-10 text-center animate-score-pop">
        <div>
          <div className="text-team-a-glow font-display text-sm tracking-wider">Team A</div>
          <div className="font-display text-4xl text-white mt-1"
               style={{ textShadow: '0 0 20px rgba(59, 130, 246, 0.3)' }}>{scores.A}</div>
        </div>
        <div className="text-gray-700 font-display text-2xl self-end mb-1">vs</div>
        <div>
          <div className="text-team-b-glow font-display text-sm tracking-wider">Team B</div>
          <div className="font-display text-4xl text-white mt-1"
               style={{ textShadow: '0 0 20px rgba(239, 68, 68, 0.3)' }}>{scores.B}</div>
        </div>
      </div>

      {nextActiveTeam && phase !== 'GAME_OVER' && (
        <div className="text-gray-500 text-xs tracking-wider uppercase">Next up: Team {nextActiveTeam}</div>
      )}

      {host && phase !== 'GAME_OVER' && (
        <button onClick={() => socket.emit('round:next')}
          className="btn-primary w-full max-w-xs py-4 rounded-2xl text-white font-display text-lg tracking-wider transition-all active:scale-[0.97]">
          Continue
        </button>
      )}
    </div>
  );
}
