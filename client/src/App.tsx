import { useGameStore, useMyRole } from './store';
import HomeScreen from './components/HomeScreen';
import LobbyScreen from './components/LobbyScreen';
import RoundSetupScreen from './components/RoundSetupScreen';
import TabooInputScreen from './components/TabooInputScreen';
import ClueGiverScreen from './components/ClueGiverScreen';
import ClueGiverWaitScreen from './components/ClueGiverWaitScreen';
import GuesserScreen from './components/GuesserScreen';
import TabooWatcherScreen from './components/TabooWatcherScreen';
import ScoringScreen from './components/ScoringScreen';
import GameOverScreen from './components/GameOverScreen';
import ScoreBoard from './components/ScoreBoard';

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

  if (!phase) return <HomeScreen />;

  return (
    <div className="h-full flex flex-col">
      {phase !== 'LOBBY' && phase !== 'GAME_OVER' && <ScoreBoard />}
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
    case 'ROUND_SETUP':
      return <RoundSetupScreen />;
    case 'TABOO_INPUT':
      if (role === 'clue-giver') return <ClueGiverWaitScreen />;
      if (role === 'guesser') return <GuesserScreen />;
      return <TabooInputScreen />;
    case 'CLUING':
      if (role === 'clue-giver') return <ClueGiverScreen />;
      if (role === 'guesser') return <GuesserScreen />;
      if (role === 'taboo-master') return <TabooWatcherScreen isMaster />;
      return <TabooWatcherScreen isMaster={false} />;
    case 'TURN_RESULT':
      return <ScoringScreen />;
    case 'GAME_OVER':
      return <GameOverScreen />;
    default:
      return <HomeScreen />;
  }
}
