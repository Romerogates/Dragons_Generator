import { Injectable, signal } from '@angular/core';

/** Ticket conversation plein écran : masque navbar/footer (stacking sous le chrome). */
@Injectable({ providedIn: 'root' })
export class SupportOverlayService {
  readonly open = signal(false);
}
