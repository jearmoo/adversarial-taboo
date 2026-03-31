import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { logger } from './logger';

interface DailyBucket {
  rooms: number;
  games: number;
  gamesCompleted: number;
  players: number;
}

interface MetricsData {
  totals: {
    roomsCreated: number;
    gamesStarted: number;
    gamesCompleted: number;
    playersJoined: number;
  };
  daily: Record<string, DailyBucket>;
}

function emptyBucket(): DailyBucket {
  return { rooms: 0, games: 0, gamesCompleted: 0, players: 0 };
}

function defaultMetrics(): MetricsData {
  return {
    totals: { roomsCreated: 0, gamesStarted: 0, gamesCompleted: 0, playersJoined: 0 },
    daily: {},
  };
}

class MetricsCollector {
  private data: MetricsData;
  private readonly path: string;
  private flushInterval: ReturnType<typeof setInterval>;

  // Gauges (not persisted — reflect live state)
  activePlayers = 0;
  activeRooms = 0;

  constructor(filePath: string) {
    this.path = filePath;
    this.data = this.load();
    this.flushInterval = setInterval(() => this.flush(), 60_000);
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private ensureDay(): DailyBucket {
    const d = this.today();
    if (!this.data.daily[d]) this.data.daily[d] = emptyBucket();
    return this.data.daily[d];
  }

  roomCreated(): void {
    this.data.totals.roomsCreated++;
    this.ensureDay().rooms++;
    this.activeRooms++;
  }

  roomClosed(): void {
    this.activeRooms = Math.max(0, this.activeRooms - 1);
  }

  gameStarted(): void {
    this.data.totals.gamesStarted++;
    this.ensureDay().games++;
  }

  gameCompleted(): void {
    this.data.totals.gamesCompleted++;
    this.ensureDay().gamesCompleted++;
  }

  playerJoined(): void {
    this.data.totals.playersJoined++;
    this.ensureDay().players++;
  }

  playerConnected(): void {
    this.activePlayers++;
  }

  playerDisconnected(): void {
    this.activePlayers = Math.max(0, this.activePlayers - 1);
  }

  getStats(days?: number): object {
    if (!days) {
      return {
        totals: { ...this.data.totals },
        gauges: { activePlayers: this.activePlayers, activeRooms: this.activeRooms },
        daily: { ...this.data.daily },
      };
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const filtered: Record<string, DailyBucket> = {};
    const agg = emptyBucket();

    for (const [date, bucket] of Object.entries(this.data.daily)) {
      if (date >= cutoffStr) {
        filtered[date] = bucket;
        agg.rooms += bucket.rooms;
        agg.games += bucket.games;
        agg.gamesCompleted += bucket.gamesCompleted;
        agg.players += bucket.players;
      }
    }

    return {
      period: { days, from: cutoffStr, to: this.today() },
      aggregated: agg,
      gauges: { activePlayers: this.activePlayers, activeRooms: this.activeRooms },
      daily: filtered,
    };
  }

  private load(): MetricsData {
    try {
      if (existsSync(this.path)) {
        const raw = readFileSync(this.path, 'utf-8');
        const parsed = JSON.parse(raw);
        logger.info('metrics', 'Loaded metrics from disk', {
          roomsCreated: parsed.totals?.roomsCreated,
          gamesStarted: parsed.totals?.gamesStarted,
        });
        return { ...defaultMetrics(), ...parsed };
      }
    } catch (err) {
      logger.error('metrics', 'Failed to load metrics file, starting fresh', { error: String(err) });
    }
    return defaultMetrics();
  }

  flush(): void {
    try {
      const dir = dirname(this.path);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(this.path, JSON.stringify(this.data, null, 2));
    } catch (err) {
      logger.error('metrics', 'Failed to flush metrics to disk', { error: String(err) });
    }
  }

  destroy(): void {
    clearInterval(this.flushInterval);
    this.flush();
  }
}

export const metrics = new MetricsCollector(
  process.env.METRICS_PATH || '/data/metrics.json',
);
