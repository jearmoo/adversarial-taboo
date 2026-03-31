import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs';
import { Room } from './Room';
import { GamePhase, TeamId } from './types';
import { logger } from '../logger';

const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
const CODE_LENGTH = 4;
const STALE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private playerToRoom: Map<string, string> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
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
      writeFileSync(filePath, JSON.stringify(data, null, 2));
      logger.info('rooms', 'Saved room state to disk', { rooms: data.length });
    } catch (err) {
      logger.error('rooms', 'Failed to save room state', { error: String(err) });
    }
  }

  restore(
    filePath: string,
    onTimerExpired: (room: Room, team: 'A' | 'B') => void,
  ): void {
    try {
      if (!existsSync(filePath)) return;
      const raw = readFileSync(filePath, 'utf-8');
      const entries = JSON.parse(raw);
      if (!Array.isArray(entries)) return;

      for (const entry of entries) {
        const room = Room.fromJSON(entry);
        this.rooms.set(room.code, room);

        // Rebuild playerToRoom
        for (const [pid] of room.players) {
          this.playerToRoom.set(pid, room.code);
        }

        // Restore active timers
        const cluingTeam = room.getCluingTeam();
        if (cluingTeam && room.game?.timerEnd) {
          const remaining = room.game.timerEnd - Date.now();
          if (remaining > 0) {
            room.restoreTimer(remaining, () => onTimerExpired(room, cluingTeam));
          } else {
            // Timer expired during downtime — end the turn immediately
            onTimerExpired(room, cluingTeam);
          }
        }
      }

      logger.info('rooms', 'Restored room state from disk', {
        rooms: entries.length,
        players: this.playerToRoom.size,
      });

      unlinkSync(filePath);
    } catch (err) {
      logger.error('rooms', 'Failed to restore room state', { error: String(err) });
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}
