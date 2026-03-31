import { writeFileSync, readFileSync, existsSync, unlinkSync, renameSync } from 'fs';
import { Room } from './Room';
import { logger } from '../logger';

const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
const CODE_LENGTH = 4;
const STALE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private playerToRoom: Map<string, string> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval>;
  private snapshotInterval: ReturnType<typeof setInterval>;
  private snapshotPath: string | null = null;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
    this.snapshotInterval = setInterval(() => this.snapshot(), 60_000);
  }

  setSnapshotPath(path: string): void {
    this.snapshotPath = path;
  }

  private snapshot(): void {
    if (!this.snapshotPath) return;
    if (this.rooms.size > 0) {
      this.save(this.snapshotPath);
    } else if (existsSync(this.snapshotPath)) {
      try { unlinkSync(this.snapshotPath); } catch (err) {
        logger.warn('rooms', 'Failed to delete empty snapshot', { error: String(err) });
      }
    }
  }

  private generateCode(): string {
    let code: string;
    do {
      code = '';
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CHARS[Math.floor(Math.random() * CHARS.length)];
      }
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(hostId: string): Room {
    const code = this.generateCode();
    const room = new Room(code, hostId);
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  getRoomForPlayer(playerId: string): Room | undefined {
    const code = this.playerToRoom.get(playerId);
    if (!code) return undefined;
    return this.rooms.get(code);
  }

  trackPlayer(playerId: string, roomCode: string): void {
    this.playerToRoom.set(playerId, roomCode);
  }

  untrackPlayer(playerId: string): void {
    this.playerToRoom.delete(playerId);
  }

  deleteRoom(code: string): void {
    const room = this.rooms.get(code);
    if (room) {
      room.clearTimer();
      for (const [pid] of room.players) {
        this.playerToRoom.delete(pid);
      }
      this.rooms.delete(code);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (now - room.lastActivity > STALE_TIMEOUT) {
        this.deleteRoom(code);
      }
    }
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getPlayerCount(): number {
    return this.playerToRoom.size;
  }

  save(filePath: string): void {
    const data = Array.from(this.rooms.values()).map(r => r.toJSON());
    try {
      const tmp = filePath + '.tmp';
      writeFileSync(tmp, JSON.stringify(data, null, 2));
      renameSync(tmp, filePath);
      logger.info('rooms', 'Saved room state to disk', { rooms: data.length });
    } catch (err) {
      logger.error('rooms', 'Failed to save room state', { error: String(err) });
    }
  }

  restore(
    filePath: string,
    onTimerExpired: (room: Room, team: 'A' | 'B') => void,
  ): void {
    // Try main file first, fall back to .tmp if corrupt
    for (const candidate of [filePath, filePath + '.tmp']) {
      try {
        if (!existsSync(candidate)) continue;
        const raw = readFileSync(candidate, 'utf-8');
        const entries = JSON.parse(raw);
        if (!Array.isArray(entries)) continue;

        for (const entry of entries) {
          const room = Room.fromJSON(entry);
          this.rooms.set(room.code, room);

          for (const [pid] of room.players) {
            this.playerToRoom.set(pid, room.code);
          }

          const cluingTeam = room.getCluingTeam();
          if (cluingTeam && room.game?.timerEnd) {
            const remaining = room.game.timerEnd - Date.now();
            if (remaining > 0) {
              room.restoreTimer(remaining, () => onTimerExpired(room, cluingTeam));
            } else {
              // Timer expired during restart — delay to allow clients to reconnect first
              room.restoreTimer(3000, () => onTimerExpired(room, cluingTeam));
            }
          }
        }

        logger.info('rooms', 'Restored room state from disk', {
          source: candidate,
          rooms: entries.length,
          players: this.playerToRoom.size,
        });

        // Clean up both files after successful restore
        try { unlinkSync(filePath); } catch (err) {
          logger.warn('rooms', 'Failed to delete restored file', { file: filePath, error: String(err) });
        }
        try { unlinkSync(filePath + '.tmp'); } catch (err) {
          logger.warn('rooms', 'Failed to delete tmp file', { file: filePath + '.tmp', error: String(err) });
        }
        return;
      } catch (err) {
        logger.error('rooms', 'Failed to restore from file', { file: candidate, error: String(err) });
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    clearInterval(this.snapshotInterval);
  }
}
