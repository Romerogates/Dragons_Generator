import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { DataService } from '@core/services/data.service';
import { normalizeCharacterClass } from '@core/utils/class-data.adapter';
import { listSubclassOptions } from '@core/utils/character-class-features.util';
import { getClassIcon } from '@core/utils/class-icons';
import { formatClassResources, resolveFeatureNames } from '@core/utils/catalog-display.util';
import {
  GameIdLabelPipe,
  GameIdLabelsPipe,
  GameItemLabelPipe,
} from '@shared/pipes/game-id-label.pipe';

@Component({
  selector: 'app-character-class-detail',
  standalone: true,
  imports: [RouterLink, GameIdLabelPipe, GameIdLabelsPipe, GameItemLabelPipe],
  templateUrl: './character-class-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CharacterClassDetail {
  private readonly dataService = inject(DataService);

  readonly id = input.required<string>();

  private readonly id$ = toObservable(this.id);

  protected readonly cls = toSignal(
    this.id$.pipe(
      switchMap((id) => this.dataService.getClassById(id)),
      map((c) => (c ? normalizeCharacterClass(c) : null)),
    ),
    { initialValue: null },
  );

  protected iconFor(classId: string): string {
    return getClassIcon(classId);
  }

  protected resourceLines(resources: Record<string, unknown> | null | undefined) {
    return formatClassResources(resources);
  }

  protected featureNames(
    featureIds: string[] | null | undefined,
    details: { id?: string; name?: string }[] | null | undefined,
  ): string {
    return resolveFeatureNames(featureIds, details);
  }

  protected subclassOptions(cls: CharacterClass) {
    return listSubclassOptions(cls.data);
  }
}
