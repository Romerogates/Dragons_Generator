// features/characters/characters.component.ts

import {
  Component,
  OnInit,
  inject,
  ChangeDetectionStrategy,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { PdfGeneratorService } from '@core/services/pdf-generator.service';
import { CharacterCloudService } from '@core/services/character-cloud.service';
import { AuthService } from '@core/services/auth.service';
import { PendingCharacterSaveService } from '@core/services/pending-character-save.service';
import { OfflineSyncService } from '@core/services/offline-sync.service';
import { ConnectivityService } from '@core/services/connectivity.service';
import { CharacterHandoffService } from '@core/services/character-handoff.service';
import type { Character, SpeciesRef } from '@core/models/Character/character';

/**
 * Champs d’anciens exports encore tolérés en lecture liste.
 * Le modèle courant est `Character` (comme character-sheet).
 */
type LegacyListFields = {
  level?: number;
  speciesName?: string;
  className?: string;
  /** Ancien format : libellé de classe en string. */
  class?: string;
  hitPointsMax?: number;
  armorClass?: number;
};

/** Entrée liste : Character + tolérance lecture legacy. */
type ListCharacter = Character & LegacyListFields;

@Component({
  selector: 'app-characters',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './characters.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Characters implements OnInit {
  private pdfService = inject(PdfGeneratorService);
  private router = inject(Router);
  private cloud = inject(CharacterCloudService);
  private auth = inject(AuthService);
  private pendingSave = inject(PendingCharacterSaveService);
  private readonly offlineSync = inject(OfflineSyncService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly handoff = inject(CharacterHandoffService);

  readonly isOnline = this.connectivity.isOnline;
  readonly pendingSyncCount = this.offlineSync.pendingCount;
  readonly cloudSyncError = this.cloud.lastSyncError;

  readonly characters = signal<Character[]>([]);
  readonly characterToDelete = signal<Character | null>(null);
  readonly deleteConfirmName = signal('');
  readonly deleteError = signal<string | null>(null);
  readonly deleting = signal(false);
  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly loading = signal(true);

  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) {
      this.loading.set(false);
      this.characters.set([]);
      return;
    }

    this.pendingSave.flushIfPossible().subscribe({
      next: () => {
        this.offlineSync.flushIfPossible();
        this.reloadFromCloud();
      },
      error: () => {
        this.offlineSync.flushIfPossible();
        this.reloadFromCloud();
      },
    });
  }

  private reloadFromCloud(): void {
    this.loading.set(true);
    this.cloud.loadAll().subscribe({
      next: (list) => {
        this.applyList(this.mergeWithPending(list));
        this.loading.set(false);
      },
      error: () => {
        this.characters.set([]);
        this.loading.set(false);
      },
    });
  }

  private mergeWithPending(cloud: Character[]): Character[] {
    const pending = this.offlineSync.getPendingCharacters();
    const byId = new Map<string, Character>();
    for (const c of cloud) {
      if (c.id) byId.set(c.id, c);
    }
    for (const p of pending) {
      if (p.id) byId.set(p.id, p);
    }
    return [...byId.values()];
  }

  private applyList(parsed: Character[]): void {
    const safeCharacters = (parsed ?? []).map((c, index) => {
      if (!c.id) {
        c.id = crypto.randomUUID ? crypto.randomUUID() : `legacy-${index}-${Date.now()}`;
      }
      return c;
    });
    safeCharacters.sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
    this.characters.set(safeCharacters);
  }

  // === ACCESSEURS SÉCURISÉS (Adaptés au nouveau modèle Character.ts) ===

  getCharName(c: ListCharacter): string {
    return c?.name || 'Héros Inconnu';
  }
  getCharLevel(c: ListCharacter): number {
    return c?.totalLevel || c?.level || 1;
  }

  getCharSpecies(c: ListCharacter): string {
    const species = c?.species as SpeciesRef | string | undefined;
    // Nouveau format (SpeciesRef / CatalogRef)
    if (species && typeof species === 'object') return species.label || 'Espèce inconnue';
    // Ancien format (legacy)
    return c?.speciesName || (typeof species === 'string' ? species : '') || 'Espèce inconnue';
  }

  getCharClass(c: ListCharacter): string {
    if (Array.isArray(c?.classes) && c.classes.length > 0) {
      const cls = c.classes[0];
      if (cls.subclassLabel) return `${cls.classLabel} — ${cls.subclassLabel}`;
      return cls.classLabel || 'Classe inconnue';
    }
    return c?.className || c?.class || 'Classe inconnue';
  }

  getCharSubclass(c: ListCharacter): string {
    if (Array.isArray(c?.classes) && c.classes.length > 0) {
      return c.classes[0].subclassLabel || '';
    }
    return '';
  }

  getCharHp(c: ListCharacter): number {
    return c?.vitality?.hitPointsMax || c?.hitPointsMax || 0;
  }
  getCharAc(c: ListCharacter): number {
    return c?.defense?.armorClass || c?.armorClass || 10;
  }

  // === UI HELPERS ===

  getClassIcon(className: string): string {
    if (!className) return 'fluent-emoji:crossed-swords';
    const name = String(className).toLowerCase();

    if (name.includes('barbare')) return 'fluent-emoji:axe';
    if (name.includes('barde')) return 'fluent-emoji:musical-note';
    if (name.includes('druide')) return 'fluent-emoji:herb';
    if (name.includes('ensorceleur')) return 'fluent-emoji:sparkles';
    if (name.includes('magicien') || name.includes('lettré')) return 'fluent-emoji:crystal-ball';
    if (name.includes('moine')) return 'fluent-emoji:oncoming-fist';
    if (name.includes('paladin')) return 'fluent-emoji:shield';
    if (name.includes('prêtre')) return 'fluent-emoji:latin-cross';
    if (name.includes('rôdeur')) return 'fluent-emoji:bow-and-arrow';
    if (name.includes('roublard')) return 'fluent-emoji:dagger';
    if (name.includes('sorcier')) return 'fluent-emoji:eye';
    return 'fluent-emoji:crossed-swords';
  }

  getSpeciesIcon(speciesName: string): string {
    if (!speciesName) return 'fluent-emoji:bust-in-silhouette';
    const name = String(speciesName).toLowerCase();

    if (name.includes('elfe')) return 'fluent-emoji:elf';
    if (name.includes('nain')) return 'fluent-emoji:pick';
    if (name.includes('halfelin')) return 'fluent-emoji:four-leaf-clover';
    if (name.includes('gnome')) return 'fluent-emoji:wrench';
    if (name.includes('drakéide')) return 'fluent-emoji:dragon-face';
    if (name.includes('tieffelin') || name.includes('mélancolia'))
      return 'fluent-emoji:smiling-face-with-horns';
    if (name.includes('demi-orc') || name.includes('orc')) return 'fluent-emoji:ogre';
    return 'fluent-emoji:bust-in-silhouette';
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'Récemment';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Récemment';
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  onDeleteConfirmNameInput(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.deleteConfirmName.set(value);
  }

  // === ACTIONS ===

  viewCharacter(character: Character): void {
    this.handoff.setCurrent(character);
    this.router.navigate(['/character-sheet']);
  }

  editCharacter(character: Character, event: Event): void {
    event.stopPropagation();
    this.handoff.stashEdit(character);
    this.router.navigate(['/create']);
  }

  duplicateCharacter(character: Character, event: Event): void {
    event.stopPropagation();
    const localId = crypto.randomUUID();
    const duplicate: Character = {
      ...character,
      id: localId,
      name: `${this.getCharName(character)} (copie)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Évite un PUT sur un id fantôme (copie d'un perso déjà cloudSynced).
      cloudSynced: false,
    };

    this.characters.update((chars) => [duplicate, ...chars]);
    if (!this.auth.isLoggedIn()) return;

    this.cloud.save(duplicate).subscribe({
      next: (serverId) => {
        if (!serverId || serverId === localId) {
          this.characters.update((chars) =>
            chars.map((c) => (c.id === localId ? { ...c, cloudSynced: true } : c)),
          );
          return;
        }
        this.characters.update((chars) =>
          chars.map((c) =>
            c.id === localId ? { ...c, id: serverId, cloudSynced: true } : c,
          ),
        );
      },
      error: () => {
        this.offlineSync.queueCharacterSave(duplicate, false);
      },
    });
  }

  downloadPdf(character: Character, event: Event): void {
    event.stopPropagation();

    this.pdfService.generatePdf(character);
  }

  confirmDelete(character: Character, event: Event): void {
    event.stopPropagation();
    this.deleteConfirmName.set('');
    this.deleteError.set(null);
    this.characterToDelete.set(character);
  }

  cancelDelete(): void {
    this.deleteConfirmName.set('');
    this.deleteError.set(null);
    this.characterToDelete.set(null);
  }

  canConfirmDelete(): boolean {
    const toDelete = this.characterToDelete();
    if (!toDelete) return false;
    return this.deleteConfirmName().trim() === this.getCharName(toDelete);
  }

  deleteCharacter(): void {
    const toDelete = this.characterToDelete();
    if (!toDelete || !this.canConfirmDelete() || this.deleting()) return;

    const removeLocal = (): void => {
      this.characters.update((chars) => chars.filter((c) => c.id !== toDelete.id));
      this.deleteConfirmName.set('');
      this.deleteError.set(null);
      this.characterToDelete.set(null);
    };

    if (this.auth.isLoggedIn() && toDelete.id) {
      this.deleting.set(true);
      this.deleteError.set(null);
      this.cloud.delete(toDelete.id).subscribe({
        next: () => {
          removeLocal();
          this.deleting.set(false);
        },
        error: (err: unknown) => {
          // Copie jamais synchronisée / déjà absente côté serveur : on retire quand même.
          const status =
            err && typeof err === 'object' && 'status' in err
              ? Number((err as { status?: number }).status)
              : 0;
          if (status === 404) {
            removeLocal();
            this.deleting.set(false);
            return;
          }
          this.deleteError.set('Échec de la suppression cloud. Réessayez dans un instant.');
          this.deleting.set(false);
        },
      });
      return;
    }

    removeLocal();
  }
}
