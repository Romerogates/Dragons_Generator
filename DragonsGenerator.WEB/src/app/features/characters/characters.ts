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
import type { Character } from '../../core/models/Character/character';

@Component({
  selector: 'app-characters',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './characters.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA], // <-- Autorise la balise <iconify-icon>
})
export class Characters implements OnInit {
  private pdfService = inject(PdfGeneratorService);
  private router = inject(Router);

  // Utilisation des signaux pour une interface réactive
  readonly characters = signal<any[]>([]);
  readonly characterToDelete = signal<any | null>(null);

  ngOnInit(): void {
    this.loadCharacters();
  }

  private loadCharacters(): void {
    try {
      const saved = localStorage.getItem('dragons-characters');
      if (saved) {
        const parsed = JSON.parse(saved);

        // CORRECTION DU TIMEOUT : On s'assure que chaque personnage a un ID unique
        const safeCharacters = parsed.map((c: any, index: number) => {
          if (!c.id) {
            c.id = crypto.randomUUID ? crypto.randomUUID() : `legacy-${index}-${Date.now()}`;
          }
          return c;
        });

        // Tri du plus récent au plus ancien
        safeCharacters.sort((a: any, b: any) => {
          const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return dateB - dateA;
        });

        this.characters.set(safeCharacters);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des personnages:', error);
      this.characters.set([]);
    }
  }

  // === ACCESSEURS SÉCURISÉS (Adaptés au nouveau modèle Character.ts) ===

  getCharName(c: any): string {
    return c?.name || 'Héros Inconnu';
  }
  getCharLevel(c: any): number {
    return c?.totalLevel || c?.level || 1;
  }

  getCharSpecies(c: any): string {
    // Nouveau format (SpeciesRef / CatalogRef)
    if (c?.species && typeof c.species === 'object') return c.species.label || 'Espèce inconnue';
    // Ancien format (legacy)
    return c?.speciesName || c?.species || 'Espèce inconnue';
  }

  getCharClass(c: any): string {
    // Nouveau format (ClassRef[])
    if (Array.isArray(c?.classes) && c.classes.length > 0)
      return c.classes[0].classLabel || 'Classe inconnue';
    // Ancien format (legacy)
    return c?.className || c?.class || 'Classe inconnue';
  }

  getCharHp(c: any): number {
    return c?.vitality?.hitPointsMax || c?.hitPointsMax || 0;
  }
  getCharAc(c: any): number {
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

  // === ACTIONS ===

  viewCharacter(character: any): void {
    localStorage.setItem('dragons-current-character', JSON.stringify(character));
    this.router.navigate(['/character-sheet']);
  }

  editCharacter(character: any, event: Event): void {
    event.stopPropagation();
    localStorage.setItem('dragons-edit-character', JSON.stringify(character));
    this.router.navigate(['/create']);
  }

  duplicateCharacter(character: any, event: Event): void {
    event.stopPropagation();
    const duplicate = {
      ...character,
      id: crypto.randomUUID(),
      name: `${this.getCharName(character)} (copie)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.characters.update((chars) => [duplicate, ...chars]);
    localStorage.setItem('dragons-characters', JSON.stringify(this.characters()));
  }

  downloadPdf(character: any, event: Event): void {
    event.stopPropagation();

    this.pdfService.generatePdf(character);
  }

  confirmDelete(character: any, event: Event): void {
    event.stopPropagation();
    this.characterToDelete.set(character);
  }

  cancelDelete(): void {
    this.characterToDelete.set(null);
  }

  deleteCharacter(): void {
    const toDelete = this.characterToDelete();
    if (!toDelete) return;

    this.characters.update((chars) => chars.filter((c) => c.id !== toDelete.id));
    localStorage.setItem('dragons-characters', JSON.stringify(this.characters()));
    this.characterToDelete.set(null);
  }
}
