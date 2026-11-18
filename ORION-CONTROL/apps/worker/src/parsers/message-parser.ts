/**
 * Discord response parser.
 *
 * Supported shapes, in priority order:
 *   1. A JSON payload (raw or in a ```json fence) containing `servers` or
 *      `players`. This is the recommended contract for a relay integration.
 *   2. Pipe-separated server rows:  Name | Region | online | 42/64 | 3 | 28ms
 *   3. Key/value summary lines:     Players online: 148
 *   4. Pipe-separated player rows:  Name | PC | Elite | online
 *
 * Anything that cannot be recognised throws UNPARSED_RESPONSE. ORION CONTROL
 * never fills the gaps with invented values; the raw response is preserved so
 * the operator can adapt the parser or the integration.
 */

import type {
  MatchSnapshot,
  PlayerDirectorySnapshot,
  PlayerSnapshot,
  PlayerStatus,
  ServerSnapshot,
  StatisticsSnapshot,
} from '@orion/shared';
import {
  playerDirectorySnapshotSchema,
  statisticsSnapshotSchema,
  summarizeServers,
} from '@orion/shared';
import { slugify } from '../util.js';
import { IntegrationError } from '../integrations/types.js';

export interface FlattenedEmbed {
  title: string;
  description: string;
  fields: Array<{ name: string; value: string }>;
  footer: string;
}

export interface FlattenedMessage {
  content: string;
  embeds: FlattenedEmbed[];
  attachments: string[];
  authorTag: string;
  authorId: string;
  createdAt: string;
}

export function flattenText(message: FlattenedMessage): string {
  const parts: string[] = [message.content];
  for (const embed of message.embeds) {
    if (embed.title) parts.push(embed.title);
    if (embed.description) parts.push(embed.description);
    for (const field of embed.fields) parts.push(`${field.name}: ${field.value}`);
    if (embed.footer) parts.push(embed.footer);
  }
  return parts.filter((part) => part.trim().length > 0).join('\n');
}

export function rawResponseJson(message: FlattenedMessage): string {
  return JSON.stringify(message, null, 2);
}

function parseCount(raw: string | undefined): number | null {
  if (!raw) return null;
  const match = /(\d[\d,]*)/.exec(raw);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000) return null;
  return Math.round(value);
}

function extractJsonCandidate(text: string): unknown | null {
  const candidates: string[] = [];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = fenced.exec(text)) !== null) {
    if (match[1]) candidates.push(match[1].trim());
  }
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) candidates.push(trimmed);
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(text.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function statusFromText(value: string): ServerSnapshot['status'] | null {
  const normalized = value.trim().toLowerCase();
  if (['online', 'up', 'operational', 'healthy'].includes(normalized)) return 'online';
  if (['degraded', 'warning', 'unstable', 'lagging'].includes(normalized)) return 'degraded';
  if (['offline', 'down', 'unavailable'].includes(normalized)) return 'offline';
  return null;
}

function playerStatusFromText(value: string | undefined): PlayerStatus {
  const normalized = (value ?? '').trim().toLowerCase();
  if (['in-match', 'in match', 'playing', 'ingame', 'in_game'].includes(normalized)) return 'in-match';
  if (['online', 'active', 'connected'].includes(normalized)) return 'online';
  return 'offline';
}

function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('```'));
}

function parseServerRows(text: string): ServerSnapshot[] {
  const servers: ServerSnapshot[] = [];
  const seen = new Set<string>();

  for (const line of splitLines(text)) {
    if (!line.includes('|')) continue;
    const segments = line.split('|').map((segment) => segment.trim());
    if (segments.length < 4) continue;

    const [name, region, statusRaw, population, matchesRaw, latencyRaw] = segments;
    if (!name || !statusRaw || !population) continue;
    const status = statusFromText(statusRaw);
    if (!status) continue;

    const capacityMatch = /^(\d[\d,]*)\s*\/\s*(\d[\d,]*)$/.exec(population);
    const playersOnline = capacityMatch ? parseCount(capacityMatch[1]) : parseCount(population);
    const maxPlayers = capacityMatch ? parseCount(capacityMatch[2]) : null;
    if (playersOnline === null || maxPlayers === null) continue;

    const id = slugify(name);
    if (seen.has(id)) continue;
    seen.add(id);

    const latency = latencyRaw ? parseCount(latencyRaw) : null;
    servers.push({
      id,
      name,
      region: region && region.length > 0 ? region : 'Unknown',
      status,
      playersOnline,
      maxPlayers,
      activeMatches: parseCount(matchesRaw) ?? 0,
      ...(latency !== null ? { latencyMs: latency } : {}),
    });
  }

  return servers;
}

function parseSummaryFields(text: string): {
  playersOnline: number | null;
  activeMatches: number | null;
  activeServers: number | null;
  totalServers: number | null;
  healthScore: number | null;
} {
  const players = /players?\s*(?:online|count)?\s*[:=]\s*([\d,]+)/i.exec(text);
  const matches = /(?:active\s*)?matches?\s*[:=]\s*([\d,]+)/i.exec(text);
  const servers = /(?:active\s*)?servers?\s*[:=]\s*([\d,]+)(?:\s*\/\s*(\d+))?/i.exec(text);
  const health = /health(?:\s*score)?\s*[:=]\s*([\d.]+)\s*%?/i.exec(text);

  return {
    playersOnline: parseCount(players?.[1]),
    activeMatches: parseCount(matches?.[1]),
    activeServers: parseCount(servers?.[1]),
    totalServers: parseCount(servers?.[2] ?? servers?.[1]),
    healthScore: health?.[1] ? Math.max(0, Math.min(100, Math.round(Number(health[1])))) : null,
  };
}

function parseMatchRows(text: string): MatchSnapshot[] {
  const matches: MatchSnapshot[] = [];
  for (const line of splitLines(text)) {
    if (!line.includes('|')) continue;
    const segments = line.split('|').map((segment) => segment.trim());
    // Matches only when the row is explicitly prefixed with "match".
    if (segments.length < 4 || !/^match\b/i.test(segments[0] ?? '')) continue;
    const [, mode, map, playersRaw, statusRaw] = segments;
    const population = parseCount(playersRaw);
    if (!mode || population === null) continue;
    matches.push({
      id: `${slugify(mode)}-${matches.length + 1}`,
      serverId: 'unknown',
      mode,
      ...(map ? { map } : {}),
      players: population,
      maxPlayers: 24,
      startedAt: new Date().toISOString(),
      status: /live/i.test(statusRaw ?? '') ? 'live' : /lobby/i.test(statusRaw ?? '') ? 'lobby' : 'finished',
    });
  }
  return matches;
}

export function parseStatisticsResponse(message: FlattenedMessage): {
  snapshot: StatisticsSnapshot;
  warnings: string[];
} {
  const text = flattenText(message);
  const retrievedAt = new Date().toISOString();
  const json = extractJsonCandidate(text);

  if (json && typeof json === 'object' && 'servers' in json) {
    const candidate = json as Record<string, unknown>;
    const servers = Array.isArray(candidate.servers) ? candidate.servers : [];
    const parsed = statisticsSnapshotSchema.safeParse({
      ...candidate,
      source: 'retrieved',
      retrievedAt,
      summary:
        candidate.summary ??
        summarizeServers(servers as ServerSnapshot[]),
      matches: candidate.matches ?? [],
      players: candidate.players ?? [],
      warnings: Array.isArray(candidate.warnings) ? candidate.warnings : [],
    });
    if (parsed.success) {
      return { snapshot: parsed.data, warnings: parsed.data.warnings };
    }
    throw new IntegrationError(
      'The JSON response did not match the statistics schema. Check the relay payload documented in docs/DISCORD.md.',
      'INVALID_JSON_PAYLOAD',
      false,
      rawResponseJson(message),
    );
  }

  const servers = parseServerRows(text);
  if (servers.length > 0) {
    const summary = summarizeServers(servers);
    return {
      snapshot: {
        source: 'retrieved',
        retrievedAt,
        summary,
        servers,
        matches: parseMatchRows(text),
        players: [],
        notes: `Parsed ${servers.length} server row(s) from a response by ${message.authorTag}.`,
        warnings: [],
      },
      warnings: [],
    };
  }

  const summaryFields = parseSummaryFields(text);
  if (summaryFields.playersOnline !== null || summaryFields.activeMatches !== null) {
    const snapshot: StatisticsSnapshot = {
      source: 'retrieved',
      retrievedAt,
      summary: {
        playersOnline: summaryFields.playersOnline ?? 0,
        activeMatches: summaryFields.activeMatches ?? 0,
        activeServers: summaryFields.activeServers ?? 0,
        totalServers: summaryFields.totalServers ?? 0,
        healthScore: summaryFields.healthScore ?? 0,
      },
      servers: [],
      matches: [],
      players: [],
      notes: `Summary-only response parsed from ${message.authorTag}. No per-server rows were present.`,
      warnings: [
        'The response contained totals only, so no per-server detail is available.',
        ...(summaryFields.healthScore === null
          ? ['No health score was reported; it is shown as 0%.']
          : []),
      ],
    };
    return { snapshot, warnings: snapshot.warnings };
  }

  throw new IntegrationError(
    'The response could not be parsed. Supported formats are documented in docs/DISCORD.md — a JSON payload, pipe-separated server rows, or key/value summary lines.',
    'UNPARSED_RESPONSE',
    false,
    rawResponseJson(message),
  );
}

export function parsePlayerDirectoryResponse(message: FlattenedMessage): {
  directory: PlayerDirectorySnapshot;
  warnings: string[];
} {
  const text = flattenText(message);
  const retrievedAt = new Date().toISOString();
  const json = extractJsonCandidate(text);

  if (json && typeof json === 'object' && 'players' in json) {
    const candidate = json as Record<string, unknown>;
    const parsed = playerDirectorySnapshotSchema.safeParse({
      ...candidate,
      source: 'retrieved',
      retrievedAt,
    });
    if (parsed.success) {
      return { directory: parsed.data, warnings: parsed.data.notes ? [parsed.data.notes] : [] };
    }
    throw new IntegrationError(
      'The JSON player directory did not match the expected schema.',
      'INVALID_JSON_PAYLOAD',
      false,
      rawResponseJson(message),
    );
  }

  const players: PlayerSnapshot[] = [];
  const seen = new Set<string>();
  let withoutStatus = 0;

  for (const line of splitLines(text)) {
    if (!line.includes('|')) continue;
    const segments = line.split('|').map((segment) => segment.trim());
    const [name, platform, rank, statusRaw] = segments;
    if (!name || name.length > 120) continue;
    if (segments.length < 2) continue;
    const externalId = slugify(name);
    if (seen.has(externalId)) continue;
    seen.add(externalId);
    if (!statusRaw) withoutStatus += 1;
    players.push({
      externalId,
      displayName: name,
      ...(platform && platform.length <= 60 ? { platform } : {}),
      ...(rank && rank.length <= 60 ? { rank } : {}),
      status: playerStatusFromText(statusRaw),
      lastSeenAt: retrievedAt,
    });
  }

  if (players.length === 0) {
    throw new IntegrationError(
      'No player rows were recognised. Provide a JSON payload or rows like "Name | PC | Elite | online".',
      'UNPARSED_RESPONSE',
      false,
      rawResponseJson(message),
    );
  }

  const warnings: string[] = [];
  if (withoutStatus > 0) {
    warnings.push(
      `${withoutStatus} player row(s) had no status column and were recorded as offline.`,
    );
  }

  return {
    directory: {
      source: 'retrieved',
      retrievedAt,
      players,
      notes: `Parsed ${players.length} player row(s) from a response by ${message.authorTag}.`,
    },
    warnings,
  };
}
