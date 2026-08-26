import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of, timer } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

/**
 * Preloads lazy routes after a short idle delay so first paint stays snappy,
 * then subsequent navigations feel instant.
 */
@Injectable({ providedIn: 'root' })
export class IdlePreloadStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (route.data?.['preload'] === false) {
      return of(null);
    }

    // Skip giant export-only chunks if marked
    return timer(1200).pipe(mergeMap(() => load()));
  }
}
