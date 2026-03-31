# Adversarial Taboo

A real-time multiplayer party game where teams take turns giving clues while the opposing team sets the forbidden words. Unlike classic Taboo where taboo words come on printed cards, in Adversarial Taboo the opposing team *chooses* which words are forbidden — making every round a strategic battle.

## How to Play

1. **Create a room** and share the link or 4-letter code with friends
2. **Split into two teams** (2+ players each) and assign a **Taboo Master** per team
3. Each round:
   - The active team's Taboo Master picks a clue-giver
   - 5 random words are drawn from an API
   - The opposing team sees the words and sets up to 20 shared taboo words
   - The clue-giver describes all 5 words (in any order) without saying the taboo words
   - The opposing Taboo Master buzzes when taboo words are spoken

### Scoring
- **+3** per word correctly guessed
- **-1** per taboo violation (buzz)
- **0** for words not guessed before time runs out

## Tech Stack

- **Frontend**: React + Vite + Zustand + Tailwind CSS
- **Backend**: Node.js + Express + Socket.IO
- **Deployment**: Docker + Cloudflare Tunnel

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

## Docker Deployment

```bash
docker compose up -d --build
```

This builds a multi-stage Docker image (client build + server build + production runtime) and runs on port 4040.

## Configuration

Game settings are configurable by the host in the lobby:

| Setting | Default | Range |
|---------|---------|-------|
| Rounds | 3 | 1-5 |
| Timer (seconds) | 60 | 10-600 |
| Words per turn | 5 | 1-10 |
| Max taboo words | 20 | 5-30 |

## Project Structure

```
adversarial-taboo/
├── server/                    # Node.js + Socket.IO backend
│   └── src/
│       ├── index.ts           # Express + Socket.IO entry point
│       ├── game/
│       │   ├── types.ts       # Shared type definitions
│       │   ├── Room.ts        # Room state machine + game logic
│       │   └── RoomManager.ts # Room lifecycle management
│       └── socket/
│           ├── handlers.ts    # Socket.IO handler orchestrator
│           ├── context.ts     # Shared handler context
│           ├── lobbyHandlers.ts
│           ├── gameHandlers.ts
│           └── connectionHandlers.ts
├── client/                    # React + Vite frontend
│   └── src/
│       ├── App.tsx            # Phase-based screen routing
│       ├── store.ts           # Zustand game store + hooks
│       ├── socket.ts          # Socket.IO client
│       ├── socketListeners.ts # All socket event handlers
│       └── components/        # Screen components per game phase
├── Dockerfile                 # Multi-stage production build
└── docker-compose.yml
```
