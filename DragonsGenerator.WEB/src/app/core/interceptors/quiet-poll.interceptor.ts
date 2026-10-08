import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { catchError, of, throwError } from 'rxjs';

const QUIET_GET = ['/me/notifications', '/me/friends/messages'];

const EMPTY_NOTIFICATIONS = {
  friendsActionCount: 0,
  campaignsActionCount: 0,
  totalCount: 0,
  notifications: [] as unknown[],
};

/** Polls dock/notifs : un API down ne doit pas exploser la console (status 0 / 502 / 504). */
export const quietPollInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET' || !QUIET_GET.some((p) => req.url.includes(p))) {
    return next(req);
  }

  return next(req).pipe(
    catchError((err: { status?: number }) => {
      const status = err?.status ?? 0;
      if (status === 401 || status === 403) return throwError(() => err);
      const body = req.url.includes('/me/notifications') ? EMPTY_NOTIFICATIONS : [];
      return of(new HttpResponse({ status: 200, body }));
    }),
  );
};
