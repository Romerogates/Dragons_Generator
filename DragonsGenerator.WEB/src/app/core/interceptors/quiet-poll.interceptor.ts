import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { EMPTY, catchError, of, throwError } from 'rxjs';

const QUIET_GET = ['/me/notifications', '/me/friends/messages'];

const EMPTY_NOTIFICATIONS = {
  friendsActionCount: 0,
  campaignsActionCount: 0,
  totalCount: 0,
  notifications: [] as unknown[],
  supportInboxCount: 0,
};

function isSupportThreadPoll(url: string): boolean {
  return url.includes('/support/tickets/') && url.includes('poll=1');
}

/** Polls dock/notifs : un API down ne doit pas exploser la console (status 0 / 502 / 504). */
export const quietPollInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET') return next(req);
  const quietList = QUIET_GET.some((p) => req.url.includes(p));
  const quietThread = isSupportThreadPoll(req.url);
  if (!quietList && !quietThread) return next(req);

  return next(req).pipe(
    catchError((err: { status?: number }) => {
      const status = err?.status ?? 0;
      if (status === 401 || status === 403) return throwError(() => err);
      if (quietThread) return EMPTY;
      const body = req.url.includes('/me/notifications') ? EMPTY_NOTIFICATIONS : [];
      return of(new HttpResponse({ status: 200, body }));
    }),
  );
};
