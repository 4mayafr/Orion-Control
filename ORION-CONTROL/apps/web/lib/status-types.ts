import type { StatSource } from '@orion/shared';

export interface StatusResponse {
  serverTime: string;
  worker: {
    online: boolean;
    workerId: string | null;
    hostname: string | null;
    lastHeartbeatAt: string | null;
    integrationMode: string | null;
    discordConnected: boolean | null;
    offlineAfterSeconds: number;
    heartbeatAgeSeconds: number | null;
  };
  tasks: {
    queued: number;
    running: number;
    completed: number;
    failed: number;
    timed_out: number;
  };
  statistics: {
    source: StatSource;
    lastRetrievedAt: string | null;
    stale: boolean;
  };
  storage: {
    driver: string;
    label: string;
    persistent: boolean;
  };
  integration: {
    mode: string;
  };
}
