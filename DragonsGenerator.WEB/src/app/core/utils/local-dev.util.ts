/** True when the app runs against a local / LAN stack (not prod). */
export function isLocalDevHost(hostname?: string): boolean {
  const host =
    hostname ?? (typeof window !== 'undefined' ? window.location.hostname : undefined);
  if (!host) return false;
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.local') ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
  );
}

/** MailHog UI URL reachable from the current browser host. */
export function mailhogWebUrl(hostname?: string): string {
  const host =
    hostname ?? (typeof window !== 'undefined' ? window.location.hostname : 'localhost');
  const target = host === '127.0.0.1' ? 'localhost' : host;
  return `http://${target}:8025`;
}
