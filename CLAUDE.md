# Adversarial Taboo

Real-time multiplayer party game. Two teams compete: opposing Taboo Masters set forbidden words, then clue-givers describe words without using them.

## Stack

- **Server**: Node.js + Express + Socket.IO + TypeScript (`server/src/`)
- **Client**: React 18 + Vite + Zustand + Tailwind CSS (`client/src/`)
- **Deploy**: Docker on port 4040

## Development

```bash
npm run dev          # runs both client (:5173) and server (:4040)
```

No local TypeScript compiler — use Docker to verify builds:
```bash
docker compose up -d --build
```

## Architecture

### Game Phases
`LOBBY` → `PARALLEL_SETUP` → `CLUING_A` → `CLUING_B` → `ROUND_RESULT` → (repeat or `GAME_OVER`)

### Data Model
- `Room` class holds all state: players, settings, game, round history
- `challenges[X]` = challenge FOR team X (created BY opposing TM)
- `challenges[X].clueGiverId` = team X's clue-giver
- `setupStatus[X]` = readiness of challenge FOR team X
- State is in-memory only — no persistence

### Key Patterns
- **Role-based emissions**: server sends different data to clue-giver vs guessers vs opposing team (word masking)
- **Immediate reassignment**: both TM and host are reassigned instantly on disconnect (120s grace period for full removal)
- **Round archiving**: `Room.archiveCurrentRound()` snapshots challenge data after CLUING_B before it's wiped by `advanceToNextRound()`
- **Host-gated actions**: `game:start`, `round:next`, `game:play-again` require `room.hostId === playerId`

### Socket Events (key ones)
- `setup:confirm` / `setup:unconfirm` — TM locks/unlocks their challenge
- `clue:begin` — clue-giver starts timer
- `clue:end-turn` — clue-giver ends early (unresolved cards = missed)
- `round:ended` — includes `roundHistory` for the history panel
- `room:host-updated` — immediate host reassignment on disconnect

## Style Guide

- Dark glassmorphism theme: `glass-card`, team colors (blue A / red B), accent amber
- `font-display` (Righteous) for headings, DM Sans for body
- Tailwind + custom CSS classes in `index.css` (`btn-primary`, `btn-success`, `btn-team-a`, `btn-team-b`, `buzz-btn`, `game-input`)
- Mobile-first — this is a phone party game

## Gotchas

- `confirmChallenge(forTeam)` validates the challenge FOR the opposing team — don't add own-team checks there (own-team CG is validated in the handler)
- When writing JSX via Python/SSH scripts, `\uXXXX` in JS string literals (`{'...\u2713...'}`) works, but in JSX template text it renders as literal text — use HTML entities (`&times;`) or JS expressions instead
- `setupStatus[myTeam]` = challenge created BY the other team FOR me; `setupStatus[opposingTeam]` = challenge I'm creating FOR them
