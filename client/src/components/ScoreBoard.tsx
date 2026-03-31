import { useState } from 'react';
import { useGameStore, useTeamPlayers, useMyPlayer, useMyRole } from '../store';
import { socket } from '../socket';

const ROLE_LABELS: Record<string, string> = {
  'clue-giver': 'Clue-Giver',
  'guesser': 'Guesser',
  'taboo-master': 'Taboo Master',
  'taboo-watcher': 'Watcher',
};

export default function ScoreBoard() {
  const [expanded, setExpanded] = useState(false);
  const scores = useGameStore(s => s.scores);
  const round = useGameStore(s => s.round);
  const settings = useGameStore(s => s.settings);
  const activeTeam = useGameStore(s => s.activeTeam);
  const clueGiverId = useGameStore(s => s.clueGiverId);
  const tabooMasters = useGameStore(s => s.tabooMasters);
  const hostId = useGameStore(s => s.hostId);
  const teamA = useTeamPlayers('A');
  const teamB = useTeamPlayers('B');
  const me = useMyPlayer();
  const myRole = useMyRole();

  const teamColor = me?.team === 'A' ? 'text-team-a-glow' : me?.team === 'B' ? 'text-team-b-glow' : 'text-gray-400';

  return (
    <div className="bg-surface-card border-b border-white/5">
      {/* Player identity strip */}
      <div className="flex items-center justify-center gap-2 px-4 py-1 text-[10px] border-b border-white/[0.03]">
        <span className={`font-semibold ${teamColor}`}>{me?.name}</span>
        {me?.team && <span className="text-gray-600">·</span>}
        {me?.team && <span className={teamColor}>Team {me.team}</span>}
        {myRole && <span className="text-gray-600">·</span>}
        {myRole && <span className="text-accent font-medium">{ROLE_LABELS[myRole] || myRole}</span>}
      </div>

      {/* Score bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2"
      >
        <div className={`flex items-center gap-2 ${activeTeam === 'A' ? '' : 'opacity-50'}`}>
          <div className="w-2.5 h-2.5 rounded-full bg-team-a shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          <span className="text-team-a-glow font-display text-sm tracking-wider">A: {scores.A}</span>
        </div>
        <div className="text-gray-600 text-[10px] tracking-[0.2em] uppercase font-medium">
          R{round}/{settings.rounds}
          <span className="ml-1.5 text-gray-700">{expanded ? '▲' : '▼'}</span>
        </div>
        <div className={`flex items-center gap-2 ${activeTeam === 'B' ? '' : 'opacity-50'}`}>
          <span className="text-team-b-glow font-display text-sm tracking-wider">B: {scores.B}</span>
          <div className="w-2.5 h-2.5 rounded-full bg-team-b shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
        </div>
      </button>

      {expanded && (
        <div className="flex gap-3 px-4 pb-3 animate-slide-up">
          <RosterColumn team="A" players={teamA} myId={me?.id ?? null}
            clueGiverId={clueGiverId} tabooMasterId={tabooMasters.A} hostId={hostId} />
          <RosterColumn team="B" players={teamB} myId={me?.id ?? null}
            clueGiverId={clueGiverId} tabooMasterId={tabooMasters.B} hostId={hostId} />
        </div>
      )}
    </div>
  );
}

function RosterColumn({ team, players, myId, clueGiverId, tabooMasterId, hostId }: {
  team: 'A' | 'B';
  players: Array<{ id: string; name: string; connected: boolean }>;
  myId: string | null;
  clueGiverId: string | null;
  tabooMasterId: string | null;
  hostId: string | null;
}) {
  const borderColor = team === 'A' ? 'border-team-a/20' : 'border-team-b/20';
  const textColor = team === 'A' ? 'text-team-a-glow' : 'text-team-b-glow';
  const isOnTeam = players.some(p => p.id === myId);

  return (
    <div className={`flex-1 rounded-xl border ${borderColor} bg-surface/50 p-2`}>
      <div className="text-[9px] uppercase tracking-wider text-gray-600 mb-1 px-1">
        Team {team}
      </div>
      {players.map(p => {
        const isTM = p.id === tabooMasterId;
        const isCG = p.id === clueGiverId;
        const isHost = p.id === hostId;

        return (
          <div key={p.id} className={`flex items-center justify-between px-2 py-1 text-xs rounded-lg ${
            p.id === myId ? `${textColor} font-semibold` : 'text-gray-400'
          } ${!p.connected ? 'opacity-30' : ''}`}>
            <span>
              {p.name}
              {isCG && <span className="text-emerald-400 text-[9px] ml-1">CG</span>}
              {isTM && <span className="text-accent text-[9px] ml-1">TM</span>}
              {isHost && <span className="text-indigo-400 text-[9px] ml-1">H</span>}
            </span>
            {isOnTeam && !isTM && p.connected && (
              <button
                onClick={(e) => { e.stopPropagation(); socket.emit('taboo-master:set', { team, masterId: p.id }); }}
                className="text-[9px] text-gray-600 hover:text-accent transition-colors">
                Set TM
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
