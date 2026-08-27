import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { DataService } from '@core/services/data.service';
import { getCreatureCategoryLabel, getCategoryIcon } from '@core/utils/creature-display.util';

@Component({
  selector: 'app-creatures-categories',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './creatures-categories.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CreaturesCategories {
  private dataService = inject(DataService);

  protected error = signal<string | null>(null);

  protected categories = toSignal(
    this.dataService.getCreatureCategories().pipe(
      catchError(() => {
        this.error.set('Impossible de charger les catégories.');
        return of([] as string[]);
      }),
    ),
    { initialValue: null },
  );

  protected categoryLabel = getCreatureCategoryLabel;
  protected getCategoryIcon = getCategoryIcon;
}
