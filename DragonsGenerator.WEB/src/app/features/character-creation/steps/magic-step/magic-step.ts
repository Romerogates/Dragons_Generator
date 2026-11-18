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
import type { SpellcastingKind } from '@core/models/Character/character';
import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import { warlockArcanumSpellLevels, spellProgressionMilestones } from '@core/utils/progression-choices.util';
import { collectCasterSources, type CasterSource } from '@core/utils/class-spellcasting.util';
import { maxSpellLevelFromSlots } from '@core/utils/feature-uses.util';
import {
  resolveSpellQuota,
  spellPickCount,
  type SpellQuota,
} from '@core/utils/spell-quota.util';
import { filterSpellList as filterSpellListByQuery, spellSchoolKey } from '@core/utils/magic-spell-filter.util';
import {
  magicBadgeClasses,
  magicCardClasses,
  magicCheckboxClasses,
  magicTextClasses,
} from './magic-step-theme.util';
import {
  spellCastTimeLabel,
  spellComponentsLabel,
  spellDurationLabel,
  spellRangeLabel,
  spellSchoolLabel,
  spellStatsLine,
  SPELL_SCHOOL_LABELS,
} from '@core/utils/spell-display.util';
import { labelForGameId } from '@core/utils/game-id-labels';
import {
  SUBCLASS_TO_DOMAIN,
  type SpellcastingDetailsDraft,
  type SubclassWithBonusSpells,
} from './magic-step.types';
import { magicAbilityToKey, restoreMagicDraft } from './magic-step-restore.util';
import { persistMagicDraft } from './magic-step-persist.util';
import { MagicCasterTabs } from './magic-caster-tabs/magic-caster-tabs';
import { MagicArcanumPanel } from './magic-arcanum-panel/magic-arcanum-panel';

export type { SpellRaw } from './magic-step.types';

function subclassOptions(cls: CharacterClass | null | undefined): SubclassWithBonusSpells[] {
  const raw = cls?.data?.subclasses;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as SubclassWithBonusSpells[];
  return (raw.options ?? []) as SubclassWithBonusSpells[];
}

// ============================================================================
// COMPOSANT
// ============================================================================

@Component({
  selector: 'app-magic-step',
  standalone: true,
  imports: [CommonModule, MagicCasterTabs, MagicArcanumPanel],
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
  /** Tick pour rendre les quotas multi-sources réactifs dans l’UI. */
  private readonly picksVersion = signal(0);

  readonly selectedCantrips = signal<Set<string>>(new Set());
  readonly selectedSpells = signal<Set<string>>(new Set());
  /** Recherche / filtres de la liste de sorts. */
  readonly spellSearchQuery = signal('');
  readonly spellSchoolFilter = signal('');
  readonly spellTagFilter = signal<'all' | 'selected' | 'concentration' | 'ritual'>('all');
  /** Tous | tours de magie | un niveau de sort. */
  readonly spellLevelFilter = signal<'all' | 'cantrip' | number>('all');
  /** Filtres école / tags repliés sous la recherche (mobile). */
  readonly spellFiltersOpen = signal(false);
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

  /** Libellés onglets multi-sources : « Magicien 5 · 3/3 · 6/6 ». */
  readonly casterTabLabels = computed(() => {
    this.picksVersion();
    const activeId = this.activeCaster()?.classId;
    const loaded = this.loadedClasses();
    return this.casterSources().map((src) => {
      const cls = loaded.get(src.classId) ?? null;
      const q = resolveSpellQuota({
        cls,
        kind: src.kind,
        classLevel: src.level,
        abilityModifiers: this.builder.abilityModifiers(),
        bonusCantrips: src.subclassId === 'subcls-cercle-de-la-terre' ? 1 : 0,
      });
      const picks =
        src.classId === activeId
          ? { cantrips: [...this.selectedCantrips()], spells: [...this.selectedSpells()] }
          : this.picksByClass[src.classId];
      const cantripHave = picks?.cantrips?.length ?? 0;
      const spellHave = picks?.spells?.length ?? 0;
      const spellNeed = q ? spellPickCount(q) : 0;
      const parts = [`${src.className} ${src.level}`];
      if (q && q.cantrips > 0) parts.push(`${cantripHave}/${q.cantrips}`);
      if (spellNeed > 0) parts.push(`${spellHave}/${spellNeed}`);
      return parts.join(' · ');
    });
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
    return this.allSpells().find((s) => s.id === id)?.name ?? labelForGameId(id);
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

  pickMastery(spellLevel: number, spellId: string): void {
    if (spellLevel !== 1 && spellLevel !== 2) return;
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
    return this.allSpells().find((s) => s.id === id)?.name ?? labelForGameId(id);
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
    const key = magicAbilityToKey(ability);
    const mod = key ? this.builder.abilityModifiers()[key] : 0;
    return 8 + this.builder.proficiencyBonus() + mod;
  });

  /** Bonus d'attaque des sorts. */
  readonly spellAttackBonus = computed(() => {
    const ability = this.spellcastingAbility();
    if (!ability) return 0;
    const key = magicAbilityToKey(ability);
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
      str: 'Force',
      dex: 'Dextérité',
      con: 'Constitution',
      Force: 'Force',
      Dextérité: 'Dextérité',
      Constitution: 'Constitution',
      Intelligence: 'Intelligence',
      Sagesse: 'Sagesse',
      Charisme: 'Charisme',
    };
    return map[code] ?? map[code.toLowerCase()] ?? code;
  }

  /** Affiche toujours le libellé FR (codes wis/int/… ou labels). */
  abilityDisplay(ability: string | null | undefined): string {
    if (!ability) return '—';
    return this.racialAbilityLabel(ability);
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

  readonly availableLevel1 = computed(() => {
    const list = this.filterSpellList(this.availableLeveledSpells(), 'leveled');
    const lvl = this.spellLevelFilter();
    if (typeof lvl === 'number') return list.filter((s) => s.level === lvl);
    return list;
  });

  readonly showCantripList = computed(() => {
    const filter = this.spellLevelFilter();
    return filter === 'all' || filter === 'cantrip';
  });

  readonly showLeveledList = computed(() => {
    const filter = this.spellLevelFilter();
    return filter === 'all' || typeof filter === 'number';
  });

  readonly spellSchoolOptions = computed(() => {
    const keys = new Set<string>();
    for (const s of this.availableCantrips()) keys.add(spellSchoolKey(s.school));
    for (const s of this.availableLeveledSpells()) keys.add(spellSchoolKey(s.school));
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
      this.spellTagFilter() !== 'all' ||
      this.spellLevelFilter() !== 'all',
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

  setSpellLevelFilter(level: 'all' | 'cantrip' | number): void {
    this.spellLevelFilter.set(level);
  }

  scrollToMagicSection(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  clearSpellFilters(): void {
    this.spellSearchQuery.set('');
    this.spellSchoolFilter.set('');
    this.spellTagFilter.set('all');
    this.spellLevelFilter.set('all');
  }

  /** Filtre une liste de sorts selon la barre de recherche. */
  filterSpellList(
    spells: Spell[],
    scope: 'cantrip' | 'leveled' | 'racial' | 'arcanum' | 'mastery',
  ): Spell[] {
    return filterSpellListByQuery(spells, {
      query: this.spellSearchQuery(),
      school: this.spellSchoolFilter(),
      tag: this.spellTagFilter(),
      scope,
      selectedCantrips: this.selectedCantrips(),
      selectedSpells: this.selectedSpells(),
      racialPicks: new Set(Object.values(this.racialCantripPicks())),
      arcanumPicks: new Set(Object.values(this.arcanumPicks())),
      masteryPicks: new Set(Object.values(this.masteryPicks())),
      signaturePicks: new Set(this.signatureIds()),
    });
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
    this.picksVersion.update((n) => n + 1);
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
    const details = this.builder.creation().spellcastingDetails as SpellcastingDetailsDraft & {
      confirmed?: boolean;
    };
    return details?.confirmed === true;
  });

  continueAfterConfirm(): void {
    if (!this.selectionComplete()) return;
    if (!this.isConfirmed()) {
      this.confirm();
      return;
    }
    this.builder.nextStep();
  }

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
    const allMap = new Map(this.allSpells().map((s) => [s.id, s]));
    const persisted = persistMagicDraft({
      casterClassIds: this.casterSources().map((s) => s.classId),
      picksByClass: this.picksByClass,
      selectedCantrips: this.selectedCantrips(),
      selectedSpells: this.selectedSpells(),
      racialGrants: this.racialSpellGrants().map((g) => ({ choiceId: g.choiceId, label: g.label })),
      racialCantripPicks: this.racialCantripPicks(),
      domainSpellIds: this.domainSpellIds(),
      arcanumLevels: this.arcanumSpellLevels(),
      arcanumPicks: this.arcanumPicks(),
      masteryPicks: this.masteryPicks(),
      signatureIds: this.signatureIds(),
      subclassBonusSpells: this.subclassBonusSpells,
      targetLevel: this.builder.targetLevel(),
      deity: this.deities().find((d) => d.id === this.selectedDeityId()) ?? null,
      domainName: this.activeCaster()?.subclassName ?? this.builder.creation().subclassName ?? '',
      domainId: this.activeSubclassId() ?? '',
      quota: this.quota(),
      spellsById: allMap,
      effectOf: (id) => this.extractEffect(id ? allMap.get(id) : undefined),
    });

    this.builder.creation.update((c) => ({
      ...c,
      speciesChoiceAnswers: { ...(c.speciesChoiceAnswers ?? {}), ...persisted.speciesChoiceAnswersPatch },
      spellcastingDetails: { ...persisted.details },
      mysticArcanumPicks: persisted.mysticArcanumPicks,
      spellMasteryPicks: persisted.spellMasteryPicks,
      signatureSpellIds: persisted.signatureSpellIds,
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

    const dur = spellDurationLabel(raw);
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

  private restoreFromBuilder(): void {
    const creation = this.builder.creation();
    const details = creation.spellcastingDetails as SpellcastingDetailsDraft | undefined;
    const restored = restoreMagicDraft({
      speciesChoiceAnswers: creation.speciesChoiceAnswers ?? {},
      racialChoiceIds: this.racialSpellGrants().map((g) => g.choiceId),
      details,
      activeClassId: this.activeCaster()?.classId ?? null,
      deities: this.deities(),
      mysticArcanumPicks: creation.mysticArcanumPicks ?? {},
      spellMasteryPicks: creation.spellMasteryPicks ?? {},
      signatureSpellIds: creation.signatureSpellIds ?? [],
    });
    if (Object.keys(restored.racialCantripPicks).length) {
      this.racialCantripPicks.set(restored.racialCantripPicks);
    }
    if (details?.cantrips) {
      this.selectedCantrips.set(new Set(restored.selectedCantrips));
      for (const [id, p] of Object.entries(restored.picksByClass)) {
        this.picksByClass[id] = p;
      }
    }
    if (details?.spells) this.selectedSpells.set(new Set(restored.selectedSpells));
    if (restored.selectedDeityId) this.selectedDeityId.set(restored.selectedDeityId);
    this.arcanumPicks.set(restored.arcanumPicks);
    this.masteryPicks.set(restored.masteryPicks);
    this.signatureIds.set(restored.signatureIds);
  }

  getCardClasses(school: string, isSelected: boolean): string {
    return magicCardClasses(school, isSelected);
  }

  getTextClasses(school: string, isSelected: boolean): string {
    return magicTextClasses(school, isSelected);
  }

  getBadgeClasses(school: string): string {
    return magicBadgeClasses(school);
  }

  getCheckboxClasses(school: string, isSelected: boolean): string {
    return magicCheckboxClasses(school, isSelected);
  }
}
