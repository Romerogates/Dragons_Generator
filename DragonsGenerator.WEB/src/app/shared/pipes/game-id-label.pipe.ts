import { Pipe, PipeTransform } from '@angular/core';
import { formatGameIds, labelForGameId, labelForItemRef } from '@core/utils/game-id-labels';

/** {{ 'wp-cat-martial' | gameIdLabel }} → Armes de guerre */
@Pipe({ name: 'gameIdLabel', standalone: true, pure: true })
export class GameIdLabelPipe implements PipeTransform {
  transform(id: string | null | undefined): string {
    return labelForGameId(id);
  }
}

/** {{ armorIds | gameIdLabels }} → Armures légères, Boucliers */
@Pipe({ name: 'gameIdLabels', standalone: true, pure: true })
export class GameIdLabelsPipe implements PipeTransform {
  transform(
    ids: readonly string[] | null | undefined,
    separator = ', ',
    empty = '—',
  ): string {
    return formatGameIds(ids, separator, empty);
  }
}

/** {{ item | gameItemLabel }} avec item = { id, qty } */
@Pipe({ name: 'gameItemLabel', standalone: true, pure: true })
export class GameItemLabelPipe implements PipeTransform {
  transform(ref: { id?: string; qty?: number } | string | null | undefined): string {
    return labelForItemRef(ref);
  }
}
