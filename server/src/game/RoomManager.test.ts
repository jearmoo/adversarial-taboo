import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RoomManager } from './RoomManager';
import { writeFileSync, existsSync, unlinkSync } from 'fs';
import path from 'path';
import os from 'os';

describe('RoomManager', () => {
  let manager: RoomManager;

  beforeEach(() => {
    manager = new RoomManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('room lifecycle', () => {
    it('creates rooms with unique codes', () => {
      const room1 = manager.createRoom('host1');
      const room2 = manager.createRoom('host2');
      expect(room1.code).not.toBe(room2.code);
      expect(manager.getRoomCount()).toBe(2);
    });

    it('retrieves rooms by code', () => {
      const room = manager.createRoom('host1');
      expect(manager.getRoom(room.code)).toBe(room);
      expect(manager.getRoom(room.code.toLowerCase())).toBe(room);
    });

    it('tracks and retrieves rooms by player', () => {
      const room = manager.createRoom('host1');
      manager.trackPlayer('host1', room.code);
      expect(manager.getRoomForPlayer('host1')).toBe(room);
    });

    it('deletes rooms and untracks players', () => {
      const room = manager.createRoom('host1');
      room.addPlayer('host1', 'Host', 'sock1');
      manager.trackPlayer('host1', room.code);

      manager.deleteRoom(room.code);
      expect(manager.getRoom(room.code)).toBeUndefined();
      expect(manager.getRoomForPlayer('host1')).toBeUndefined();
      expect(manager.getRoomCount()).toBe(0);
    });
  });

  describe('save/restore', () => {
    const tmpFile = path.join(os.tmpdir(), `test-rooms-${Date.now()}.json`);

    afterEach(() => {
      try { unlinkSync(tmpFile); } catch (_e) { /* cleanup */ }
      try { unlinkSync(tmpFile + '.tmp'); } catch (_e) { /* cleanup */ }
    });

    it('saves and restores rooms', () => {
      const room = manager.createRoom('host1');
      room.addPlayer('host1', 'Host', 'sock1');
      room.getPlayer('host1')!.team = 'A';
      manager.trackPlayer('host1', room.code);

      manager.save(tmpFile);
      expect(existsSync(tmpFile)).toBe(true);

      const manager2 = new RoomManager();
      manager2.restore(tmpFile, () => {});

      expect(manager2.getRoomCount()).toBe(1);
      expect(manager2.getPlayerCount()).toBe(1);
      const restored = manager2.getRoomForPlayer('host1');
      expect(restored?.code).toBe(room.code);
      expect(restored?.getPlayer('host1')?.name).toBe('Host');
      expect(restored?.getPlayer('host1')?.connected).toBe(false);

      manager2.destroy();
    });

    it('handles missing file gracefully', () => {
      manager.restore('/tmp/nonexistent-file.json', () => {});
      expect(manager.getRoomCount()).toBe(0);
    });

    it('falls back to .tmp file', () => {
      const room = manager.createRoom('host1');
      room.addPlayer('host1', 'Host', 'sock1');
      manager.trackPlayer('host1', room.code);

      // Write directly to .tmp
      const data = [room.toJSON()];
      writeFileSync(tmpFile + '.tmp', JSON.stringify(data, null, 2));

      const manager2 = new RoomManager();
      manager2.restore(tmpFile, () => {});
      expect(manager2.getRoomCount()).toBe(1);
      manager2.destroy();
    });
  });

  describe('player counting', () => {
    it('counts players across rooms', () => {
      const room1 = manager.createRoom('host1');
      const room2 = manager.createRoom('host2');
      manager.trackPlayer('host1', room1.code);
      manager.trackPlayer('host2', room2.code);
      manager.trackPlayer('p3', room1.code);

      expect(manager.getPlayerCount()).toBe(3);
    });

    it('untracks players', () => {
      const room = manager.createRoom('host1');
      manager.trackPlayer('host1', room.code);
      manager.untrackPlayer('host1');
      expect(manager.getRoomForPlayer('host1')).toBeUndefined();
      expect(manager.getPlayerCount()).toBe(0);
    });
  });
});
