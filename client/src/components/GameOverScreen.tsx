import { useGameStore, useTeamPlayers, useIsHost } from '../store';
import { socket } from '../socket';

export default function GameOverScreen() {
  const scores = useGameStore(s => s.scores);
  const winner = scores.A > scores.B ? 'A' : scores.B > scores.A ? 'B' : null;
  const isHost = useIsHost();
  const teamA = useTeamPlayers('A');
  const teamB = useTeamPlayers('B');

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-8 animate-fade-in">
      {/* Background effect */}
      <div className="fixed inset-0 pointer-events-none">
        {winner === 'A' && <div className="absolute inset-0 bg-team-a/5" />}
        {winner === 'B' && <div className="absolute inset-0 bg-team-b/5" />}
      </div>

      <div className="text-center relative z-10 animate-score-pop">
        <h1 className="font-display text-4xl text-white tracking-wider mb-2"
            style={{ textShadow: winner
              ? `0 0 40px ${winner === 'A' ? 'rgba(59,130,246,0.4)' : 'rgba(239,68,68,0.4)'}`
              : undefined }}>
          {winner ? `Team ${winner} Wins!` : "It's a Tie!"}
        </h1>
      </div>

      <div className="flex gap-10 text-center relative z-10">
        <div className={`transition-all ${winner === 'A' ? 'scale-110' : winner === 'B' ? 'opacity-50' : ''}`}>
          <div className="text-team-a-glow font-display text-sm tracking-wider">Team A</div>
          <div className="font-display text-5xl text-white mt-1">{scores.A}</div>
          <div className="text-gray-600 text-xs mt-2">
            {teamA.map(p => p.name).join(', ')}
          </div>
        </div>
        <div className={`transition-all ${winner === 'B' ? 'scale-110' : winner === 'A' ? 'opacity-50' : ''}`}>
          <div className="text-team-b-glow font-display text-sm tracking-wider">Team B</div>
          <div className="font-display text-5xl text-white mt-1">{scores.B}</div>
          <div className="text-gray-600 text-xs mt-2">
            {teamB.map(p => p.name).join(', ')}
          </div>
        </div>
      </div>

      <div className="w-full max-w-xs space-y-3 relative z-10">
        {isHost ? (
          <button
            onClick={() => socket.emit('game:play-again')}
            className="btn-primary w-full py-4 rounded-2xl text-white font-display text-lg
                       tracking-wider transition-all active:scale-[0.97]"
          >
            Play Again
          </button>
        ) : (
          <div className="text-center text-gray-600 text-xs py-2">Waiting for host...</div>
        )}
        <button
          onClick={() => {
            socket.emit('room:leave');
            useGameStore.getState().reset();
            localStorage.removeItem('taboo_session');
          }}
          className="w-full py-3 text-gray-500 hover:text-white transition-colors text-sm"
        >
          Leave Room
        </button>
      </div>
    </div>
  );
}
