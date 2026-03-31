# Adversarial Taboo

A real-time multiplayer party game where teams take turns giving clues while the opposing team sets the forbidden words. Unlike classic Taboo where taboo words come on printed cards, in Adversarial Taboo the opposing team *chooses* which words are forbidden — making every round a strategic battle.

## How to Play

1. **Create a room** and share the link or 4-letter code with friends
2. **Split into two teams** (2+ players each) and assign a **Taboo Master** per team
3. Each round has a **parallel setup** phase where both teams work simultaneously:
   - Each Taboo Master sees the 5 words the opposing team will clue
   - They set up to 20 taboo words the opposing clue-giver can't say
   - They also pick their own team's clue-giver
   - Both TMs lock in when ready
4. Teams then clue in order (Team A, then Team B):
   - The clue-giver describes all 5 words (in any order) without saying the taboo words
   - Teammates guess based on the clues
   - The opposing Taboo Master buzzes when taboo words are spoken
   - The clue-giver can end their turn early if they're stuck
5. After both teams clue, the round ends and scores are shown
6. The game repeats for the configured number of rounds

### Scoring
- **+3** per word correctly guessed
- **-1** per taboo violation (buzz)
- **0** for words not guessed before time runs out

### In-Game Features
- **Help button** (?) — Available on every screen, explains the game and roles
- **Round history** (clock icon) — Review completed rounds: words clued, taboo words, buzzes, and score breakdowns per team
- **Reconnection** — Players who disconnect can rejoin with the same name; game state is fully restored
- **Host & TM resilience** — Both host and Taboo Master are immediately reassigned if a player disconnects
- **Taboo Master reassignment** — Can be changed mid-game via the expandable roster in the score bar

## Tech Stack

- **Frontend**: React 18 + Vite + Zustand + Tailwind CSS
- **Backend**: Node.js + Express + Socket.IO
- **Word Source**: randomwordgenerator.com (pluggable provider interface)
- **Deployment**: Docker

## Development

```bash
# Install dependencies
npm install
cd server && npm install
cd ../client && npm install
cd ..

# Run development servers (client on :5173, server on :4040)
npm run dev
```

The client proxies Socket.IO connections to the server via Vite's dev proxy.

### Testing

```bash
npm test             # Run server unit tests (Vitest)
```

Server-side tests cover the Room state machine (player management, game flow, scoring, serialization) and RoomManager (room lifecycle, persistence, player tracking).

### Linting & Formatting

```bash
npm run lint         # ESLint across client + server
npm run typecheck    # TypeScript type checking
npm run format       # Auto-format with Prettier
npm run format:check # Check formatting without writing
```

### CI/CD

GitHub Actions runs on every push and pull request:
- Lint + type check + unit tests
- Docker image build verification

## Docker Deployment

```bash
docker compose up -d --build
```

Builds a multi-stage Docker image (client build + server build + production runtime) and runs on port 4040.

## Configuration

Game settings are configurable by the host in the lobby:

| Setting | Default | Range |
|---------|---------|-------|
| Rounds | 3 | 1-5 |
| Timer (seconds) | 60 | 10-600 |
| Words per turn | 5 | 1-10 |
| Max taboo words | 20 | 5-30 |

## Environment Variables

Configure via `.env` file (see `.env.example`):

| Variable | Required | Purpose |
|----------|----------|---------|
| `METRICS_TOKEN` | Yes | Bearer token for `/api/metrics` endpoint |
| `GA_MEASUREMENT_ID` | No | Google Analytics measurement ID (build-time) |

## State Persistence

Game state is persisted to `/data/rooms.json` (Docker volume) and survives container restarts:

- **Periodic snapshots** every 60 seconds
- **Graceful shutdown** saves on SIGTERM/SIGINT (30s grace period)
- **Crash recovery** saves on uncaught exceptions/unhandled rejections
- **Atomic writes** via temp file + rename to prevent corruption
- **Fallback restore** from `.tmp` file if primary is corrupt

On restart, rooms are restored with all players marked as disconnected. Socket.IO auto-reconnects clients, who rejoin seamlessly. Active cluing timers are reconstructed from persisted timestamps.

## Metrics

The server collects usage metrics persisted to `/data/metrics.json` (Docker volume) and exposed via API:

```bash
# All-time stats
curl -H "Authorization: Bearer $METRICS_TOKEN" http://localhost:4040/api/metrics

# Last 7 days
curl -H "Authorization: Bearer $METRICS_TOKEN" "http://localhost:4040/api/metrics?days=7"
```

**Counters**: rooms created, players joined, games started, games completed (daily bucketed, 30-day retention)

**Gauges**: active WebSocket connections, players in rooms, active rooms

## Google Analytics

Optional analytics via Google Analytics 4. Set `GA_MEASUREMENT_ID` in `.env` before building. A custom dimension `game_name: 'adversarial-taboo'` is sent with all events. Self-disables if the ID is absent.

## Project Structure

```
adversarial-taboo/
├── .github/workflows/ci.yml  # CI: lint, typecheck, test, Docker build
├── server/                    # Node.js + Socket.IO backend
│   └── src/
│       ├── index.ts           # Express + Socket.IO entry point
│       ├── logger.ts          # Structured JSON logging
│       ├── metrics.ts         # Usage metrics with JSON persistence
│       ├── game/
│       │   ├── types.ts       # Shared type definitions
│       │   ├── Room.ts        # Room state machine, game logic, round archiving
│       │   ├── Room.test.ts   # Room unit tests (Vitest)
│       │   ├── RoomManager.ts # Room lifecycle management
│       │   └── RoomManager.test.ts # RoomManager unit tests (Vitest)
│       ├── words/
│       │   ├── WordProvider.ts    # Provider interface + fallback word list wrapper
│       │   ├── charades.ts        # randomwordgenerator.com provider (active)
│       │   ├── randomWordApi.ts   # random-word-api.herokuapp.com (reference)
│       │   └── index.ts          # Configured export (charades, difficulty 3)
│       └── socket/
│           ├── handlers.ts    # Socket.IO handler orchestrator
│           ├── context.ts     # Shared handler context + reconnect state builder
│           ├── lobbyHandlers.ts   # Room create/join, teams, settings, game start
│           ├── setupHandlers.ts   # Parallel setup: taboo words, clue-giver, lock-in
│           ├── gameHandlers.ts    # Cluing, scoring, buzzes, turn/round transitions
│           └── connectionHandlers.ts  # Disconnect/reconnect with 120s grace period
├── client/                    # React + Vite frontend
│   └── src/
│       ├── App.tsx            # Phase-based screen routing
│       ├── store.ts           # Zustand game store + reactive hooks
│       ├── socket.ts          # Socket.IO client
│       ├── socketListeners.ts # All socket event handlers + reconnect state restore
│       ├── constants.ts       # Shared constants (session key)
│       └── components/
│           ├── HomeScreen.tsx          # Create/join room
│           ├── LobbyScreen.tsx         # Team assignment + settings
│           ├── ParallelSetupScreen.tsx # Both TMs set up challenges simultaneously
│           ├── ClueGiverScreen.tsx     # Word cards + Got It/End Turn buttons
│           ├── GuesserScreen.tsx       # Guess interface
│           ├── TabooWatcherScreen.tsx  # Taboo master buzzer + watcher view
│           ├── ScoringScreen.tsx       # Round results
│           ├── GameOverScreen.tsx      # Final scores + play again
│           ├── ScoreBoard.tsx          # Top bar: scores, roster, history button
│           ├── HistoryPanel.tsx        # Round-by-round history overlay
│           ├── HelpModal.tsx           # How-to-play overlay
│           └── Timer.tsx              # Countdown display
├── eslint.config.js           # ESLint flat config (TypeScript)
├── .prettierrc                # Prettier config
├── Dockerfile                 # 3-stage build (client → server → production)
├── docker-compose.yml
├── .env.example               # Template for environment variables
└── data/                      # Docker volume (gitignored)
    ├── rooms.json             # Persisted game state
    └── metrics.json           # Usage metrics
```
