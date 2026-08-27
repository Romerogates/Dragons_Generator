import { Injectable, computed, effect, signal } from '@angular/core';
import {
  AdventureTone,
  CreatureRole,
  RpgStory,
  StoryCreatureSelection,
} from '../models/Story/story';
import { CreatureSummary } from '../models/Creatures/creature-summary';
import {
  getLevelRangePreset,
  partyLevelFromRange,
  pickCreaturesForLevelRange,
} from '../utils/story-creature-picker.util';

export type CreatureSelectionMode = 'manual' | 'auto';

const STORAGE_KEY = 'dragon_story_builder_v1';
const SAVED_STORIES_KEY = 'dragons-stories';

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
  readonly partyLevel = signal(3);
  readonly tone = signal<AdventureTone>('classic');
  readonly creatures = signal<StoryCreatureSelection[]>([]);
  readonly adventure = signal('');
  readonly selectionMode = signal<CreatureSelectionMode>('auto');
  readonly levelRangeId = signal('3-4');
  readonly autoCreatureCount = signal(4);

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
        return this.title().trim().length >= 3 && !!this.adventure().trim();
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

  reset(): void {
    this.currentStep.set(1);
    this.title.set('');
    this.setting.set('');
    this.partyLevel.set(3);
    this.tone.set('classic');
    this.creatures.set([]);
    this.adventure.set('');
    this.selectionMode.set('auto');
    this.levelRangeId.set('3-4');
    this.autoCreatureCount.set(4);
    localStorage.removeItem(STORAGE_KEY);
  }

  saveToLibrary(): RpgStory {
    const now = new Date().toISOString();
    const story: RpgStory = {
      id: crypto.randomUUID?.() ?? `story-${Date.now()}`,
      title: this.title().trim() || 'Aventure sans titre',
      setting: this.setting().trim(),
      partyLevel: this.partyLevel(),
      tone: this.tone(),
      creatures: this.creatures(),
      adventure: this.adventure(),
      createdAt: now,
      updatedAt: now,
    };

    const saved = this.loadSavedStories();
    saved.unshift(story);
    localStorage.setItem(SAVED_STORIES_KEY, JSON.stringify(saved));
    return story;
  }

  loadSavedStories(): RpgStory[] {
    try {
      const raw = localStorage.getItem(SAVED_STORIES_KEY);
      return raw ? (JSON.parse(raw) as RpgStory[]) : [];
    } catch {
      return [];
    }
  }

  deleteSavedStory(id: string): void {
    const saved = this.loadSavedStories().filter((s) => s.id !== id);
    localStorage.setItem(SAVED_STORIES_KEY, JSON.stringify(saved));
  }

  loadStoryIntoBuilder(story: RpgStory): void {
    this.title.set(story.title);
    this.setting.set(story.setting);
    this.partyLevel.set(story.partyLevel);
    this.tone.set(story.tone);
    this.creatures.set(story.creatures);
    this.adventure.set(story.adventure);
    this.selectionMode.set('manual');
    this.currentStep.set(4);
  }

  private saveDraft(): void {
    const draft = {
      currentStep: this.currentStep(),
      title: this.title(),
      setting: this.setting(),
      partyLevel: this.partyLevel(),
      tone: this.tone(),
      creatures: this.creatures(),
      adventure: this.adventure(),
      selectionMode: this.selectionMode(),
      levelRangeId: this.levelRangeId(),
      autoCreatureCount: this.autoCreatureCount(),
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
      if (draft.partyLevel) this.partyLevel.set(draft.partyLevel);
      if (draft.tone) this.tone.set(draft.tone);
      if (Array.isArray(draft.creatures)) this.creatures.set(draft.creatures);
      if (draft.adventure) this.adventure.set(draft.adventure);
      if (draft.selectionMode) this.selectionMode.set(draft.selectionMode);
      if (draft.levelRangeId) this.levelRangeId.set(draft.levelRangeId);
      if (draft.autoCreatureCount) this.autoCreatureCount.set(draft.autoCreatureCount);
    } catch {
      /* ignore corrupt draft */
    }
  }
}
