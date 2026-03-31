import { useState } from 'react';
import { useGameStore, useMyRole } from '../store';
import { socket } from '../socket';

export default function TabooInputScreen() {
  const [input, setInput] = useState('');
  const [refreshingIdx, setRefreshingIdx] = useState<number | null>(null);
  const cards = useGameStore(s => s.cards);
  const tabooSuggestions = useGameStore(s => s.tabooSuggestions);
  const role = useMyRole();
  const isMaster = role === 'taboo-master';
  const maxTaboo = useGameStore(s => s.settings.maxTabooWords);
  const wordsLoading = cards.length === 0;

  const handleAdd = () => {
    const word = input.trim();
    if (!word) return;
    socket.emit('taboo:suggest', { word });
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
  };

  const handleRefresh = (idx: number) => {
    if (refreshingIdx !== null) return; // prevent concurrent
    setRefreshingIdx(idx);
    socket.emit('taboo:refresh-word', { cardIndex: idx });
    // Clear after timeout (server response will update cards)
    setTimeout(() => setRefreshingIdx(null), 3000);
  };

  // Clear refresh state when cards update
  const cardsKey = cards.map(c => c.word).join(',');

  return (
    <div className="h-full flex flex-col p-4 gap-4 animate-fade-in">
      {/* 5 words display */}
      <div className="glass-card rounded-2xl p-4 border border-white/5">
        <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mb-3">The 5 words are</div>
        {wordsLoading ? (
          <div className="flex items-center gap-3 py-2">
            <div className="w-3 h-3 bg-accent rounded-full animate-pulse" />
            <span className="text-gray-400 text-sm">Fetching words...</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {cards.map((card, i) => (
              <div key={`${i}-${card.word}`} className="flex items-center gap-1.5">
                <span className="font-display text-lg text-white tracking-wider">{card.word}</span>
                {isMaster && (
                  <button
                    onClick={() => handleRefresh(i)}
                    disabled={refreshingIdx !== null}
                    className={`text-xs transition-colors ${
                      refreshingIdx === i ? 'text-accent animate-spin' : 'text-gray-600 hover:text-accent'
                    } disabled:opacity-50`}
                    title="Refresh word">
                    ↻
                  </button>
                )}
                {i < cards.length - 1 && <span className="text-gray-700 mx-1">·</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-center text-sm">
        {isMaster
          ? <span className="text-accent font-semibold">You are the Taboo Master — set the forbidden words</span>
          : <span className="text-gray-400">Suggest taboo words the clue-giver can't say</span>}
      </div>

      {/* Input - disabled while words loading */}
      <div className="flex gap-2">
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown} placeholder="Type a taboo word..." maxLength={30}
          disabled={wordsLoading}
          className="game-input flex-1 px-4 py-3 rounded-xl text-white placeholder-gray-600 disabled:opacity-50" />
        <button onClick={handleAdd} disabled={!input.trim() || tabooSuggestions.length >= maxTaboo || wordsLoading}
          className="btn-team-b px-5 py-3 rounded-xl text-white font-display tracking-wider disabled:opacity-30 disabled:shadow-none transition-all active:scale-[0.97]">
          Add
        </button>
      </div>

      {/* Taboo word chips */}
      <div className="flex-1 overflow-auto">
        <div className="flex flex-wrap gap-2">
          {tabooSuggestions.map((word, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-3.5 py-2
              bg-team-b/15 text-team-b-glow rounded-xl text-sm font-medium
              border border-team-b/20 animate-score-pop">
              {word}
              {isMaster && (
                <button onClick={() => socket.emit('taboo:remove', { word })}
                  className="text-team-b-glow/50 hover:text-white text-xs ml-0.5">&times;</button>
              )}
            </span>
          ))}
        </div>
      </div>

      <div className="text-center text-xs text-gray-500">
        {tabooSuggestions.length}/{maxTaboo} words
        {tabooSuggestions.length < 1 && <span className="text-team-b-glow"> (add at least 1)</span>}
      </div>

      {isMaster && (
        <button onClick={() => socket.emit('taboo:confirm')}
          disabled={tabooSuggestions.length < 1 || wordsLoading}
          className="btn-team-b w-full py-4 rounded-2xl text-white font-display text-lg tracking-wider disabled:opacity-30 disabled:shadow-none transition-all active:scale-[0.97]">
          Lock In Taboo Words
        </button>
      )}
    </div>
  );
}
