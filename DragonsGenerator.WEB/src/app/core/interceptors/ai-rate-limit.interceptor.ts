import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AiRateLimitDialogService } from '@core/services/ai-rate-limit-dialog.service';
import { isAiGenerationRequest, isAiRateLimitHttpError } from '@core/utils/ai-rate-limit.util';

/** Ouvre le dialogue limite IA sur 429 sans bruit console — les composants ignorent ces erreurs. */
export const aiRateLimitInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isAiGenerationRequest(req.url)) {
    return next(req);
  }

  const aiRateLimit = inject(AiRateLimitDialogService);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (isAiRateLimitHttpError(err)) {
        aiRateLimit.handleHttpError(err);
        return throwError(() => err);
      }
      return throwError(() => err);
    }),
  );
};
