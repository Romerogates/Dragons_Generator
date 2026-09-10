import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { AuthService } from '@core/services/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const loginTree = () =>
    router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url || '/' } });

  if (auth.sessionReady()) {
    return auth.isLoggedIn() ? true : loginTree();
  }

  return auth.refreshMe().pipe(
    map((user) => (user ? true : loginTree())),
    catchError(() => of(loginTree())),
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
