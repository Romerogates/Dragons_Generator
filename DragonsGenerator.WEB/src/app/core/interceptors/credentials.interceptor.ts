import { HttpInterceptorFn } from '@angular/common/http';

/** Envoie le cookie de session HttpOnly sur toutes les requêtes API. */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ withCredentials: true }));
