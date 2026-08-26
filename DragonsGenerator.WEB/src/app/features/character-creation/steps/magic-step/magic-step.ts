// features/character-creation/steps/magic-step/magic-step.ts
import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  effect,
  untracked,
  ChangeDetectionStrategy,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { DataService } from '@core/services/data.service';
import { CharacterBuilderService } from '@core/services/character-builder.service';
import type { Spell } from '@core/models/Spells/spell';
import type { Deity } from '@core/models/Deities/deity';
import type { SpellcastingKind, AbilityKey } from '@core/models/Character/character';
import { warlockArcanumSpellLevels } from '@core/utils/progression-choices.util';

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

/** Quotas de sorts au niveau 1. */
interface SpellQuota {
  cantrips: number;
  /** Sorts de niv 1 choisis définitivement (known casters). */
  knownSpells: number;
  /** Sorts de niv 1 dans le grimoire (wizard uniquement). */
  grimoireSpells: number;
  /** Sorts préparés au niv. 1 (prêtre / druide). */
  preparedSpells: number;
  /** True si le lanceur prépare ses sorts. */
  isPrepared: boolean;
  /** Accès à toute la liste (prépare un sous-ensemble). */
  hasFullListAccess: boolean;
  /** Label du mode de sort pour l'UI. */
  modeLabel: string;
}

/** Fallback si le JSON classe n'a pas encore les resources. */
const SPELL_QUOTAS_FALLBACK: Record<string, SpellQuota> = {
  wizard: {
    cantrips: 3,
    knownSpells: 0,
    grimoireSpells: 6,
    preparedSpells: 0,
    isPrepared: true,
    hasFullListAccess: false,
    modeLabel: 'Grimoire (sorts copiés)',
  },
  bard: {
    cantrips: 2,
    knownSpells: 4,
    grimoireSpells: 0,
    preparedSpells: 0,
    isPrepared: false,
    hasFullListAccess: false,
    modeLabel: 'Sorts connus',
  },
  druid: {
    cantrips: 2,
    knownSpells: 0,
    grimoireSpells: 0,
    preparedSpells: 0,
    isPrepared: true,
    hasFullListAccess: true,
    modeLabel: 'Sorts préparés',
  },
  sorcerer: {
    cantrips: 4,
    knownSpells: 2,
    grimoireSpells: 0,
    preparedSpells: 0,
    isPrepared: false,
    hasFullListAccess: false,
    modeLabel: 'Sorts connus',
  },
  cleric: {
    cantrips: 3,
    knownSpells: 0,
    grimoireSpells: 0,
    preparedSpells: 0,
    isPrepared: true,
    hasFullListAccess: true,
    modeLabel: 'Sorts préparés',
  },
  warlock: {
    cantrips: 2,
    knownSpells: 2,
    grimoireSpells: 0,
    preparedSpells: 0,
    isPrepared: false,
    hasFullListAccess: false,
    modeLabel: 'Sorts connus',
  },
  paladin: {
    cantrips: 0,
    knownSpells: 0,
    grimoireSpells: 0,
    preparedSpells: 0,
    isPrepared: true,
    hasFullListAccess: true,
    modeLabel: 'Sorts préparés (serment)',
  },
  ranger: {
    cantrips: 0,
    knownSpells: 0,
    grimoireSpells: 0,
    preparedSpells: 0,
    isPrepared: false,
    hasFullListAccess: false,
    modeLabel: 'Sorts connus (niv. 2+)',
  },
};

const SCHOOL_LABELS: Record<string, string> = {
  abjuration: 'Abjuration',
  conjuration: 'Conjuration',
  invocation: 'Invocation',
  divination: 'Divination',
  enchantement: 'Enchantement',
  evocation: 'Évocation',
  illusion: 'Illusion',
  necromancie: 'Nécromancie',
  transmutation: 'Transmutation',
};

/** subcls-domaine-de-la-vie → dom-vie */
const SUBCLASS_TO_DOMAIN: Record<string, string> = {
  'subcls-domaine-de-la-vie': 'dom-vie',
  'subcls-domaine-de-letrange': 'dom-etrange',
  'subcls-domaine-de-la-force': 'dom-force',
  'subcls-domaine-de-lindicible': 'dom-indicible',
  'subcls-domaine-du-partage': 'dom-partage',
  'subcls-domaine-du-temps': 'dom-temps',
  'subcls-domaine-du-voyage': 'dom-voyage',
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

  readonly allSpells = signal<Spell[]>([]);
  readonly deities = signal<Deity[]>([]);
  readonly domainSpellIds = signal<string[]>([]);
  readonly classQuota = signal<SpellQuota | null>(null);
  readonly selectedDeityId = signal<string | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly expandedSpellId = signal<string | null>(null);
  /** Snapshot JSON classe pour recalculer les quotas si le niveau change. */
  private readonly loadedClass = signal<any>(null);

  readonly selectedCantrips = signal<Set<string>>(new Set());
  readonly selectedSpells = signal<Set<string>>(new Set());
  /** Arcanes sorcier : niveau de sort → id sort */
  readonly arcanumPicks = signal<Record<number, string>>({});
  readonly expandedArcanumLevel = signal<number | null>(null);
  /** Magicien maîtrise L17 */
  readonly masteryPicks = signal<Record<number, string>>({});
  /** Magicien sorts attitrés L19 */
  readonly signatureIds = signal<string[]>([]);
  /** Snapshot bonus_spells_granted pour le PDF paladin */
  private subclassBonusSpells: {
    level_unlocked?: number;
    spells?: string[];
  }[] = [];

  constructor() {
    effect(() => {
      const level = this.builder.targetLevel();
      const cls = this.loadedClass();
      if (!cls) return;
      void level;
      untracked(() => {
        this.applyClassSpellData(cls);
        this.trimSelectionsToQuota();
      });
    });
  }

  // === Computed ===

  readonly spellcastingKind = computed<SpellcastingKind | null>(
    () => this.builder.creation().spellcastingKind,
  );

  readonly isCleric = computed(() => this.spellcastingKind() === 'cleric');
  readonly isWarlock = computed(() => this.spellcastingKind() === 'warlock');
  readonly isWizard = computed(() => this.spellcastingKind() === 'wizard');
  readonly isPaladin = computed(() => this.spellcastingKind() === 'paladin');
  readonly isPreparedCaster = computed(() => {
    const k = this.spellcastingKind();
    return k === 'cleric' || k === 'druid' || k === 'paladin';
  });

  /** Emplacements d'Arcane (sorcier L11+). */
  readonly arcanumSpellLevels = computed(() => {
    if (!this.isWarlock()) return [] as number[];
    return warlockArcanumSpellLevels(this.builder.targetLevel());
  });

  readonly arcanumComplete = computed(() => {
    const levels = this.arcanumSpellLevels();
    if (!levels.length) return true;
    const picks = this.arcanumPicks();
    return levels.every((lvl) => !!picks[lvl]);
  });

  /** Magicien L17 : maîtrise 1 sort niv.1 + 1 niv.2 parmi le grimoire. */
  readonly needsSpellMastery = computed(
    () => this.isWizard() && this.builder.targetLevel() >= 17,
  );
  /** Magicien L19 : 2 sorts attitrés de niv.3. */
  readonly needsSignatureSpells = computed(
    () => this.isWizard() && this.builder.targetLevel() >= 19,
  );

  readonly masteryComplete = computed(() => {
    if (!this.needsSpellMastery()) return true;
    const p = this.masteryPicks();
    return !!p[1] && !!p[2];
  });

  readonly signatureComplete = computed(() => {
    if (!this.needsSignatureSpells()) return true;
    return this.signatureIds().length >= 2;
  });

  /** Sorts du grimoire/préparés pour un niveau donné (candidats maîtrise / attitrés). */
  preparedSpellsOfLevel(level: number): Spell[] {
    const ids = this.selectedSpells();
    return this.allSpells()
      .filter((s) => s.level === level && ids.has(s.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  spellsForArcanum(level: number): Spell[] {
    return this.spellsForClass(level);
  }

  arcanumPickName(level: number): string {
    const id = this.arcanumPicks()[level];
    if (!id) return '';
    return this.allSpells().find((s) => s.id === id)?.name ?? id;
  }

  pickArcanum(spellLevel: number, spellId: string): void {
    this.arcanumPicks.update((m) => {
      const next = { ...m };
      if (next[spellLevel] === spellId) delete next[spellLevel];
      else next[spellLevel] = spellId;
      return next;
    });
    this.expandedArcanumLevel.set(null);
  }

  toggleArcanumPanel(level: number): void {
    this.expandedArcanumLevel.update((cur) => (cur === level ? null : level));
  }

  pickMastery(spellLevel: 1 | 2, spellId: string): void {
    this.masteryPicks.update((m) => {
      const next = { ...m };
      if (next[spellLevel] === spellId) delete next[spellLevel];
      else next[spellLevel] = spellId;
      return next;
    });
  }

  toggleSignature(spellId: string): void {
    this.signatureIds.update((arr) => {
      if (arr.includes(spellId)) return arr.filter((id) => id !== spellId);
      if (arr.length >= 2) return [arr[1], spellId];
      return [...arr, spellId];
    });
  }

  isSignatureSelected(id: string): boolean {
    return this.signatureIds().includes(id);
  }

  masteryPickName(level: number): string {
    const id = this.masteryPicks()[level];
    if (!id) return '';
    return this.allSpells().find((s) => s.id === id)?.name ?? id;
  }

  readonly bonusSpellsTitle = computed(() => {
    if (this.isPaladin()) return 'Sorts de serment (toujours préparés)';
    if (this.isCleric()) return 'Sorts de domaine (toujours préparés)';
    return 'Sorts bonus (toujours préparés)';
  });

  readonly classId = computed(() => this.builder.creation().classId);

  readonly quota = computed<SpellQuota | null>(() => {
    const fromClass = this.classQuota();
    if (fromClass) return fromClass;
    const kind = this.spellcastingKind();
    return kind ? (SPELL_QUOTAS_FALLBACK[kind] ?? null) : null;
  });

  readonly spellcastingAbility = computed(() => this.builder.creation().spellcastingAbility);

  /** DD de sauvegarde des sorts. */
  readonly spellSaveDC = computed(() => {
    const ability = this.spellcastingAbility();
    if (!ability) return 0;
    const key = this.abilityToKey(ability);
    const mod = key ? this.builder.abilityModifiers()[key] : 0;
    return 8 + this.builder.proficiencyBonus() + mod;
  });

  /** Bonus d'attaque des sorts. */
  readonly spellAttackBonus = computed(() => {
    const ability = this.spellcastingAbility();
    if (!ability) return 0;
    const key = this.abilityToKey(ability);
    const mod = key ? this.builder.abilityModifiers()[key] : 0;
    return this.builder.proficiencyBonus() + mod;
  });

  /** Niveau de sort max accessible (selon emplacements / half-caster). */
  readonly maxSpellLevel = computed(() => {
    const kind = this.spellcastingKind();
    const level = this.builder.targetLevel();
    if (!kind) return 1;
    if (kind === 'warlock') {
      if (level >= 9) return 5;
      if (level >= 7) return 4;
      if (level >= 5) return 3;
      if (level >= 3) return 2;
      return 1;
    }
    const half = kind === 'paladin' || kind === 'ranger' || kind === 'fighter_eldritch_knight';
    if (half) {
      if (level < 2) return 0;
      if (level >= 17) return 5;
      if (level >= 13) return 4;
      if (level >= 9) return 3;
      if (level >= 5) return 2;
      return 1;
    }
    // Full casters
    if (level >= 17) return 9;
    if (level >= 15) return 8;
    if (level >= 13) return 7;
    if (level >= 11) return 6;
    if (level >= 9) return 5;
    if (level >= 7) return 4;
    if (level >= 5) return 3;
    if (level >= 3) return 2;
    return 1;
  });

  private spellsForClass(level: number): Spell[] {
    const classId = this.classId();
    return this.allSpells()
      .filter((s) => s.level === level)
      .filter((s) => {
        if (!classId) return true;
        if (!s.classes?.length) return false;
        return s.classes.includes(classId);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Cantrips disponibles (level 0) pour la classe. */
  readonly availableCantrips = computed(() => this.spellsForClass(0));

  /** Niveaux de sorts préparables / connus (1 → max). */
  readonly spellLevels = computed(() => {
    const max = this.maxSpellLevel();
    return Array.from({ length: Math.max(0, max) }, (_, i) => i + 1);
  });

  /** Sorts niv 1+ disponibles pour la classe (hors domaine auto). */
  readonly availableLeveledSpells = computed(() => {
    const domain = new Set(this.domainSpellIds());
    const max = this.maxSpellLevel();
    const out: Spell[] = [];
    for (let lvl = 1; lvl <= max; lvl++) {
      out.push(...this.spellsForClass(lvl).filter((s) => !domain.has(s.id)));
    }
    return out;
  });

  /** @deprecated alias pour templates existants */
  readonly availableLevel1 = computed(() => this.availableLeveledSpells());

  /** Divinités filtrées (prêtre + domaine compatible). */
  readonly availableDeities = computed(() => {
    const all = this.deities();
    const forCleric = all.filter((d) =>
      (d.grantsPowersTo ?? []).some((g) => g.toLowerCase().includes('pretre')),
    );
    const domainId = SUBCLASS_TO_DOMAIN[this.builder.creation().subclassId ?? ''];
    if (!domainId) return forCleric;
    return forCleric.filter((d) => (d.domains ?? []).includes(domainId));
  });

  readonly domainSpells = computed(() => {
    const ids = this.domainSpellIds();
    if (!ids.length) return [];
    const map = new Map(this.allSpells().map((s) => [s.id, s]));
    return ids.map((id) => map.get(id)).filter((s): s is Spell => !!s);
  });

  readonly cantripsRemaining = computed(() => {
    const q = this.quota();
    return q ? q.cantrips - this.selectedCantrips().size : 0;
  });

  readonly spellsRemaining = computed(() => {
    const q = this.quota();
    if (!q) return 0;
    const total = q.knownSpells || q.grimoireSpells || q.preparedSpells;
    return Math.max(0, total - this.selectedSpells().size);
  });

  /** Nombre total de sorts niv 1 à choisir. */
  readonly spellsToChoose = computed(() => {
    const q = this.quota();
    return q ? q.knownSpells || q.grimoireSpells || q.preparedSpells : 0;
  });

  readonly selectionComplete = computed(() => {
    const spellsOk =
      this.cantripsRemaining() === 0 &&
      (this.spellsToChoose() === 0 || this.spellsRemaining() === 0);
    if (this.isCleric() && !this.selectedDeityId()) return false;
    if (!this.arcanumComplete()) return false;
    if (!this.masteryComplete()) return false;
    if (!this.signatureComplete()) return false;
    return spellsOk;
  });

  readonly isConfirmed = computed(() => {
    const details = this.builder.creation().spellcastingDetails;
    return !!(details && (details as any).cantrips);
  });

  // === Lifecycle ===

  ngOnInit(): void {
    this.loading.set(true);
    const classId = this.builder.creation().classId;

    const requests: Record<string, any> = {
      spells: this.dataService.getSpells(),
      deities: this.dataService.getDeities(),
    };
    if (classId) {
      requests['cls'] = this.dataService.getClassById(classId);
    }

    forkJoin(requests).subscribe({
      next: (res: any) => {
        this.allSpells.set(res.spells);
        this.deities.set(res.deities);
        this.loadedClass.set(res.cls ?? null);
        this.applyClassSpellData(res.cls);
        this.loading.set(false);
        this.restoreFromBuilder();
      },
      error: () => {
        this.error.set('Impossible de charger les sorts.');
        this.loading.set(false);
      },
    });
  }

  private applyClassSpellData(cls: any): void {
    this.extractDomainSpells(cls);
    this.classQuota.set(this.buildQuotaFromClass(cls));
  }

  private buildQuotaFromClass(cls: any): SpellQuota | null {
    const kind = this.spellcastingKind();
    if (!kind) return null;
    const fallback = SPELL_QUOTAS_FALLBACK[kind];
    if (!fallback) return null;

    const targetLevel = this.builder.targetLevel();
    const prog = (cls?.data?.progression as any[])?.find((p) => p.level === targetLevel)
      ?? (cls?.data?.progression as any[])?.find((p) => p.level === 1);
    const resources = prog?.resources ?? {};
    const spellcasting = cls?.data?.spellcasting ?? {};

    const cantrips =
      typeof resources.cantrips_known === 'number'
        ? resources.cantrips_known
        : fallback.cantrips;

    const knownSpells =
      typeof resources.spells_known === 'number'
        ? resources.spells_known
        : fallback.knownSpells;

    const grimoireSpells =
      typeof spellcasting?.grimoire?.initial_spells === 'number'
        ? spellcasting.grimoire.initial_spells + Math.max(0, (targetLevel - 1) * 2)
        : fallback.grimoireSpells;

    const isClericOrDruid = kind === 'cleric' || kind === 'druid';
    const isPaladin = kind === 'paladin';
    let preparedSpells = 0;
    if (isClericOrDruid || isPaladin) {
      const ability = this.spellcastingAbility();
      const key = ability ? this.abilityToKey(ability) : null;
      const mod = key ? (this.builder.abilityModifiers()[key] ?? 0) : 0;
      const levelTerm = isPaladin ? Math.floor(targetLevel / 2) : targetLevel;
      preparedSpells = Math.max(1, mod + levelTerm);
    }

    let modeLabel = fallback.modeLabel;
    if (kind === 'wizard') modeLabel = 'Grimoire (sorts copiés)';
    else if (isClericOrDruid || isPaladin)
      modeLabel = `Sorts préparés (${preparedSpells} au choix)`;
    else if (knownSpells > 0) modeLabel = 'Sorts connus';

    return {
      cantrips,
      knownSpells: isClericOrDruid || isPaladin ? 0 : knownSpells,
      grimoireSpells: kind === 'wizard' ? grimoireSpells : 0,
      preparedSpells,
      isPrepared: fallback.isPrepared || isClericOrDruid || isPaladin,
      hasFullListAccess: isClericOrDruid || isPaladin,
      modeLabel,
    };
  }

  private extractDomainSpells(cls: any): void {
    const kind = this.spellcastingKind();
    if (!cls || (kind !== 'cleric' && kind !== 'paladin')) {
      this.domainSpellIds.set([]);
      this.subclassBonusSpells = [];
      return;
    }
    const subclassId = this.builder.creation().subclassId;
    const options = cls?.data?.subclasses?.options ?? [];
    const sub = options.find((o: any) => o.id === subclassId);
    if (!sub) {
      this.domainSpellIds.set([]);
      this.subclassBonusSpells = [];
      return;
    }
    const granted = (sub.bonus_spells_granted ?? []) as {
      level_unlocked?: number;
      spells?: string[];
    }[];
    this.subclassBonusSpells = granted;
    const ids = granted
      .filter((g) => (g.level_unlocked ?? 99) <= this.builder.targetLevel())
      .flatMap((g) => g.spells ?? []);
    this.domainSpellIds.set([...new Set(ids)]);
  }

  /** Recadre les sélections si le quota ou le niveau max diminue. */
  private trimSelectionsToQuota(): void {
    const q = this.quota();
    const maxLvl = this.maxSpellLevel();
    const spellMap = new Map(this.allSpells().map((s) => [s.id, s]));

    this.selectedCantrips.update((set) => {
      const next = [...set];
      while (q && next.length > q.cantrips) next.pop();
      return new Set(next);
    });

    this.selectedSpells.update((set) => {
      let next = [...set].filter((id) => {
        const sp = spellMap.get(id);
        return sp && sp.level >= 1 && sp.level <= maxLvl;
      });
      const limit = q ? q.knownSpells || q.grimoireSpells || q.preparedSpells : 0;
      if (limit > 0 && next.length > limit) next = next.slice(0, limit);
      return new Set(next);
    });
  }

  selectDeity(deityId: string): void {
    this.selectedDeityId.set(deityId);
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

    const chosenSpellIds = [...this.selectedSpells()];
    const domainIds = this.domainSpellIds().filter((id) => !chosenSpellIds.includes(id));
    const spellInstances = [...chosenSpellIds, ...domainIds].map((id) => {
      const raw = allMap.get(id);
      const isDomain = this.domainSpellIds().includes(id);
      return {
        refId: id,
        name: raw?.name ?? id,
        level: raw?.level ?? 1,
        prepared: true,
        alwaysPrepared: isDomain,
        effectSummary: this.extractEffect(raw),
      };
    });

    const mysticArcanum = this.arcanumSpellLevels().map((spellLevel) => {
      const spellId = this.arcanumPicks()[spellLevel];
      const raw = spellId ? allMap.get(spellId) : undefined;
      return {
        spellLevel,
        spellId: spellId ?? '',
        spellName: raw?.name ?? spellId ?? '',
      };
    }).filter((a) => !!a.spellId);

    // Inclure les arcanes dans la liste des sorts connus (marqués alwaysPrepared)
    for (const a of mysticArcanum) {
      if (spellInstances.some((s) => s.refId === a.spellId)) continue;
      const raw = allMap.get(a.spellId);
      spellInstances.push({
        refId: a.spellId,
        name: a.spellName,
        level: a.spellLevel,
        prepared: true,
        alwaysPrepared: true,
        effectSummary: `Arcane (1× / repos long) · ${this.extractEffect(raw)}`,
      });
    }

    const spellMastery = ([1, 2] as const)
      .map((spellLevel) => {
        const spellId = this.masteryPicks()[spellLevel];
        if (!spellId) return null;
        const raw = allMap.get(spellId);
        return {
          spellLevel,
          spellId,
          spellName: raw?.name ?? spellId,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);

    const signatureSpells = this.signatureIds().slice(0, 2).map((spellId) => {
      const raw = allMap.get(spellId);
      return { spellId, spellName: raw?.name ?? spellId };
    });

    // Sorts attitrés : toujours préparés
    for (const s of signatureSpells) {
      const existing = spellInstances.find((x) => x.refId === s.spellId);
      if (existing) {
        existing.alwaysPrepared = true;
        existing.effectSummary = `Sort attitré (1× / repos long) · ${existing.effectSummary}`;
      }
    }
    // Maîtrise : annotation
    for (const m of spellMastery) {
      const existing = spellInstances.find((x) => x.refId === m.spellId);
      if (existing) {
        existing.effectSummary = `Maîtrise (à volonté) · ${existing.effectSummary}`;
      }
    }

    const oathSpells = this.subclassBonusSpells
      .filter((g) => (g.level_unlocked ?? 99) <= this.builder.targetLevel())
      .map((g) => ({
        characterLevel: g.level_unlocked ?? 0,
        spells: (g.spells ?? []).map((id) => allMap.get(id)?.name ?? id),
      }))
      .filter((g) => g.spells.length > 0);

    const deity = this.deities().find((d) => d.id === this.selectedDeityId());

    const details = {
      cantrips: cantripInstances,
      spells: spellInstances,
      deity: deity?.name ?? '',
      deityId: deity?.id ?? '',
      domain: this.builder.creation().subclassName ?? '',
      domainId: this.builder.creation().subclassId ?? '',
      hasFullSpellList: this.quota()?.hasFullListAccess ?? false,
      preparedCount: this.quota()?.preparedSpells ?? 0,
      patron: this.builder.creation().subclassName ?? '',
      arcaneTradition: this.builder.creation().subclassName ?? '',
      mysticArcanum,
      spellMastery,
      signatureSpells,
      oathSpells,
    };

    const arcanumRecord: Record<string, string> = {};
    for (const a of mysticArcanum) arcanumRecord[String(a.spellLevel)] = a.spellId;
    const masteryRecord: Record<string, string> = {};
    for (const m of spellMastery) masteryRecord[String(m.spellLevel)] = m.spellId;

    this.builder.creation.update((c) => ({
      ...c,
      spellcastingDetails: details,
      mysticArcanumPicks: arcanumRecord,
      spellMasteryPicks: masteryRecord,
      signatureSpellIds: signatureSpells.map((s) => s.spellId),
    }));
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
    const amountStr = dur.amount != null ? String(dur.amount) : '';
    const unitStr = (dur.unit ?? '').toLowerCase();
    if (!amountStr && !unitStr) return 'Instantanée';
    if (
      amountStr === 'instantanee' ||
      amountStr === 'instantané' ||
      amountStr === 'instantanée' ||
      unitStr === 'instantane' ||
      unitStr === 'instantanée'
    ) {
      return 'Instantanée';
    }

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
    this.selectedDeityId.set(null);
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
    const amount = s.range.amount != null ? String(s.range.amount) : '';
    const unit = (s.range.unit ?? '').toLowerCase();
    if (!amount && !unit) return 'Personnel';
    if (amount === 'personnelle' || amount === 'personnel' || unit === 'personnelle') {
      return 'Personnel';
    }
    if (amount === 'contact' || unit === 'contact') return 'Contact';
    if (unit === 'm' || unit === 'mètre' || unit === 'metres') {
      return `${amount} m`;
    }
    return `${amount}${s.range.unit ? ' ' + s.range.unit : ''}`.trim() || '—';
  }

  componentsLabel(s: Spell): string {
    const parts: string[] = [];
    if (s.components.v) parts.push('V');
    if (s.components.s) parts.push('S');
    if (s.components.m) parts.push('M');
    return parts.join(', ') || '—';
  }

  durationLabel(s: Spell): string {
    const amount = s.duration.amount != null ? String(s.duration.amount) : '';
    const unit = (s.duration.unit ?? '').toLowerCase();
    if (!amount && !unit) return 'Instantané';
    if (
      amount === 'instantanee' ||
      amount === 'instantané' ||
      amount === 'instantanée' ||
      unit === 'instantane' ||
      unit === 'instantanée'
    ) {
      return 'Instantané';
    }
    if (
      amount.includes('dissipation') ||
      unit.includes('dissipation')
    ) {
      return "Jusqu'à dissipation";
    }
    return `${amount}${s.duration.unit ? ' ' + s.duration.unit : ''}`.trim() || '—';
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
    const arcanumIds = new Set(
      ((details?.mysticArcanum ?? []) as { spellId: string }[])
        .map((a) => a.spellId)
        .filter(Boolean),
    );
    if (details?.cantrips) {
      this.selectedCantrips.set(new Set(details.cantrips.map((c: any) => c.refId)));
    }
    if (details?.spells) {
      this.selectedSpells.set(
        new Set(
          details.spells
            .filter((s: any) => !s.alwaysPrepared && !arcanumIds.has(s.refId))
            .map((s: any) => s.refId),
        ),
      );
    }
    if (details?.deity) {
      const match = this.deities().find((d) => d.name === details.deity);
      if (match) this.selectedDeityId.set(match.id);
    }
    const fromDetails = details?.mysticArcanum as
      | { spellLevel: number; spellId: string }[]
      | undefined;
    const fromCreation = this.builder.creation().mysticArcanumPicks ?? {};
    const picks: Record<number, string> = {};
    if (fromDetails?.length) {
      for (const a of fromDetails) {
        if (a.spellId) picks[a.spellLevel] = a.spellId;
      }
    } else {
      for (const [k, v] of Object.entries(fromCreation)) {
        const lvl = Number(k);
        if (v) picks[lvl] = v;
      }
    }
    this.arcanumPicks.set(picks);

    const masteryFromDetails = details?.spellMastery as
      | { spellLevel: number; spellId: string }[]
      | undefined;
    const masteryFromCreation = this.builder.creation().spellMasteryPicks ?? {};
    const mastery: Record<number, string> = {};
    if (masteryFromDetails?.length) {
      for (const m of masteryFromDetails) {
        if (m.spellId) mastery[m.spellLevel] = m.spellId;
      }
    } else {
      for (const [k, v] of Object.entries(masteryFromCreation)) {
        if (v) mastery[Number(k)] = v;
      }
    }
    this.masteryPicks.set(mastery);

    const sigFromDetails = details?.signatureSpells as { spellId: string }[] | undefined;
    const sigFromCreation = this.builder.creation().signatureSpellIds ?? [];
    this.signatureIds.set(
      sigFromDetails?.length
        ? sigFromDetails.map((s) => s.spellId).filter(Boolean)
        : [...sigFromCreation],
    );
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

  getCardClasses(school: string, isSelected: boolean): string {
    if (!isSelected) return 'border-slate-800 hover:border-slate-600 shadow-md';
    switch (this.getSchoolKey(school)) {
      case 'abjuration':
        return 'border-2 border-cyan-500';
      case 'conjuration':
      case 'invocation':
        return 'border-2 border-yellow-500';
      case 'divination':
        return 'border-2 border-indigo-500';
      case 'enchantement':
        return 'border-2 border-fuchsia-500';
      case 'evocation':
        return 'border-2 border-red-500';
      case 'illusion':
        return 'border-2 border-purple-500';
      case 'necromancie':
        return 'border-2 border-lime-500';
      case 'transmutation':
        return 'border-2 border-orange-500';
      default:
        return 'border-2 border-slate-500';
    }
  }

  getTextClasses(school: string, isSelected: boolean): string {
    if (!isSelected) return 'text-slate-300 group-hover:text-slate-100';
    switch (this.getSchoolKey(school)) {
      case 'abjuration':
        return 'text-cyan-400';
      case 'conjuration':
      case 'invocation':
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
      case 'invocation':
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
      case 'invocation':
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
