/**
 * Simulated statistics generator.
 *
 * Lives in the shared package so the website seed script and the worker's mock
 * integration produce the same shape. Everything it returns is explicitly
 * marked `source: 'simulated'` and carries a warning — the UI must always label
 * it. Never treat this as a genuine Orion Drift read-out.
 */

import type {
  MatchSnapshot,
  PlayerSnapshot,
  ServerSnapshot,
  StatisticsSnapshot,
} from './statistics.js';
import { summarizeServers } from './statistics.js';

const SERVERS: Array<{ id: string; name: string; region: string; maxPlayers: number }> = [
  { id: 'eu-aurora', name: 'Aurora Relay', region: 'EU West', maxPlayers: 64 },
  { id: 'na-vanguard', name: 'Vanguard Core', region: 'NA East', maxPlayers: 64 },
  { id: 'na-nebula', name: 'Nebula Yard', region: 'NA West', maxPlayers: 48 },
  { id: 'apac-horizon', name: 'Horizon Array', region: 'APAC', maxPlayers: 48 },
];

const MODES = ['Conquest', 'Skirmish', 'Escort', 'Onslaught'];
const MAPS = ['Meridian', 'Trenchline', 'Halcyon', 'Driftgate', 'Coldstack'];
const RANKS = ['Recruit', 'Specialist', 'Vanguard', 'Elite', 'Commander'];

const PLAYER_NAMES = [
  'NovaRider', 'PixelFoe', 'KiteRunner', 'ZeroGravity', 'IronWren', 'SableEcho',
  'CircuitFox', 'LunarMoth', 'StaticBloom', 'VoidPilot', 'CopperVale', 'NeonHeron',
  'QuasarKid', 'DriftWarden', 'MicaShift', 'OrbitHare', 'GlassComet', 'RiftRunner',
  'AshVector', 'SolarKite', 'TalonNine', 'EmberLynx', 'FrostByte', 'HaloDrift',
  'MarrowKey', 'NightRelay', 'OnyxFinch', 'PrismWolf', 'RookSignal', 'SlateHawk',
  'TundraEcho', 'UmbraFlare', 'VesperCrow', 'WraithLoom', 'XenonReed', 'YonderQuill',
];

/** Small deterministic PRNG so simulated history is stable for a given seed. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(values: readonly T[], random: () => number): T {
  const value = values[Math.floor(random() * values.length)];
  // values is never empty in this module; the fallback keeps TypeScript happy.
  return (value ?? values[0]) as T;
}

export interface SimulatedOptions {
  seed?: number;
  retrievedAt?: string;
  /** Number of simulated players to include in the directory snapshot. */
  playerCount?: number;
}

export function createSimulatedSnapshot(options: SimulatedOptions = {}): StatisticsSnapshot {
  const random = mulberry32(options.seed ?? 1_337);
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();

  const servers: ServerSnapshot[] = SERVERS.map((definition, index) => {
    const degraded = index === 2 && random() > 0.55;
    const offline = index === 3 && random() > 0.92;
    const status: ServerSnapshot['status'] = offline ? 'offline' : degraded ? 'degraded' : 'online';
    const fill = offline ? 0 : 0.45 + random() * 0.45;
    const playersOnline = Math.round(definition.maxPlayers * fill);
    const activeMatches = offline ? 0 : Math.max(1, Math.round(playersOnline / 10));
    return {
      id: definition.id,
      name: definition.name,
      region: definition.region,
      status,
      playersOnline,
      maxPlayers: definition.maxPlayers,
      activeMatches,
      latencyMs: offline ? 0 : 18 + Math.round(random() * 60),
      version: 'sim-2.4.1',
    };
  });

  const matches: MatchSnapshot[] = [];
  for (const server of servers) {
    for (let index = 0; index < server.activeMatches; index += 1) {
      matches.push({
        id: `match-${server.id}-${index + 1}`,
        serverId: server.id,
        mode: pick(MODES, random),
        map: pick(MAPS, random),
        players: 6 + Math.round(random() * 12),
        maxPlayers: 24,
        startedAt: new Date(Date.parse(retrievedAt) - Math.round(random() * 1_800_000)).toISOString(),
        status: random() > 0.85 ? 'lobby' : 'live',
      });
    }
  }

  const playerCount = Math.min(options.playerCount ?? 24, PLAYER_NAMES.length);
  const players: PlayerSnapshot[] = PLAYER_NAMES.slice(0, playerCount).map((displayName, index) => {
    const roll = random();
    const status: PlayerSnapshot['status'] = roll > 0.45 ? 'online' : roll > 0.25 ? 'in-match' : 'offline';
    return {
      externalId: `sim-player-${String(index + 1).padStart(3, '0')}`,
      displayName,
      platform: random() > 0.5 ? 'PC' : 'Console',
      rank: pick(RANKS, random),
      status,
      lastSeenAt:
        status === 'offline'
          ? new Date(Date.parse(retrievedAt) - Math.round(random() * 86_400_000)).toISOString()
          : retrievedAt,
    };
  });

  return {
    source: 'simulated',
    retrievedAt,
    summary: summarizeServers(servers),
    servers,
    matches,
    players,
    notes:
      'SIMULATED DATA — generated placeholder statistics used to exercise the dashboard and task pipeline.',
    warnings: [
      'This snapshot was produced by the simulated integration, not by Orion Drift.',
      'Configure a real Discord integration to replace it with retrieved data.',
    ],
  };
}

/**
 * Build a daily history of simulated snapshots (oldest first) for charts.
 * Uses the day index as the PRNG seed so a given day always looks the same.
 *
 * The series deliberately ends YESTERDAY: a simulated history point must never
 * be newer than a real retrieval, otherwise the seeded placeholder would rank
 * above freshly collected data on the dashboard.
 */
export function createSimulatedHistory(days = 30, now: number = Date.now()): StatisticsSnapshot[] {
  const snapshots: StatisticsSnapshot[] = [];
  const safeDays = Math.max(1, Math.min(days, 365));
  for (let offset = safeDays; offset >= 1; offset -= 1) {
    snapshots.push(
      createSimulatedSnapshot({
        seed: 9000 + offset * 37,
        retrievedAt: new Date(now - offset * 86_400_000).toISOString(),
      }),
    );
  }
  return snapshots;
}
