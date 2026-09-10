import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataService } from '@core/services/data.service';
import { Civilisation } from '@core/models/Civilisations/civilisations';
import { EANA_MAP_ASPECT, EANA_MAP_RATIO, getEanaMapCoordinates } from '@core/utils/eana-map';
import { FullscreenEnterBtn } from '@shared/components/fullscreen-enter-btn/fullscreen-enter-btn';

@Component({
  selector: 'app-civilisations',
  standalone: true,
  imports: [CommonModule, RouterLink, FullscreenEnterBtn],
  templateUrl: './civilisations.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Civilisations implements OnInit, OnDestroy {
  private readonly civilisationService = inject(DataService);
  private readonly destroyRef = inject(DestroyRef);

  readonly mapAspect = EANA_MAP_ASPECT;
  /** Largeur CSS pour occuper l’écran tout en respectant le ratio de Carte.jpg. */
  readonly mapFullscreenWidth = `min(100%, calc((100dvh - 5.5rem) * ${EANA_MAP_RATIO}))`;

  civilisations = signal<Civilisation[]>([]);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);
  mapFullscreen = signal(false);

  private previousOverflow = '';
  private bodyLocked = false;

  constructor() {
    this.destroyRef.onDestroy(() => this.unlockBody());
  }

  ngOnInit(): void {
    this.loadCivilisations();
  }

  ngOnDestroy(): void {
    this.unlockBody();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.mapFullscreen()) {
      event.preventDefault();
      this.setMapFullscreen(false);
    }
  }

  loadCivilisations() {
    this.civilisationService.getCivilisations().subscribe({
      next: (donnees: Civilisation[]) => {
        this.civilisations.set(donnees);
        this.isLoading.set(false);
      },
      error: (erreur) => {
        console.error('Erreur lors du chargement des civilisations', erreur);
        this.error.set('Impossible de charger les archives du monde.');
        this.isLoading.set(false);
      },
    });
  }

  /** Entrée plein écran uniquement — sortie = Escape. */
  enterMapFullscreen(): void {
    this.setMapFullscreen(true);
  }

  /** Retourne l'identifiant Iconify correspondant à la civilisation */
  getIconForCiv(id: string): string {
    const icons: Record<string, string> = {
      'civ-acoatl': 'fluent-emoji:hindu-temple',
      'civ-ajagar': 'fluent-emoji:elephant',
      'civ-arolavie': 'fluent-emoji:evergreen-tree',
      'civ-iles-barbaresques': 'fluent-emoji:sailboat',
      'civ-cite-franche': 'fluent-emoji:classical-building',
      'civ-cyrillane': 'fluent-emoji:crown',
      'civ-drakenbergen': 'fluent-emoji:mountain',
      'civ-ellerina': 'fluent-emoji:herb',
      'civ-iles-eoliennes': 'fluent-emoji:cloud',
      'civ-inframonde': 'fluent-emoji:spider',
      'civ-kaan': 'fluent-emoji:horse',
      'civ-lothrienne': 'fluent-emoji:shield',
      'civ-mibu': 'fluent-emoji:lion',
      'civ-rachamangekr': 'fluent-emoji:dragon',
      'civ-royaumes-des-sables': 'fluent-emoji:desert',
      'civ-septentrion': 'fluent-emoji:snowflake',
      'civ-shi-huang': 'fluent-emoji:japanese-castle',
      'civ-torea': 'fluent-emoji:desert-island',
    };
    return icons[id] || 'fluent-emoji:world-map';
  }

  /** Retourne les coordonnées X et Y (en %) pour placer l'icône sur la carte */
  getMapCoordinates(id: string): { x: number; y: number } {
    return getEanaMapCoordinates(id);
  }

  private setMapFullscreen(open: boolean): void {
    if (this.mapFullscreen() === open) return;
    this.mapFullscreen.set(open);
    if (open) this.lockBody();
    else this.unlockBody();
  }

  private lockBody(): void {
    if (this.bodyLocked || typeof document === 'undefined') return;
    this.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    this.bodyLocked = true;
  }

  private unlockBody(): void {
    if (!this.bodyLocked || typeof document === 'undefined') return;
    document.body.style.overflow = this.previousOverflow;
    this.bodyLocked = false;
  }
}
