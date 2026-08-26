import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { DataService } from '@core/services/data.service';
import { normalizeCharacterClass } from '@core/utils/class-data.adapter';
import { getClassIcon } from '@core/utils/class-icons';
import {
  GameIdLabelPipe,
  GameIdLabelsPipe,
  GameItemLabelPipe,
} from '@shared/pipes/game-id-label.pipe';

@Component({
  selector: 'app-character-class-detail',
  imports: [RouterLink, KeyValuePipe, GameIdLabelPipe, GameIdLabelsPipe, GameItemLabelPipe],
  templateUrl: './character-class-detail.html',
  styleUrl: './character-class-detail.scss',
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
}
