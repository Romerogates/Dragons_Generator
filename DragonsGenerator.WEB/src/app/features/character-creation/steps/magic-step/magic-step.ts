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
import type { CharacterClass, Subclass } from '@core/models/CharacterClasses/character-class';
import { warlockArcanumSpellLevels, spellProgressionMilestones } from '@core/utils/progression-choices.util';
import { collectCasterSources, type CasterSource } from '@core/utils/class-spellcasting.util';
import { maxSpellLevelFromSlots } from '@core/utils/feature-uses.util';
import {
  resolveSpellQuota,
  spellPickCount,
  type SpellQuota,
} from '@core/utils/spell-quota.util';
import {
  spellCastTimeLabel,
  spellComponentsLabel,
  spellDurationLabel,
  spellRangeLabel,
  spellSchoolLabel,
  spellStatsLine,
  SPELL_SCHOOL_LABELS,
} from '@core/utils/spell-display.util';

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

interface SpellDetailEntry {
  refId: string;
  name?: string;
  level?: number;
  prepared?: boolean;
  alwaysPrepared?: boolean;
  effectSummary?: string;
}

/** Forme brouillon de `creation.spellcastingDetails` lue / écrite par l’étape Magie. */
interface SpellcastingDetailsDraft {
  cantrips?: SpellDetailEntry[];
  spells?: SpellDetailEntry[];
  deity?: string;
  deityId?: string | null;
  mysticArcanum?: { spellLevel: number; spellId: string }[];
  spellMastery?: { spellLevel: number; spellId: string }[];
  signatureSpells?: { spellId: string }[];
  byClass?: Record<string, { cantrips?: string[]; spells?: string[]; deityId?: string | null }>;
}

interface BonusSpellGrant {
  level_unlocked?: number;
  spells?: string[];
}

interface SubclassWithBonusSpells extends Subclass {
  bonus_spells_granted?: BonusSpellGrant[];
  bonus_spells_by_terrain?: Record<string, { grants?: BonusSpellGrant[] }>;
}

function subclassOptions(cls: CharacterClass | null | undefined): SubclassWithBonusSpells[] {
  const raw = cls?.data?.subclasses;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as SubclassWithBonusSpells[];
  return (raw.options ?? []) as SubclassWithBonusSpells[];
}

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
  private readonly loadedClass = signal<CharacterClass | null>(null);
  private readonly loadedClasses = signal<Map<string, CharacterClass>>(new Map());
  readonly activeCasterIndex = signal(0);
  private picksByClass: Record<
    string,
    { cantrips: string[]; spells: string[]; deityId: string | null }
  > = {};

  readonly selectedCantrips = signal<Set<string>>(new Set());
  readonly selectedSpells = signal<Set<string>>(new Set());
  /** Recherche / filtres de la liste de sorts. */
  readonly spellSearchQuery = signal('');
  readonly spellSchoolFilter = signal('');
  readonly spellTagFilter = signal<'all' | 'selected' | 'concentration' | 'ritual'>('all');
  /** Sorts raciaux (espèce) : choiceId → spellId */
  readonly racialCantripPicks = signal<Record<string, string>>({});
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
      const caster = this.activeCaster();
      const cls = this.loadedClass();
      if (!cls) return;
      void caster?.level;
      void this.builder.abilityModifiers();
      untracked(() => {
        this.applyClassSpellData(cls);
        this.trimSelectionsToQuota();
      });
    });
  }

  // === Computed ===

  readonly casterSources = computed<CasterSource[]>(() =>
    collectCasterSources(this.builder.creation() as never),
  );

  readonly activeCaster = computed<CasterSource | null>(() => {
    const sources = this.casterSources();
    if (!sources.length) return null;
    return sources[this.activeCasterIndex()] ?? sources[0] ?? null;
  });

  readonly spellcastingKind = computed<SpellcastingKind | null>(
    () => this.activeCaster()?.kind ?? this.builder.creation().spellcastingKind,
  );

  readonly racialSpellGrants = computed(() => this.builder.creation().racialSpellGrants ?? []);

  readonly hasClassSpellcasting = computed(() => this.casterSources().length > 0);

  readonly racialSpellsComplete = computed(() =>
    this.racialSpellGrants().every((g) => {
      const pick = this.racialCantripPicks()[g.choiceId];
      return !!pick && pick !== 'any_wizard_cantrip';
    }),
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
    return warlockArcanumSpellLevels(this.casterLevel());
  });

  readonly spellMilestones = computed(() => {
    const cls = this.loadedClass();
    if (!cls) return [];
    return spellProgressionMilestones(cls, this.casterLevel());
  });

  readonly arcanumComplete = computed(() => {
    const levels = this.arcanumSpellLevels();
    if (!levels.length) return true;
    const picks = this.arcanumPicks();
    return levels.every((lvl) => !!picks[lvl]);
  });

  /** Magicien L17 : maîtrise 1 sort niv.1 + 1 niv.2 parmi le grimoire. */
  readonly needsSpellMastery = computed(
    () => this.isWizard() && this.casterLevel() >= 17,
  );
  /** Magicien L19 : 2 sorts attitrés de niv.3. */
  readonly needsSignatureSpells = computed(
    () => this.isWizard() && this.casterLevel() >= 19,
  );

  readonly masteryComplete = computed(() => {
    if (!this.needsSpellMastery()) return true;
    const p = this.masteryPicks();
    const ids = this.selectedSpells();
    return !!p[1] && !!p[2] && ids.has(p[1]) && ids.has(p[2]);
  });

  readonly signatureComplete = computed(() => {
    if (!this.needsSignatureSpells()) return true;
    const ids = this.selectedSpells();
    return this.signatureIds().filter((id) => ids.has(id)).length >= 2;
  });

  /** Sorts du grimoire/préparés pour un niveau donné (candidats maîtrise / attitrés). */
  preparedSpellsOfLevel(level: number): Spell[] {
    const ids = this.selectedSpells();
    const list = this.allSpells()
      .filter((s) => s.level === level && ids.has(s.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    return this.filterSpellList(list, 'mastery');
  }

  spellsForArcanum(level: number): Spell[] {
    return this.filterSpellList(this.spellsForClass(level), 'arcanum');
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
    if (this.spellcastingKind() === 'druid') return 'Sorts de terrain (toujours préparés)';
    return 'Sorts bonus (toujours préparés)';
  });

  readonly classId = computed(() => this.activeCaster()?.classId ?? this.builder.creation().classId);

  readonly activeSubclassId = computed(
    () => this.activeCaster()?.subclassId ?? this.builder.creation().subclassId,
  );

  readonly casterLevel = computed(
    () => this.activeCaster()?.level ?? this.builder.targetLevel(),
  );

  readonly quota = computed<SpellQuota | null>(() => {
    const fromClass = this.classQuota();
    if (fromClass) return fromClass;
    return resolveSpellQuota({
      cls: this.loadedClass(),
      kind: this.spellcastingKind(),
      classLevel: this.casterLevel(),
      abilityModifiers: this.builder.abilityModifiers(),
      bonusCantrips: this.activeSubclassId() === 'subcls-cercle-de-la-terre' ? 1 : 0,
    });
  });

  readonly spellcastingAbility = computed(
    () => this.activeCaster()?.ability ?? this.builder.creation().spellcastingAbility,
  );

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

  /** Niveau de sort max accessible (selon emplacements JSON ou repli SRD). */
  readonly maxSpellLevel = computed(() => {
    const kind = this.spellcastingKind();
    const level = this.casterLevel();
    const fromJson = this.activeCaster()?.isPrimary
      ? maxSpellLevelFromSlots(this.builder.creation().classSpellSlots)
      : 0;
    if (fromJson > 0) return fromJson;
    if (!kind) return 1;
    if (kind === 'warlock') {
      if (level >= 9) return 5;
      if (level >= 7) return 4;
      if (level >= 5) return 3;
      if (level >= 3) return 2;
      return 1;
    }
    const half = kind === 'paladin' || kind === 'ranger';
    const third = kind === 'fighter_eldritch_knight';
    if (third) {
      if (level < 3) return 0;
      if (level >= 19) return 4;
      if (level >= 13) return 3;
      if (level >= 7) return 2;
      return 1;
    }
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
    const targetLevel = this.casterLevel();
    const kind = this.spellcastingKind();
    return this.allSpells()
      .filter((s) => s.level === level)
      .filter((s) => {
        if (!classId) return true;
        if (!s.classes?.length) return false;
        if (s.classes.includes(classId)) return true;
        // Secrets magiques (barde L10+) : sorts de niv. ≤ 5 de toute classe
        if (kind === 'bard' && targetLevel >= 10 && level <= 5) return true;
        return false;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Cantrips disponibles (level 0) pour la classe. */
  readonly availableCantrips = computed(() => this.spellsForClass(0));

  /** Cantrips après recherche / filtres. */
  readonly filteredCantrips = computed(() =>
    this.filterSpellList(this.availableCantrips(), 'cantrip'),
  );

  /** Sorts mineurs de magicien pour les octrois raciaux (ex. Elfe). */
  availableRacialCantrips(grant: { pool: string[]; spellLevel?: number }): Spell[] {
    const level = grant.spellLevel ?? 0;
    const pool = grant.pool ?? [];
    const list = this.allSpells()
      .filter((s) => s.level === level)
      .filter((s) => {
        if (pool.includes('any_wizard_cantrip')) {
          return s.classes?.includes('cls-magicien') ?? false;
        }
        return pool.includes(s.id);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return this.filterSpellList(list, 'racial');
  }

  pickRacialCantrip(choiceId: string, spellId: string): void {
    this.racialCantripPicks.update((m) => {
      const next = { ...m };
      if (next[choiceId] === spellId) delete next[choiceId];
      else next[choiceId] = spellId;
      return next;
    });
  }

  isRacialCantripSelected(choiceId: string, spellId: string): boolean {
    return this.racialCantripPicks()[choiceId] === spellId;
  }

  racialAbilityLabel(code: string): string {
    const map: Record<string, string> = {
      int: 'Intelligence',
      wis: 'Sagesse',
      cha: 'Charisme',
    };
    return map[code.toLowerCase()] ?? code;
  }

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

  readonly availableLevel1 = computed(() =>
    this.filterSpellList(this.availableLeveledSpells(), 'leveled'),
  );

  readonly spellSchoolOptions = computed(() => {
    const keys = new Set<string>();
    for (const s of this.availableCantrips()) keys.add(this.getSchoolKey(s.school));
    for (const s of this.availableLeveledSpells()) keys.add(this.getSchoolKey(s.school));
    return [...keys]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => ({
        key,
        label: SPELL_SCHOOL_LABELS[key] ?? spellSchoolLabel(key),
      }));
  });

  readonly spellFiltersActive = computed(
    () =>
      !!this.spellSearchQuery().trim() ||
      !!this.spellSchoolFilter() ||
      this.spellTagFilter() !== 'all',
  );

  onSpellSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.spellSearchQuery.set(value);
  }

  setSpellSchoolFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement | null)?.value ?? '';
    this.spellSchoolFilter.set(value);
  }

  setSpellTagFilter(tag: 'all' | 'selected' | 'concentration' | 'ritual'): void {
    this.spellTagFilter.set(tag);
  }

  clearSpellFilters(): void {
    this.spellSearchQuery.set('');
    this.spellSchoolFilter.set('');
    this.spellTagFilter.set('all');
  }

  /** Filtre une liste de sorts selon la barre de recherche. */
  filterSpellList(
    spells: Spell[],
    scope: 'cantrip' | 'leveled' | 'racial' | 'arcanum' | 'mastery',
  ): Spell[] {
    const q = this.normalizeSearch(this.spellSearchQuery().trim());
    const school = this.spellSchoolFilter();
    const tag = this.spellTagFilter();
    const selectedCantrips = this.selectedCantrips();
    const selectedSpells = this.selectedSpells();
    const racialPicks = new Set(Object.values(this.racialCantripPicks()));
    const arcanumPicks = new Set(Object.values(this.arcanumPicks()));
    const masteryPicks = new Set(Object.values(this.masteryPicks()));
    const signaturePicks = new Set(this.signatureIds());

    return spells.filter((spell) => {
      if (school && this.getSchoolKey(spell.school) !== school) return false;
      if (tag === 'concentration' && !spell.isConcentration) return false;
      if (tag === 'ritual' && !spell.isRitual) return false;
      if (tag === 'selected') {
        const selected =
          scope === 'cantrip'
            ? selectedCantrips.has(spell.id)
            : scope === 'leveled'
              ? selectedSpells.has(spell.id)
              : scope === 'racial'
                ? racialPicks.has(spell.id)
                : scope === 'arcanum'
                  ? arcanumPicks.has(spell.id)
                  : masteryPicks.has(spell.id) ||
                    signaturePicks.has(spell.id) ||
                    selectedSpells.has(spell.id);
        if (!selected) return false;
      }
      if (!q) return true;
      return this.normalizeSearch(spell.name).includes(q);
    });
  }

  private normalizeSearch(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /** Divinités filtrées (prêtre + domaine compatible). */
  readonly availableDeities = computed(() => {
    const all = this.deities();
    const forCleric = all.filter((d) =>
      (d.grantsPowersTo ?? []).some((g) => g.toLowerCase().includes('pretre')),
    );
    const domainId = SUBCLASS_TO_DOMAIN[this.activeSubclassId() ?? ''];
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
    return Math.max(0, spellPickCount(q) - this.selectedSpells().size);
  });

  /** Nombre total de sorts niv 1 à choisir. */
  readonly spellsToChoose = computed(() => {
    const q = this.quota();
    return q ? spellPickCount(q) : 0;
  });

  readonly selectionComplete = computed(() => {
    if (!this.racialSpellsComplete()) return false;
    if (!this.hasClassSpellcasting()) return true;
    const spellsOk =
      this.cantripsRemaining() === 0 &&
      (this.spellsToChoose() === 0 || this.spellsRemaining() === 0);
    if (this.isCleric() && !this.selectedDeityId()) return false;
    if (!this.arcanumComplete()) return false;
    if (!this.masteryComplete()) return false;
    if (!this.signatureComplete()) return false;
    return spellsOk;
  });

  selectCaster(index: number): void {
    const sources = this.casterSources();
    if (index < 0 || index >= sources.length || index === this.activeCasterIndex()) return;
    this.persistActivePicks();
    this.activeCasterIndex.set(index);
    const next = sources[index];
    const cls = this.loadedClasses().get(next.classId) ?? null;
    this.loadedClass.set(cls);
    this.applyClassSpellData(cls);
    this.restorePicksFor(next.classId);
  }

  private persistActivePicks(): void {
    const id = this.activeCaster()?.classId;
    if (!id) return;
    this.picksByClass[id] = {
      cantrips: [...this.selectedCantrips()],
      spells: [...this.selectedSpells()],
      deityId: this.selectedDeityId(),
    };
  }

  private restorePicksFor(classId: string): void {
    const saved = this.picksByClass[classId];
    if (!saved) {
      this.selectedCantrips.set(new Set());
      this.selectedSpells.set(new Set());
      return;
    }
    this.selectedCantrips.set(new Set(saved.cantrips));
    this.selectedSpells.set(new Set(saved.spells));
    this.selectedDeityId.set(saved.deityId);
  }

  readonly isConfirmed = computed(() => {
    const details = this.builder.creation().spellcastingDetails as SpellcastingDetailsDraft;
    return !!details?.cantrips;
  });

  // === Lifecycle ===

  ngOnInit(): void {
    this.loading.set(true);
    const casterIds = [
      ...new Set(collectCasterSources(this.builder.creation() as never).map((s) => s.classId)),
    ];

    const requests: Record<
      string,
      | ReturnType<DataService['getSpells']>
      | ReturnType<DataService['getDeities']>
      | ReturnType<DataService['getClassById']>
    > = {
      spells: this.dataService.getSpells(),
      deities: this.dataService.getDeities(),
    };
    for (const id of casterIds) {
      requests[`cls:${id}`] = this.dataService.getClassById(id);
    }

    forkJoin(requests).subscribe({
      next: (res) => {
        this.allSpells.set(res['spells'] as Spell[]);
        this.deities.set(res['deities'] as Deity[]);
        const map = new Map<string, CharacterClass>();
        for (const id of casterIds) {
          const cls = res[`cls:${id}`] as CharacterClass | undefined;
          if (cls) map.set(id, cls);
        }
        this.loadedClasses.set(map);
        const first = this.casterSources()[0];
        const firstCls = first ? map.get(first.classId) ?? null : null;
        this.loadedClass.set(firstCls);
        this.applyClassSpellData(firstCls);
        this.loading.set(false);
        this.restoreFromBuilder();
      },
      error: () => {
        this.error.set('Impossible de charger les sorts.');
        this.loading.set(false);
      },
    });
  }

  private applyClassSpellData(cls: CharacterClass | null | undefined): void {
    this.extractDomainSpells(cls);
    this.classQuota.set(this.buildQuotaFromClass(cls));
  }

  private buildQuotaFromClass(cls: CharacterClass | null | undefined): SpellQuota | null {
    return resolveSpellQuota({
      cls,
      kind: this.spellcastingKind(),
      classLevel: this.casterLevel(),
      abilityModifiers: this.builder.abilityModifiers(),
      bonusCantrips: this.activeSubclassId() === 'subcls-cercle-de-la-terre' ? 1 : 0,
    });
  }

  private extractDomainSpells(cls: CharacterClass | null | undefined): void {
    const kind = this.spellcastingKind();
    const subclassId = this.activeSubclassId();
    const options = subclassOptions(cls);
    const sub = options.find((o) => o.id === subclassId);

    if (!cls || !sub) {
      this.domainSpellIds.set([]);
      this.subclassBonusSpells = [];
      return;
    }

    if (kind === 'cleric' || kind === 'paladin') {
      const granted = sub.bonus_spells_granted ?? [];
      this.subclassBonusSpells = granted;
      const ids = granted
        .filter((g) => (g.level_unlocked ?? 99) <= this.casterLevel())
        .flatMap((g) => g.spells ?? []);
      this.domainSpellIds.set([...new Set(ids)]);
      return;
    }

    if (kind === 'druid' && sub.bonus_spells_by_terrain) {
      const answers = this.builder.creation().classChoiceAnswers ?? {};
      const terrain =
        answers['choice-terrain-subcls-cercle-de-la-terre']?.[0] ??
        Object.entries(answers).find(([k]) => /terrain/i.test(k))?.[1]?.[0] ??
        null;
      const terrainBlock = terrain ? sub.bonus_spells_by_terrain[terrain] : null;
      const granted = terrainBlock?.grants ?? [];
      this.subclassBonusSpells = granted;
      const ids = granted
        .filter((g) => (g.level_unlocked ?? 99) <= this.casterLevel())
        .flatMap((g) => g.spells ?? []);
      this.domainSpellIds.set([...new Set(ids)]);
      return;
    }

    this.domainSpellIds.set([]);
    this.subclassBonusSpells = [];
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
    const wasSelected = this.selectedSpells().has(spellId);
    this.selectedSpells.update((set) => {
      const next = new Set(set);
      if (next.has(spellId)) {
        next.delete(spellId);
      } else if (next.size < this.spellsToChoose()) {
        next.add(spellId);
      }
      return next;
    });
    if (wasSelected) {
      this.masteryPicks.update((m) => {
        const next = { ...m };
        for (const lvl of [1, 2] as const) {
          if (next[lvl] === spellId) delete next[lvl];
        }
        return next;
      });
      this.signatureIds.update((arr) => arr.filter((id) => id !== spellId));
    }

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
    if (!this.selectionComplete()) return;

    this.persistActivePicks();
    const mergedCantripIds = new Set<string>();
    const mergedSpellIds = new Set<string>();
    for (const src of this.casterSources()) {
      const p = this.picksByClass[src.classId];
      (p?.cantrips ?? []).forEach((id) => mergedCantripIds.add(id));
      (p?.spells ?? []).forEach((id) => mergedSpellIds.add(id));
    }
    if (!mergedCantripIds.size) this.selectedCantrips().forEach((id) => mergedCantripIds.add(id));
    if (!mergedSpellIds.size) this.selectedSpells().forEach((id) => mergedSpellIds.add(id));

    const allMap = new Map(this.allSpells().map((s) => [s.id, s]));

    const racialCantripInstances = this.racialSpellGrants()
      .map((grant) => {
        const id = this.racialCantripPicks()[grant.choiceId];
        if (!id) return null;
        const raw = allMap.get(id);
        return {
          refId: id,
          name: raw?.name ?? id,
          level: 0,
          prepared: true,
          effectSummary: `${grant.label} · ${this.extractEffect(raw)}`,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);

    const cantripInstances = [
      ...racialCantripInstances,
      ...[...mergedCantripIds].map((id) => {
        const raw = allMap.get(id);
        return {
          refId: id,
          name: raw?.name ?? id,
          level: 0,
          prepared: true,
          effectSummary: this.extractEffect(raw),
        };
      }),
    ];

    const chosenSpellIds = [...mergedSpellIds];
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
        existing.effectSummary = `Sort attitré (1× / repos court ou long) · ${existing.effectSummary}`;
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
      domain: this.activeCaster()?.subclassName ?? this.builder.creation().subclassName ?? '',
      domainId: this.activeSubclassId() ?? '',
        hasFullSpellList: this.quota()?.hasFullListAccess ?? false,
        preparedCount: this.quota()?.preparedSpells ?? 0,
        byClass: this.picksByClass,
      patron: this.activeCaster()?.subclassName ?? this.builder.creation().subclassName ?? '',
      arcaneTradition: this.activeCaster()?.subclassName ?? this.builder.creation().subclassName ?? '',
      mysticArcanum,
      spellMastery,
      signatureSpells,
      oathSpells,
    };

    const arcanumRecord: Record<string, string> = {};
    for (const a of mysticArcanum) arcanumRecord[String(a.spellLevel)] = a.spellId;
    const masteryRecord: Record<string, string> = {};
    for (const m of spellMastery) masteryRecord[String(m.spellLevel)] = m.spellId;

    this.builder.creation.update((c) => {
      const speciesAnswers = { ...(c.speciesChoiceAnswers ?? {}) };
      for (const grant of this.racialSpellGrants()) {
        const pick = this.racialCantripPicks()[grant.choiceId];
        if (pick) speciesAnswers[grant.choiceId] = [pick];
      }
      return {
        ...c,
        speciesChoiceAnswers: speciesAnswers,
        spellcastingDetails: details,
        mysticArcanumPicks: arcanumRecord,
        spellMasteryPicks: masteryRecord,
        signatureSpellIds: signatureSpells.map((s) => s.spellId),
      };
    });
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
    this.masteryPicks.set({});
    this.signatureIds.set([]);
    this.builder.creation.update((c) => ({
      ...c,
      spellcastingDetails: {},
      spellMasteryPicks: {},
      signatureSpellIds: [],
    }));
  }

  // === Display helpers ===

  schoolLabel(school: string): string {
    return spellSchoolLabel(school);
  }

  castTimeLabel(s: Spell): string {
    return spellCastTimeLabel(s);
  }

  rangeLabel(s: Spell): string {
    return spellRangeLabel(s);
  }

  componentsLabel(s: Spell, detailed = false): string {
    return spellComponentsLabel(s, detailed);
  }

  durationLabel(s: Spell): string {
    return spellDurationLabel(s);
  }

  statsLine(s: Spell): string {
    return spellStatsLine(s);
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
    const racial: Record<string, string> = {};
    const answers = this.builder.creation().speciesChoiceAnswers ?? {};
    for (const grant of this.racialSpellGrants()) {
      const pick = answers[grant.choiceId]?.[0];
      if (pick && pick !== 'any_wizard_cantrip') racial[grant.choiceId] = pick;
    }
    if (Object.keys(racial).length) this.racialCantripPicks.set(racial);
    const racialIds = new Set(Object.values(racial));

    const details = this.builder.creation().spellcastingDetails as SpellcastingDetailsDraft;
    const arcanumIds = new Set(
      (details?.mysticArcanum ?? [])
        .map((a) => a.spellId)
        .filter(Boolean),
    );
    if (details?.cantrips) {
      const byClass = details.byClass;
      const activeId = this.activeCaster()?.classId;
      const fromClass = activeId ? byClass?.[activeId]?.cantrips : undefined;
      const cantripIds = fromClass ?? details.cantrips.map((c) => c.refId);
      this.selectedCantrips.set(
        new Set(cantripIds.filter((id): id is string => typeof id === 'string' && !racialIds.has(id))),
      );
      if (byClass) {
        for (const [id, p] of Object.entries(byClass)) {
          this.picksByClass[id] = {
            cantrips: p.cantrips ?? [],
            spells: p.spells ?? [],
            deityId: p.deityId ?? null,
          };
        }
      }
    }
    if (details?.spells) {
      this.selectedSpells.set(
        new Set(
          details.spells
            .filter((s) => !s.alwaysPrepared && !arcanumIds.has(s.refId))
            .map((s) => s.refId),
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
