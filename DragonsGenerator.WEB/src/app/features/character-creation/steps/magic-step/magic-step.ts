// features/character-creation/steps/magic-step/magic-step.ts
import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '@core/services/data.service';
import { CharacterBuilderService } from '@core/services/character-builder.service';
import type { Spell } from '@core/models/Spells/spell';
import type { SpellcastingKind, AbilityKey } from '@core/models/Character/character';

// ============================================================================
// TYPES
// ============================================================================

export interface SpellRaw {
  id: string;
  name: string;
  level: number;
  school: string;
  castingTime: { amount: number | null; unit: string | null };
  range: { amount: number | string | null; unit: string | null };
  duration: { amount: number | string | null; unit: string | null };
  components: { v: boolean; s: boolean; m: string | null };
  isRitual: boolean;
  isConcentration: boolean;
  isCorrupted: boolean;
  description: string;
  modularOptions: unknown[];
  classes: string[];
  higherLevels: string | null;
}

/** Quotas de sorts au niveau 1 par kind. */
interface SpellQuota {
  cantrips: number;
  /** Sorts de niv 1 choisis définitivement (known casters). */
  knownSpells: number;
  /** Sorts de niv 1 dans le grimoire (wizard uniquement). */
  grimoireSpells: number;
  /** True si le lanceur prépare ses sorts (cleric, druid, wizard). */
  isPrepared: boolean;
  /** Label du mode de sort pour l'UI. */
  modeLabel: string;
}

const SPELL_QUOTAS: Record<string, SpellQuota> = {
  wizard: {
    cantrips: 3,
    knownSpells: 0,
    grimoireSpells: 6,
    isPrepared: true,
    modeLabel: 'Grimoire (sorts copiés)',
  },
  bard: {
    cantrips: 2,
    knownSpells: 4,
    grimoireSpells: 0,
    isPrepared: false,
    modeLabel: 'Sorts connus',
  },
  druid: {
    cantrips: 2,
    knownSpells: 0,
    grimoireSpells: 0,
    isPrepared: true,
    modeLabel: 'Sorts préparés (tous accessibles)',
  },
  sorcerer: {
    cantrips: 4,
    knownSpells: 2,
    grimoireSpells: 0,
    isPrepared: false,
    modeLabel: 'Sorts connus',
  },
  cleric: {
    cantrips: 3,
    knownSpells: 0,
    grimoireSpells: 0,
    isPrepared: true,
    modeLabel: 'Sorts préparés (tous accessibles)',
  },
  warlock: {
    cantrips: 2,
    knownSpells: 2,
    grimoireSpells: 0,
    isPrepared: false,
    modeLabel: 'Sorts connus',
  },
};

const SCHOOL_LABELS: Record<string, string> = {
  abjuration: 'Abjuration',
  conjuration: 'Conjuration',
  divination: 'Divination',
  enchantement: 'Enchantement',
  evocation: 'Évocation',
  illusion: 'Illusion',
  necromancie: 'Nécromancie',
  transmutation: 'Transmutation',
};

// ============================================================================
// COMPOSANT
// ============================================================================

@Component({
  selector: 'app-magic-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './magic-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class MagicStep implements OnInit {
  private dataService = inject(DataService); // ← était HttpClient
  readonly builder = inject(CharacterBuilderService);

  readonly allSpells = signal<Spell[]>([]); // ← était SpellRaw[]
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly expandedSpellId = signal<string | null>(null);

  readonly selectedCantrips = signal<Set<string>>(new Set());
  readonly selectedSpells = signal<Set<string>>(new Set());

  // === Computed ===

  readonly spellcastingKind = computed<SpellcastingKind | null>(
    () => this.builder.creation().spellcastingKind,
  );

  readonly quota = computed<SpellQuota | null>(() => {
    const kind = this.spellcastingKind();
    return kind ? (SPELL_QUOTAS[kind] ?? null) : null;
  });

  readonly spellcastingAbility = computed(() => this.builder.creation().spellcastingAbility);

  /** DD de sauvegarde des sorts. */
  readonly spellSaveDC = computed(() => {
    const ability = this.spellcastingAbility();
    if (!ability) return 0;
    const key = this.abilityToKey(ability);
    const mod = key ? this.builder.abilityModifiers()[key] : 0;
    return 8 + 2 + mod; // 8 + prof + mod
  });

  /** Bonus d'attaque des sorts. */
  readonly spellAttackBonus = computed(() => {
    const ability = this.spellcastingAbility();
    if (!ability) return 0;
    const key = this.abilityToKey(ability);
    const mod = key ? this.builder.abilityModifiers()[key] : 0;
    return 2 + mod;
  });

  /** Cantrips disponibles (level 0). */
  readonly availableCantrips = computed(() =>
    this.allSpells()
      .filter((s) => s.level === 0)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  /** Sorts niv 1 disponibles. */
  readonly availableLevel1 = computed(() =>
    this.allSpells()
      .filter((s) => s.level === 1)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  readonly cantripsRemaining = computed(() => {
    const q = this.quota();
    return q ? q.cantrips - this.selectedCantrips().size : 0;
  });

  readonly spellsRemaining = computed(() => {
    const q = this.quota();
    if (!q) return 0;
    const total = q.knownSpells || q.grimoireSpells;
    return total - this.selectedSpells().size;
  });

  /** Nombre total de sorts niv 1 à choisir. */
  readonly spellsToChoose = computed(() => {
    const q = this.quota();
    return q ? q.knownSpells || q.grimoireSpells : 0;
  });

  readonly selectionComplete = computed(() => {
    return (
      this.cantripsRemaining() === 0 &&
      (this.spellsToChoose() === 0 || this.spellsRemaining() === 0)
    );
  });

  readonly isConfirmed = computed(() => {
    const details = this.builder.creation().spellcastingDetails;
    return !!(details && (details as any).cantrips);
  });

  // === Lifecycle ===

  ngOnInit(): void {
    this.loading.set(true);
    this.dataService.getSpells().subscribe({
      // ← était this.http.get<SpellRaw[]>(...)
      next: (spells) => {
        this.allSpells.set(spells);
        this.loading.set(false);
        this.restoreFromBuilder();
      },
      error: () => {
        this.error.set('Impossible de charger les sorts.');
        this.loading.set(false);
      },
    });
  }

  // === Actions ===

  toggleCantrip(spellId: string): void {
    this.selectedCantrips.update((set) => {
      const next = new Set(set);
      if (next.has(spellId)) {
        next.delete(spellId);
      } else if (next.size < (this.quota()?.cantrips ?? 0)) {
        next.add(spellId);
      }
      return next;
    });

    // Vérifie s'il faut scroller
    this.checkScrollToBottom();
  }

  toggleSpell(spellId: string): void {
    this.selectedSpells.update((set) => {
      const next = new Set(set);
      if (next.has(spellId)) {
        next.delete(spellId);
      } else if (next.size < this.spellsToChoose()) {
        next.add(spellId);
      }
      return next;
    });

    // Vérifie s'il faut scroller
    this.checkScrollToBottom();
  }

  /**
   * Vérifie l'état de la sélection pour guider le joueur (Scroll auto).
   */
  private checkScrollToBottom(): void {
    setTimeout(() => {
      if (this.isConfirmed()) return; // On ne fait rien si le grimoire est déjà scellé

      // Cas 1 : TOUT est terminé -> On scroll tout en bas vers le bouton de confirmation
      if (this.selectionComplete()) {
        const btn = document.getElementById('btn-confirm-magic');
        if (btn) {
          btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return; // On arrête l'exécution ici
      }

      // Cas 2 : Les sorts mineurs sont finis, MAIS il reste des sorts de niveau 1 à choisir
      if (
        this.cantripsRemaining() === 0 &&
        this.spellsToChoose() > 0 &&
        this.spellsRemaining() > 0
      ) {
        const lvl1Section = document.getElementById('section-level-1');
        if (lvl1Section) {
          lvl1Section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }, 150);
  }

  isCantripSelected(id: string): boolean {
    return this.selectedCantrips().has(id);
  }

  isSpellSelected(id: string): boolean {
    return this.selectedSpells().has(id);
  }

  canSelectCantrip(id: string): boolean {
    return this.isCantripSelected(id) || this.cantripsRemaining() > 0;
  }

  canSelectSpell(id: string): boolean {
    return this.isSpellSelected(id) || this.spellsRemaining() > 0;
  }

  toggleExpand(id: string): void {
    this.expandedSpellId.update((v) => (v === id ? null : id));
  }

  isExpanded(id: string): boolean {
    return this.expandedSpellId() === id;
  }

  confirm(): void {
    const allMap = new Map(this.allSpells().map((s) => [s.id, s]));

    const cantripInstances = [...this.selectedCantrips()].map((id) => {
      const raw = allMap.get(id);
      return {
        refId: id,
        name: raw?.name ?? id,
        level: 0,
        prepared: true,
        effectSummary: this.extractEffect(raw),
      };
    });

    const spellInstances = [...this.selectedSpells()].map((id) => {
      const raw = allMap.get(id);
      return {
        refId: id,
        name: raw?.name ?? id,
        level: raw?.level ?? 1,
        prepared: true,
        effectSummary: this.extractEffect(raw),
      };
    });

    const details = {
      cantrips: cantripInstances,
      spells: spellInstances,
    };

    // Sauvegarde et passage à l'étape suivante !
    this.builder.creation.update((c) => ({ ...c, spellcastingDetails: details }));
    this.builder.nextStep();
  }

  prevStep(): void {
    this.builder.previousStep();
  }

  /**
   * Construit un résumé compact du sort pour la colonne "Effet" du grimoire.
   */
  private extractEffect(raw: Spell | undefined): string {
    if (!raw) return '';

    const parts: string[] = [];

    const comp = this.formatComponents(raw.components);
    if (comp) parts.push(comp);

    const dur = this.formatDuration(raw.duration);
    if (dur) parts.push(dur);

    if (raw.description) {
      const firstSentence = raw.description.split(/\.\s/)[0] + '.';
      parts.push(firstSentence);
    }

    const full = parts.join(' | ');
    if (full.length <= 140) return full;
    return full.substring(0, 137) + '…';
  }

  private formatComponents(comp: { v: boolean; s: boolean; m: string | null }): string {
    const parts: string[] = [];
    if (comp.v) parts.push('V');
    if (comp.s) parts.push('S');
    if (comp.m !== null) {
      const mat = comp.m.length > 20 ? comp.m.substring(0, 18) + '…' : comp.m;
      parts.push(`M(${mat})`);
    }
    return parts.join(',');
  }

  private formatDuration(dur: { amount: number | string | null; unit: string | null }): string {
    if (!dur.amount && !dur.unit) return 'Instantanée';
    if (dur.amount === 'instantanee' || dur.amount === 'instantanée') return 'Instantanée';

    const amount = dur.amount ?? '';
    const unit = dur.unit ?? '';

    const shortUnits: Record<string, string> = {
      minute: 'min',
      minutes: 'min',
      heure: 'h',
      heures: 'h',
      round: 'rd',
      rounds: 'rds',
      jour: 'j',
      jours: 'j',
      tour: 'tour',
      tours: 'tours',
    };
    const shortUnit = shortUnits[unit.toLowerCase()] ?? unit;

    return `${amount} ${shortUnit}`.trim();
  }

  clearSelection(): void {
    this.selectedCantrips.set(new Set());
    this.selectedSpells.set(new Set());
    this.builder.creation.update((c) => ({ ...c, spellcastingDetails: {} }));
  }

  // === Display helpers ===

  schoolLabel(school: string): string {
    return SCHOOL_LABELS[school] ?? school;
  }

  castTimeLabel(s: Spell): string {
    if (!s.castingTime.amount && !s.castingTime.unit) return '—';
    return `${s.castingTime.amount ?? ''} ${s.castingTime.unit ?? ''}`.trim();
  }

  rangeLabel(s: Spell): string {
    if (!s.range.amount && !s.range.unit) return 'Personnel';
    if (s.range.amount === 'personnelle') return 'Personnel';
    if (s.range.amount === 'contact') return 'Contact';
    return `${s.range.amount ?? ''}${s.range.unit ? ' ' + s.range.unit : ''}`.trim() || '—';
  }

  componentsLabel(s: Spell): string {
    const parts: string[] = [];
    if (s.components.v) parts.push('V');
    if (s.components.s) parts.push('S');
    if (s.components.m) parts.push('M');
    return parts.join(', ') || '—';
  }

  durationLabel(s: Spell): string {
    if (!s.duration.amount && !s.duration.unit) return 'Instantané';
    if (s.duration.amount === 'instantanee' || s.duration.amount === 'instantanée')
      return 'Instantané';
    if (s.duration.amount === "jusqu'a dissipation" || s.duration.amount === "jusqu'a dissipation")
      return "Jusqu'à dissipation";
    return `${s.duration.amount ?? ''} ${s.duration.unit ?? ''}`.trim() || '—';
  }

  fmtBonus(n: number): string {
    return n >= 0 ? `+${n}` : `${n}`;
  }

  // === Private ===

  private abilityToKey(ability: string): AbilityKey | null {
    const map: Record<string, AbilityKey> = {
      Force: 'force',
      Dextérité: 'dexterite',
      Constitution: 'constitution',
      Intelligence: 'intelligence',
      Sagesse: 'sagesse',
      Charisme: 'charisme',
    };
    return map[ability] ?? null;
  }

  private restoreFromBuilder(): void {
    const details = this.builder.creation().spellcastingDetails as any;
    if (details?.cantrips) {
      this.selectedCantrips.set(new Set(details.cantrips.map((c: any) => c.refId)));
    }
    if (details?.spells) {
      this.selectedSpells.set(new Set(details.spells.map((s: any) => s.refId)));
    }
  }

  // ============================================================================
  // THEME VISUEL : LE TAROT ÉSOTÉRIQUE
  // ============================================================================

  private getSchoolKey(school: string): string {
    return (school || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  getGlowClasses(school: string, isSelected: boolean): string {
    if (!isSelected) return 'opacity-0 group-hover:opacity-30 bg-slate-500/20';
    switch (this.getSchoolKey(school)) {
      case 'abjuration':
        return 'opacity-100 animate-pulse bg-cyan-500/20';
      case 'conjuration':
        return 'opacity-100 animate-pulse bg-yellow-500/20';
      case 'divination':
        return 'opacity-100 animate-pulse bg-indigo-500/20';
      case 'enchantement':
        return 'opacity-100 animate-pulse bg-fuchsia-500/20';
      case 'evocation':
        return 'opacity-100 animate-pulse bg-red-500/20';
      case 'illusion':
        return 'opacity-100 animate-pulse bg-purple-500/20';
      case 'necromancie':
        return 'opacity-100 animate-pulse bg-lime-500/20';
      case 'transmutation':
        return 'opacity-100 animate-pulse bg-orange-500/20';
      default:
        return 'opacity-100 animate-pulse bg-slate-500/20';
    }
  }

  getCardClasses(school: string, isSelected: boolean): string {
    if (!isSelected) return 'border-slate-800 hover:border-slate-600 shadow-lg';
    switch (this.getSchoolKey(school)) {
      case 'abjuration':
        return 'border-2 border-cyan-500 shadow-[inset_0_0_15px_rgba(6,182,212,0.15)]';
      case 'conjuration':
        return 'border-2 border-yellow-500 shadow-[inset_0_0_15px_rgba(234,179,8,0.15)]';
      case 'divination':
        return 'border-2 border-indigo-500 shadow-[inset_0_0_15px_rgba(99,102,241,0.15)]';
      case 'enchantement':
        return 'border-2 border-fuchsia-500 shadow-[inset_0_0_15px_rgba(217,70,239,0.15)]';
      case 'evocation':
        return 'border-2 border-red-500 shadow-[inset_0_0_15px_rgba(239,68,68,0.15)]';
      case 'illusion':
        return 'border-2 border-purple-500 shadow-[inset_0_0_15px_rgba(168,85,247,0.15)]';
      case 'necromancie':
        return 'border-2 border-lime-500 shadow-[inset_0_0_15px_rgba(132,204,22,0.15)]';
      case 'transmutation':
        return 'border-2 border-orange-500 shadow-[inset_0_0_15px_rgba(249,115,22,0.15)]';
      default:
        return 'border-2 border-slate-500 shadow-[inset_0_0_15px_rgba(100,116,139,0.15)]';
    }
  }

  getTextClasses(school: string, isSelected: boolean): string {
    if (!isSelected) return 'text-slate-300 group-hover:text-slate-100';
    switch (this.getSchoolKey(school)) {
      case 'abjuration':
        return 'text-cyan-400';
      case 'conjuration':
        return 'text-yellow-400';
      case 'divination':
        return 'text-indigo-400';
      case 'enchantement':
        return 'text-fuchsia-400';
      case 'evocation':
        return 'text-red-400';
      case 'illusion':
        return 'text-purple-400';
      case 'necromancie':
        return 'text-lime-400';
      case 'transmutation':
        return 'text-orange-400';
      default:
        return 'text-slate-200';
    }
  }

  getBadgeClasses(school: string): string {
    switch (this.getSchoolKey(school)) {
      case 'abjuration':
        return 'bg-cyan-950/30 text-cyan-500 border-cyan-900/50';
      case 'conjuration':
        return 'bg-yellow-950/30 text-yellow-500 border-yellow-900/50';
      case 'divination':
        return 'bg-indigo-950/30 text-indigo-400 border-indigo-900/50';
      case 'enchantement':
        return 'bg-fuchsia-950/30 text-fuchsia-400 border-fuchsia-900/50';
      case 'evocation':
        return 'bg-red-950/30 text-red-500 border-red-900/50';
      case 'illusion':
        return 'bg-purple-950/30 text-purple-400 border-purple-900/50';
      case 'necromancie':
        return 'bg-lime-950/30 text-lime-500 border-lime-900/50';
      case 'transmutation':
        return 'bg-orange-950/30 text-orange-500 border-orange-900/50';
      default:
        return 'bg-slate-900 text-slate-400 border-slate-700';
    }
  }

  getCheckboxClasses(school: string, isSelected: boolean): string {
    if (!isSelected)
      return 'border-slate-700 group-hover:border-slate-500 bg-[#1b2028] text-transparent';
    switch (this.getSchoolKey(school)) {
      case 'abjuration':
        return 'border-cyan-500 bg-cyan-950/50 text-cyan-400';
      case 'conjuration':
        return 'border-yellow-500 bg-yellow-950/50 text-yellow-500';
      case 'divination':
        return 'border-indigo-500 bg-indigo-950/50 text-indigo-400';
      case 'enchantement':
        return 'border-fuchsia-500 bg-fuchsia-950/50 text-fuchsia-400';
      case 'evocation':
        return 'border-red-500 bg-red-950/50 text-red-500';
      case 'illusion':
        return 'border-purple-500 bg-purple-950/50 text-purple-400';
      case 'necromancie':
        return 'border-lime-500 bg-lime-950/50 text-lime-500';
      case 'transmutation':
        return 'border-orange-500 bg-orange-950/50 text-orange-500';
      default:
        return 'border-slate-500 bg-slate-800 text-slate-200';
    }
  }
}
