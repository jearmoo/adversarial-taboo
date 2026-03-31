import { Room } from './Room';

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

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}
