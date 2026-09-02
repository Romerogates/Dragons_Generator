import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { AuthService } from '@core/services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.sessionReady()) {
    return auth.isLoggedIn() ? true : router.createUrlTree(['/login']);
  }

  return auth.refreshMe().pipe(
    map((user) => (user ? true : router.createUrlTree(['/login']))),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.sessionReady()) {
    return auth.isLoggedIn() && auth.isAdmin() ? true : router.createUrlTree(['/']);
  }

  return auth.refreshMe().pipe(
    map((user) => (user?.role === 'Admin' ? true : router.createUrlTree(['/']))),
    catchError(() => of(router.createUrlTree(['/']))),
  );
};
