import { useGameStore, useMyRole } from './store';
import HomeScreen from './components/HomeScreen';
import LobbyScreen from './components/LobbyScreen';
import ParallelSetupScreen from './components/ParallelSetupScreen';
import ClueGiverScreen from './components/ClueGiverScreen';
import GuesserScreen from './components/GuesserScreen';
import TabooWatcherScreen from './components/TabooWatcherScreen';
import ScoringScreen from './components/ScoringScreen';
import GameOverScreen from './components/GameOverScreen';
import ScoreBoard from './components/ScoreBoard';
import { HelpButton } from './components/HelpModal';

export default function App() {
  const phase = useGameStore(s => s.phase);
  const connected = useGameStore(s => s.connected);

  if (!connected) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="font-display text-xl text-gray-500 animate-pulse-slow">Connecting...</div>
      </div>
    );
  }

  if (!phase) return (
    <>
      <HomeScreen />
      <div className="fixed top-3 right-3 z-40">
        <HelpButton className="w-7 h-7 flex items-center justify-center rounded-full glass-card border border-white/10 text-xs text-gray-400 hover:text-accent transition-colors font-semibold" />
      </div>
    </>
  );

  return (
    <div className="h-full flex flex-col">
      {phase === 'LOBBY' && (
        <div className="fixed top-3 right-3 z-40">
          <HelpButton className="w-7 h-7 flex items-center justify-center rounded-full glass-card border border-white/10 text-xs text-gray-400 hover:text-accent transition-colors font-semibold" />
        </div>
      )}
      {phase !== 'LOBBY' && <ScoreBoard />}
      <div className="flex-1 min-h-0 overflow-auto">
        <ScreenRouter phase={phase} />
      </div>
    </div>
  );
}

function ScreenRouter({ phase }: { phase: string }) {
  const role = useMyRole();

  switch (phase) {
    case 'LOBBY':
      return <LobbyScreen />;
    case 'PARALLEL_SETUP':
      return <ParallelSetupScreen />;
    case 'CLUING_A':
    case 'CLUING_B':
      if (role === 'clue-giver') return <ClueGiverScreen />;
      if (role === 'guesser') return <GuesserScreen />;
      if (role === 'taboo-master') return <TabooWatcherScreen isMaster />;
      return <TabooWatcherScreen isMaster={false} />;
    case 'ROUND_RESULT':
      return <ScoringScreen />;
    case 'GAME_OVER':
      return <GameOverScreen />;
    default:
      return <HomeScreen />;
  }
}
