# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Run server (:4040) + client (:5173) concurrently
npm run dev:server       # Server only (tsx watch)
npm run dev:client       # Client only (Vite)
npm run build            # Build both client + server
npm start                # Run production server
npm test                 # Server unit tests (Vitest, runs in server/)
npm run lint             # ESLint across client + server
npm run typecheck        # tsc --noEmit in both client + server
npm run format           # Prettier auto-format
npm run format:check     # Check formatting without writing
```

Run a single test file: `cd server && npx vitest run src/game/Room.test.ts`

## Architecture

Real-time multiplayer party game (Adversarial Taboo). Two-package structure: `client/` (React SPA) and `server/` (Node.js + Socket.IO).

### Server (`server/src/`)

- **`game/Room.ts`** — Core state machine. Manages game phases: LOBBY → PARALLEL_SETUP → CLUING_A → CLUING_B → ROUND_RESULT → GAME_OVER. Contains all game logic (scoring, turn management, round archiving). This is the single source of truth for game state.
- **`game/RoomManager.ts`** — Room lifecycle: creation, lookup, cleanup (30min inactive timeout), JSON persistence to `/data/rooms.json` with atomic writes and crash recovery.
- **`socket/`** — Handler modules split by concern: `lobbyHandlers.ts`, `setupHandlers.ts`, `gameHandlers.ts`, `connectionHandlers.ts`. All receive a `SocketContext` (dependency injection of io, socket, rooms, playerId).
- **`socket/handlers.ts`** — Orchestrator that registers all handler modules on socket connection.
- **`words/`** — Pluggable `WordProvider` interface. Active provider fetches from randomwordgenerator.com with a fallback word list.

### Client (`client/src/`)

- **`store.ts`** — Zustand store holding all game state. Exposes computed hooks (`useMyRole`, `useMyTeam`) as selectors.
- **`socketListeners.ts`** — All Socket.IO event handlers that dispatch to the Zustand store.
- **`socket.ts`** — Socket.IO client instance with auto-reconnect and session restore from localStorage.
- **`App.tsx`** — Phase-based screen router. Renders the appropriate component based on `phase` from the store.
- **`components/`** — One component per game screen/phase. Use Tailwind CSS + Framer Motion for styling/animation.

### Key patterns

- **Adding a socket event**: Define handler in the appropriate `socket/*.ts` module → register in `handlers.ts` → add listener in `socketListeners.ts` → update Zustand store → consume in component.
- **Session persistence**: Client stores `{ roomCode, playerId, playerName }` in localStorage under `adtaboo_session`. On reconnect, state is restored within a 120-second grace period.
- **Room serialization**: `Room.toDTO()` produces the client-facing shape. `buildGameState(room)` extracts active game data for socket emission.
- **Scoring**: +3 correct, -1 buzz, 0 missed.
- **Room codes**: 4-char alphanumeric, excluding ambiguous characters (0/O/1/I/L).

## Code Style

- TypeScript strict mode in both packages
- Prettier: single quotes, trailing commas, 120 char width, 2 spaces
- ESLint: unused vars warn (allow `_` prefix), `any` warn
- Components: PascalCase, default exports
- Team IDs: literal `'A' | 'B'`
