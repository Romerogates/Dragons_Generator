import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { DataService } from '@core/services/data.service';

@Component({
  selector: 'app-character-class-detail',
  imports: [RouterLink, KeyValuePipe],
  templateUrl: './character-class-detail.html',
  styleUrl: './character-class-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharacterClassDetail {
  private readonly dataService = inject(DataService);

  // Récupère le paramètre `id` depuis la route (withComponentInputBinding)
  readonly id = input.required<string>();

  private readonly id$ = toObservable(this.id);

  protected readonly cls = toSignal(
    this.id$.pipe(switchMap((id) => this.dataService.getClassById(id))),
    { initialValue: null },
  );
}
