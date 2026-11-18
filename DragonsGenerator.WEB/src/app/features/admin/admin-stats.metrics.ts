import { adminRamPercent, formatAdminDuration } from './admin-stats.format';
import type { AdminStats } from './admin.types';

export function adminRamUsed(s: AdminStats): number {
  return s.server.containerMemoryBytes ?? s.server.workingSetBytes;
}

export function adminRamLimit(s: AdminStats): number | null {
  return s.server.containerMemoryLimitBytes;
}

export function adminRamPct(s: AdminStats): number | null {
  return adminRamPercent(adminRamUsed(s), adminRamLimit(s));
}

export function adminVpsRamUsed(s: AdminStats): number | null {
  const total = s.server.hostMemoryTotalBytes;
  const available = s.server.hostMemoryAvailableBytes;
  if (total == null || available == null) return null;
  return Math.max(0, total - available);
}

export function adminVpsRamPct(s: AdminStats): number | null {
  return adminRamPercent(adminVpsRamUsed(s), s.server.hostMemoryTotalBytes);
}

export function adminDiskUsed(s: AdminStats): number | null {
  const total = s.server.hostDiskTotalBytes;
  const free = s.server.hostDiskAvailableBytes;
  if (total == null || free == null) return null;
  return Math.max(0, total - free);
}

export function adminDiskPct(s: AdminStats): number | null {
  return adminRamPercent(adminDiskUsed(s), s.server.hostDiskTotalBytes);
}

export function adminOldestWaitingLabel(hours: number | null): string {
  if (hours == null) return '—';
  return formatAdminDuration(hours * 3600);
}

export function adminHttpStatusTone(status: number): string {
  if (status >= 500) return 'text-red-400';
  if (status >= 400) return 'text-amber-400';
  return 'text-emerald-400';
}
