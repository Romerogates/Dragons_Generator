import {
  adminDiskPct,
  adminDiskUsed,
  adminHttpStatusTone,
  adminOldestWaitingLabel,
  adminRamPct,
  adminRamUsed,
  adminVpsRamPct,
  adminVpsRamUsed,
} from './admin-stats.metrics';
import type { AdminStats } from './admin.types';

function stats(partial: Partial<AdminStats['server']>): AdminStats {
  return {
    users: 0,
    confirmedUsers: 0,
    googleUsers: 0,
    usersLast7Days: 0,
    characters: 0,
    charactersLast7Days: 0,
    campaigns: 0,
    campaignsActive: 0,
    campaignsLast7Days: 0,
    campaignMembers: 0,
    dungeons: 0,
    dungeonsLast7Days: 0,
    friendshipsAccepted: 0,
    friendMessages: 0,
    supportTickets: 0,
    supportMessages: 0,
    guideComments: 0,
    generations: 0,
    generationsOk: 0,
    generationsLast24h: 0,
    generationsLast7Days: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    tokensLast24h: 0,
    tokensLast7Days: 0,
    generationsByKind: [],
    generationsByProvider: [],
    http: {
      requestsSinceStart: 0,
      status2xx: 0,
      status4xx: 0,
      status5xx: 0,
      inFlight: 0,
      topPaths: [],
      recent: [],
    },
    supportDesk: {
      open: 0,
      inProgress: 0,
      closed: 0,
      waitingOnStaff: 0,
      waitingOnPlayer: 0,
      oldestWaitingHours: null,
      byCategory: [],
    },
    server: {
      machineName: 'x',
      framework: '',
      osDescription: '',
      environmentName: '',
      startedAt: '',
      uptimeSeconds: 0,
      cpuProcessPercent: 0,
      threadCount: 0,
      processorCount: 0,
      workingSetBytes: 100,
      privateMemoryBytes: 0,
      gcHeapBytes: 0,
      availableMemoryBytes: null,
      containerMemoryBytes: null,
      containerMemoryLimitBytes: 200,
      hostMemoryTotalBytes: 1000,
      hostMemoryAvailableBytes: 400,
      hostDiskTotalBytes: 800,
      hostDiskAvailableBytes: 200,
      load1: null,
      load5: null,
      load15: null,
      ...partial,
    },
  };
}

describe('admin-stats.metrics', () => {
  it('calcule RAM, disque et tons HTTP', () => {
    const s = stats({});
    expect(adminRamUsed(s)).toBe(100);
    expect(adminRamPct(s)).toBe(50);
    expect(adminDiskPct(s)).toBe(75);
    expect(adminHttpStatusTone(500)).toBe('text-red-400');
    expect(adminHttpStatusTone(404)).toBe('text-amber-400');
    expect(adminHttpStatusTone(200)).toBe('text-emerald-400');
    expect(adminOldestWaitingLabel(null)).toBe('—');
    expect(adminOldestWaitingLabel(2)).toContain('h');
    expect(adminRamUsed(stats({ containerMemoryBytes: 50 }))).toBe(50);
    expect(adminVpsRamUsed(stats({ hostMemoryTotalBytes: null }))).toBeNull();
    expect(adminVpsRamUsed(stats({ hostMemoryAvailableBytes: null }))).toBeNull();
    expect(adminDiskUsed(stats({ hostDiskTotalBytes: null }))).toBeNull();
    expect(adminDiskUsed(stats({ hostDiskAvailableBytes: null }))).toBeNull();
    expect(adminVpsRamPct(s)).toBe(60);
  });
});
