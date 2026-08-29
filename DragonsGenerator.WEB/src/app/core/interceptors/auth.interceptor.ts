import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '@core/services/auth.service';

const TOKEN_KEY = 'dragons_auth_token';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = localStorage.getItem(TOKEN_KEY);
  const authedReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authedReq).pipe(
    catchError((err) => {
      if (
        err.status === 401 &&
        token &&
        !req.url.includes('/auth/login') &&
        !req.url.includes('/auth/register')
      ) {
        auth.logout(false);
      }
      return throwError(() => err);
    }),
  );
};
