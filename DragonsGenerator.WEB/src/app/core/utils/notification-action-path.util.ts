/** Découpe un `actionPath` API (`/path?a=1`) pour `routerLink` Angular (qui ignore `?`). */

export interface NotificationActionLink {
  commands: string[];
  queryParams: Record<string, string>;
}

export function parseNotificationActionPath(actionPath: string | null | undefined): NotificationActionLink {
  const raw = (actionPath ?? '').trim() || '/';
  const qIndex = raw.indexOf('?');
  const pathPart = (qIndex >= 0 ? raw.slice(0, qIndex) : raw).trim() || '/';
  const queryPart = qIndex >= 0 ? raw.slice(qIndex + 1) : '';

  const segments = pathPart.split('/').filter((s) => s.length > 0);
  const commands = segments.length ? ['/', ...segments.map((s) => decodeURIComponent(s))] : ['/'];

  const queryParams: Record<string, string> = {};
  if (queryPart) {
    new URLSearchParams(queryPart).forEach((value, key) => {
      queryParams[key] = value;
    });
  }

  return { commands, queryParams };
}

export function notificationActionQueryParams(
  link: NotificationActionLink,
): Record<string, string> | null {
  return Object.keys(link.queryParams).length ? link.queryParams : null;
}
