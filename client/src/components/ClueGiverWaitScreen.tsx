export default function ClueGiverWaitScreen() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-8 animate-fade-in">
      <div className="text-center">
        <div className="font-display text-2xl text-white tracking-wider mb-4">You're the Clue-Giver</div>
        <div className="glass-card rounded-2xl p-5 max-w-xs border border-white/5">
          <p className="text-gray-400 text-sm leading-relaxed">
            The other team is setting up taboo words. You'll see your 5 words once they're done.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 text-gray-600 text-sm">
        <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
        Waiting for taboo words...
      </div>
    </div>
  );
}
