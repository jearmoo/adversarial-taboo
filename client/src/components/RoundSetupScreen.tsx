import { useGameStore, useMyPlayer } from '../store';
import { socket } from '../socket';

export default function RoundSetupScreen() {
  const round = useGameStore(s => s.round);
  const activeTeam = useGameStore(s => s.activeTeam);
  const players = useGameStore(s => s.players);
  const settings = useGameStore(s => s.settings);
  const tabooMasters = useGameStore(s => s.tabooMasters);
  const me = useMyPlayer();

  const activeTeamTMId = activeTeam ? tabooMasters[activeTeam] : null;
  const activeTeamTMName = players.find(p => p.id === activeTeamTMId)?.name;
  const isTabooMaster = me?.id === activeTeamTMId;
  const teamPlayers = players.filter(p => p.team === activeTeam && p.connected);

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-8 animate-fade-in">
      <div className="text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-gray-500 font-medium">
          Round {round} of {settings.rounds}
        </div>
        <h2 className="font-display text-3xl text-white mt-2 tracking-wider">
          Team {activeTeam}'s Turn
        </h2>
        <div className={`w-16 h-1 mx-auto mt-3 rounded-full ${activeTeam === 'A' ? 'bg-team-a' : 'bg-team-b'}`} />
      </div>

      {isTabooMaster ? (
        <div className="w-full max-w-xs space-y-3 animate-slide-up">
          <div className="text-accent text-center text-sm font-semibold mb-2">
            You're the Taboo Master — pick your team's clue-giver
          </div>
          {teamPlayers.map(p => (
            <button key={p.id}
              onClick={() => socket.emit('round:pick-clue-giver', { clueGiverId: p.id })}
              className="w-full py-4 glass-card hover:bg-surface-hover rounded-2xl text-white font-semibold text-lg transition-all active:scale-[0.97] border border-white/5">
              {p.name}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center">
          <div className="text-gray-500 text-sm">
            {activeTeamTMName ? (
              <><span className="text-accent font-medium">{activeTeamTMName}</span> (Taboo Master) is picking the clue-giver...</>
            ) : (
              <>Waiting for taboo master to pick clue-giver...</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
