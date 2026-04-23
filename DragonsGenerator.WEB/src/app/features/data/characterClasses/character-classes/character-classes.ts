import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule, KeyValuePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { DataService } from '@core/services/data.service';

@Component({
  selector: 'app-character-classes',
  standalone: true,
  imports: [CommonModule, KeyValuePipe],
  templateUrl: './character-classes.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharacterClasses {
  private readonly dataService = inject(DataService);

  protected readonly classes = toSignal(this.dataService.getClasses(), {
    initialValue: [],
  });

  protected readonly search = signal('');

  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const list = this.classes();
    if (!term) return list;
    return list.filter((c) => c.name.toLowerCase().includes(term));
  });

  protected onSearch(value: string): void {
    this.search.set(value);
  }

  /**
   * Navigation rapide entre les classes
   */
  protected scrollTo(direction: 'up' | 'down'): void {
    // On récupère toutes les balises "article" qui ont la classe "class-card"
    const cards = Array.from(document.querySelectorAll('.class-card')) as HTMLElement[];
    if (!cards.length) return;

    let currentIndex = 0;
    const offset = 100; // Marge de confort en haut de l'écran

    // On cherche quelle carte est actuellement à l'écran
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();

      // Si le haut de la carte est en dessous de notre ligne de vue,
      // c'est qu'on est en train de lire la carte précédente (i - 1)
      if (rect.top > offset) {
        currentIndex = i === 0 ? 0 : i - 1;
        // Exception: si on est très proche du haut de cette carte, on la considère comme active
        if (rect.top < offset + 150) {
          currentIndex = i;
        }
        break;
      }
      // Fallback si on a tout scrollé : on est sur la dernière carte
      currentIndex = i;
    }

    // On détermine la cible
    let targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    // On bloque aux limites du tableau
    if (targetIndex < 0) targetIndex = 0;
    if (targetIndex >= cards.length) targetIndex = cards.length - 1;

    // Défilement en douceur vers la cible (avec une petite marge de 30px au-dessus)
    const targetCard = cards[targetIndex];
    const targetPosition = targetCard.getBoundingClientRect().top + window.scrollY - 30;

    window.scrollTo({ top: targetPosition, behavior: 'smooth' });
  }
}
