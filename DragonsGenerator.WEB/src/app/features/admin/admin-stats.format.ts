export function formatAdminBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${Math.round(bytes)} o`;
  const units = ['Ko', 'Mo', 'Go', 'To'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  const rounded = Math.round(value * 10) / 10;
  const digits = Number.isInteger(rounded) || rounded >= 10 ? 0 : 1;
  return `${rounded.toFixed(digits)}\u00a0${units[i]}`;
}

export function formatAdminDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—';
  const s = Math.floor(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} j ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}

export function formatAdminCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('fr-FR').format(Math.round(n));
}

export function adminRamPercent(
  used: number | null | undefined,
  limit: number | null | undefined,
): number | null {
  if (used == null || limit == null || limit <= 0) return null;
  return Math.min(100, Math.round((used / limit) * 100));
}
