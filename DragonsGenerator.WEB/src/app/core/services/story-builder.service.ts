import { Injectable, computed, effect, signal } from '@angular/core';
import {
  AdventureTone,
  CreatureRole,
  StoryCreatureSelection,
  StoryRegionChoice,
} from '../models/Story/story';
import { CampaignData, CampaignDetail, EncounterGroup, emptyCampaignData } from '../models/Campaign/campaign';
import { CreatureSummary } from '../models/Creatures/creature-summary';
import {
  getLevelRangePreset,
  partyLevelFromRange,
  pickCreaturesForLevelRange,
} from '../utils/story-creature-picker.util';
import { campaignRegionFields, campaignRegionFromData } from '../utils/story-location.util';

export type CreatureSelectionMode = 'manual' | 'auto';

const STORAGE_KEY = 'dragon_story_builder_v1';

export interface StoryStep {
  number: number;
  title: string;
}

@Injectable({ providedIn: 'root' })
export class StoryBuilderService {
  readonly currentStep = signal(1);
  readonly totalSteps = 4;

  readonly title = signal('');
  readonly setting = signal('');
  readonly region = signal<StoryRegionChoice | null>(null);
  readonly partyLevel = signal(3);
  readonly tone = signal<AdventureTone>('classic');
  readonly creatures = signal<StoryCreatureSelection[]>([]);
  readonly adventure = signal('');
  readonly selectionMode = signal<CreatureSelectionMode>('auto');
  readonly levelRangeId = signal('3-4');
  readonly autoCreatureCount = signal(4);

  /** When set, the wizard updates this cloud campaign instead of creating a new one. */
  readonly editingCampaignId = signal<string | null>(null);
  readonly preservedEncounters = signal<EncounterGroup[]>([]);
  readonly preservedNotes = signal('');

  readonly isEditingCampaign = computed(() => this.editingCampaignId() !== null);

  readonly steps = computed<StoryStep[]>(() => [
    { number: 1, title: 'Créatures' },
    { number: 2, title: 'Personnages' },
    { number: 3, title: 'Aventure' },
    { number: 4, title: 'Récapitulatif' },
  ]);

  readonly draftSummary = computed(() => {
    const count = this.creatures().length;
    const t = this.title().trim();
    if (t) return t;
    if (count > 0) return `${count} créature(s) sélectionnée(s)`;
    return 'Nouveau scénario';
  });

  constructor() {
    this.loadDraft();
    effect(() => {
      this.saveDraft();
    });
  }

  hasPendingDraft(): boolean {
    return this.creatures().length > 0 || !!this.title().trim() || !!this.adventure().trim();
  }

  isStepValid(step: number): boolean {
    switch (step) {
      case 1:
        if (this.selectionMode() === 'manual') {
          return this.creatures().length >= 1 && this.creatures().length <= 20;
        }
        return !!getLevelRangePreset(this.levelRangeId());
      case 2:
        return this.creatures().every((c) => c.customName.trim().length >= 2);
      case 3:
        return (
          this.title().trim().length >= 3 &&
          !!this.adventure().trim() &&
          this.region() !== null
        );
      case 4:
        return true;
      default:
        return false;
    }
  }

  nextStep(): void {
    if (this.currentStep() < this.totalSteps && this.isStepValid(this.currentStep())) {
      this.currentStep.update((s) => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  previousStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update((s) => s - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  goToStep(step: number): void {
    if (step >= 1 && step <= this.totalSteps) {
      this.currentStep.set(step);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  setSelectionMode(mode: CreatureSelectionMode): void {
    this.selectionMode.set(mode);
    if (mode === 'auto') {
      this.creatures.set([]);
    }
  }

  autoPickCreatures(allCreatures: CreatureSummary[]): boolean {
    const preset = getLevelRangePreset(this.levelRangeId());
    if (!preset) return false;

    const picked = pickCreaturesForLevelRange(allCreatures, preset, this.autoCreatureCount());
    if (picked.length === 0) return false;

    this.creatures.set(picked);
    this.partyLevel.set(partyLevelFromRange(preset));
    return true;
  }

  toggleCreature(entry: Omit<StoryCreatureSelection, 'customName' | 'role' | 'backstory'>): void {
    this.creatures.update((list) => {
      const exists = list.find((c) => c.creatureId === entry.creatureId);
      if (exists) return list.filter((c) => c.creatureId !== entry.creatureId);
      if (list.length >= 20) return list;
      return [
        ...list,
        {
          ...entry,
          customName: entry.creatureName,
          role: 'neutral' as CreatureRole,
          backstory: '',
        },
      ];
    });
  }

  isCreatureSelected(creatureId: string): boolean {
    return this.creatures().some((c) => c.creatureId === creatureId);
  }

  updateCreature(creatureId: string, patch: Partial<StoryCreatureSelection>): void {
    this.creatures.update((list) =>
      list.map((c) => (c.creatureId === creatureId ? { ...c, ...patch } : c)),
    );
  }

  removeCreature(creatureId: string): void {
    this.creatures.update((list) => list.filter((c) => c.creatureId !== creatureId));
  }

  setAdventure(text: string): void {
    this.adventure.set(text);
  }

  setRegion(region: StoryRegionChoice): void {
    this.region.set(region);
  }

  loadCampaignIntoBuilder(campaign: CampaignDetail): void {
    this.editingCampaignId.set(campaign.id);
    this.preservedEncounters.set(structuredClone(campaign.data.encounters ?? []));
    this.preservedNotes.set(campaign.data.notes ?? '');
    this.title.set(campaign.title);
    this.setting.set(campaign.data.setting ?? '');
    this.region.set(campaignRegionFromData(campaign.data.regionId, campaign.data.regionName));
    this.partyLevel.set(campaign.data.partyLevel);
    this.tone.set(campaign.data.tone);
    this.creatures.set(structuredClone(campaign.data.creatures ?? []));
    this.adventure.set(campaign.data.adventure ?? '');
    this.selectionMode.set('manual');
    this.currentStep.set(1);
  }

  buildCampaignData(): CampaignData {
    const regionFields = campaignRegionFields(this.region());
    return {
      ...emptyCampaignData(this.partyLevel()),
      setting: this.setting().trim(),
      ...regionFields,
      partyLevel: this.partyLevel(),
      tone: this.tone(),
      adventure: this.adventure().trim(),
      creatures: this.creatures(),
      encounters: structuredClone(this.preservedEncounters()),
      notes: this.preservedNotes(),
    };
  }

  reset(): void {
    this.currentStep.set(1);
    this.title.set('');
    this.setting.set('');
    this.region.set(null);
    this.partyLevel.set(3);
    this.tone.set('classic');
    this.creatures.set([]);
    this.adventure.set('');
    this.selectionMode.set('auto');
    this.levelRangeId.set('3-4');
    this.autoCreatureCount.set(4);
    this.editingCampaignId.set(null);
    this.preservedEncounters.set([]);
    this.preservedNotes.set('');
    localStorage.removeItem(STORAGE_KEY);
  }

  private saveDraft(): void {
    const draft = {
      currentStep: this.currentStep(),
      title: this.title(),
      setting: this.setting(),
      region: this.region(),
      partyLevel: this.partyLevel(),
      tone: this.tone(),
      creatures: this.creatures(),
      adventure: this.adventure(),
      selectionMode: this.selectionMode(),
      levelRangeId: this.levelRangeId(),
      autoCreatureCount: this.autoCreatureCount(),
      editingCampaignId: this.editingCampaignId(),
      preservedEncounters: this.preservedEncounters(),
      preservedNotes: this.preservedNotes(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }

  private loadDraft(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.currentStep) this.currentStep.set(draft.currentStep);
      if (draft.title) this.title.set(draft.title);
      if (draft.setting) this.setting.set(draft.setting);
      if (draft.region) this.region.set(draft.region);
      if (draft.partyLevel) this.partyLevel.set(draft.partyLevel);
      if (draft.tone) this.tone.set(draft.tone);
      if (Array.isArray(draft.creatures)) this.creatures.set(draft.creatures);
      if (draft.adventure) this.adventure.set(draft.adventure);
      if (draft.selectionMode) this.selectionMode.set(draft.selectionMode);
      if (draft.levelRangeId) this.levelRangeId.set(draft.levelRangeId);
      if (draft.autoCreatureCount) this.autoCreatureCount.set(draft.autoCreatureCount);
      if (draft.editingCampaignId) this.editingCampaignId.set(draft.editingCampaignId);
      if (Array.isArray(draft.preservedEncounters)) {
        this.preservedEncounters.set(draft.preservedEncounters);
      }
      if (typeof draft.preservedNotes === 'string') {
        this.preservedNotes.set(draft.preservedNotes);
      }
    } catch {
      /* ignore corrupt draft */
    }
  }
}
