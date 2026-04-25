// features/character-creation/steps/skills-step/skills-step.ts

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
import { FormsModule } from '@angular/forms';
import { CharacterBuilderService } from '../../../../core/services/character-builder.service';
import { type AbilityKey, EquipmentSlot } from '../../../../core/models/Character/character';

export interface SkillInfo {
  id: string;
  label: string;
  ability: string;
  icon: string;
}

export interface SkillGroup {
  name: string;
  abilityKey: AbilityKey;
  icon: string;
  colorClass: string;
  skills: SkillInfo[];
}

export const SKILL_MAP: Record<string, SkillInfo> = {
  'skill-acrobaties': {
    id: 'skill-acrobaties',
    label: 'Acrobaties',
    ability: 'Dextérité',
    icon: 'fluent-emoji:person-cartwheeling',
  },
  'skill-arcanes': {
    id: 'skill-arcanes',
    label: 'Arcanes',
    ability: 'Intelligence',
    icon: 'fluent-emoji:crystal-ball',
  },
  'skill-athletisme': {
    id: 'skill-athletisme',
    label: 'Athlétisme',
    ability: 'Force',
    icon: 'fluent-emoji:flexed-biceps',
  },
  'skill-discretion': {
    id: 'skill-discretion',
    label: 'Discrétion',
    ability: 'Dextérité',
    icon: 'fluent-emoji:ninja',
  },
  'skill-dressage': {
    id: 'skill-dressage',
    label: 'Dressage',
    ability: 'Sagesse',
    icon: 'fluent-emoji:wolf',
  },
  'skill-escamotage': {
    id: 'skill-escamotage',
    label: 'Escamotage',
    ability: 'Dextérité',
    icon: 'fluent-emoji:coin',
  },
  'skill-histoire': {
    id: 'skill-histoire',
    label: 'Histoire',
    ability: 'Intelligence',
    icon: 'fluent-emoji:scroll',
  },
  'skill-intimidation': {
    id: 'skill-intimidation',
    label: 'Intimidation',
    ability: 'Charisme',
    icon: 'fluent-emoji:anger-symbol',
  },
  'skill-intuition': {
    id: 'skill-intuition',
    label: 'Intuition',
    ability: 'Sagesse',
    icon: 'fluent-emoji:eye',
  },
  'skill-investigation': {
    id: 'skill-investigation',
    label: 'Investigation',
    ability: 'Intelligence',
    icon: 'fluent-emoji:magnifying-glass-tilted-right',
  },
  'skill-medecine': {
    id: 'skill-medecine',
    label: 'Médecine',
    ability: 'Sagesse',
    icon: 'fluent-emoji:medical-symbol',
  },
  'skill-nature': {
    id: 'skill-nature',
    label: 'Nature',
    ability: 'Intelligence',
    icon: 'fluent-emoji:herb',
  },
  'skill-perception': {
    id: 'skill-perception',
    label: 'Perception',
    ability: 'Sagesse',
    icon: 'fluent-emoji:ear',
  },
  'skill-persuasion': {
    id: 'skill-persuasion',
    label: 'Persuasion',
    ability: 'Charisme',
    icon: 'fluent-emoji:handshake',
  },
  'skill-religion': {
    id: 'skill-religion',
    label: 'Religion',
    ability: 'Intelligence',
    icon: 'fluent-emoji:prayer-beads',
  },
  'skill-representation': {
    id: 'skill-representation',
    label: 'Représentation',
    ability: 'Charisme',
    icon: 'fluent-emoji:performing-arts',
  },
  'skill-survie': {
    id: 'skill-survie',
    label: 'Survie',
    ability: 'Sagesse',
    icon: 'fluent-emoji:camping',
  },
  'skill-tromperie': {
    id: 'skill-tromperie',
    label: 'Tromperie',
    ability: 'Charisme',
    icon: 'fluent-emoji:joker',
  },
};

@Component({
  selector: 'app-skills-step',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './skills-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SkillsStep implements OnInit {
  readonly builder = inject(CharacterBuilderService);

  // === ÉTATS LOCAUX ===
  readonly selectedClassSkills = signal<string[]>([]);
  readonly selectedBgSkills = signal<string[]>([]);
  readonly selectedBgTools = signal<string[]>([]);

  // Pour les historiques personnalisés
  readonly customSkillInput = signal<string>('');
  readonly customToolInput = signal<string>('');

  ngOnInit(): void {
    const c = this.builder.creation();
    this.selectedClassSkills.set([...c.selectedSkills]);
    this.selectedBgSkills.set([...c.backgroundSkills]);
    this.selectedBgTools.set([...c.backgroundTools]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // === COMPÉTENCES DE CLASSE ===
  readonly classSkillChooseCount = computed(() => this.builder.creation().skillChooseCount || 0);

  readonly classSkillOptions = computed(() => {
    const options = this.builder.creation().skillOptions;
    if (
      !options ||
      options.length === 0 ||
      options.some((o) => o === 'any' || o === 'any-skills')
    ) {
      return Object.values(SKILL_MAP);
    }
    return options.map((id) => SKILL_MAP[id]).filter((s) => !!s);
  });

  readonly classSkillsRemaining = computed(() =>
    Math.max(0, this.classSkillChooseCount() - this.selectedClassSkills().length),
  );

  toggleClassSkill(skillId: string): void {
    const current = this.selectedClassSkills();
    if (current.includes(skillId)) {
      this.selectedClassSkills.update((arr) => arr.filter((id) => id !== skillId));
    } else if (
      current.length < this.classSkillChooseCount() &&
      !this.selectedBgSkills().includes(skillId)
    ) {
      this.selectedClassSkills.update((arr) => [...arr, skillId]);
    }
  }

  // === COMPÉTENCES D'HISTORIQUE ===
  readonly bgProf = computed(() => (this.builder.creation() as any).backgroundProficiencies);
  readonly isCustomBg = computed(() => this.builder.creation().backgroundPreset === false);

  readonly bgSkillChooseCount = computed(() => {
    if (this.isCustomBg()) return 2;
    return this.bgProf()?.skills?.chooseCount ?? this.bgProf()?.skills?.choose_count ?? 0;
  });

  readonly bgSkillOptions = computed(() => {
    if (this.isCustomBg()) return Object.values(SKILL_MAP);
    const opts = this.bgProf()?.skills?.options;
    if (!opts || opts === 'any' || opts.includes('any')) return Object.values(SKILL_MAP);
    return opts.map((id: string) => SKILL_MAP[id]).filter((s: any) => !!s);
  });

  readonly bgSkillsRemaining = computed(() =>
    Math.max(0, this.bgSkillChooseCount() - this.selectedBgSkills().length),
  );

  toggleBgSkill(skillId: string): void {
    const current = this.selectedBgSkills();
    if (current.includes(skillId)) {
      this.selectedBgSkills.update((arr) => arr.filter((id) => id !== skillId));
    } else if (
      current.length < this.bgSkillChooseCount() &&
      !this.selectedClassSkills().includes(skillId)
    ) {
      this.selectedBgSkills.update((arr) => [...arr, skillId]);
    }
  }

  addCustomBgSkill(): void {
    const skill = this.customSkillInput().trim();
    if (!skill) return;
    if (this.selectedBgSkills().length >= this.bgSkillChooseCount()) return;
    if (this.selectedBgSkills().includes(skill) || this.selectedClassSkills().includes(skill))
      return;
    this.selectedBgSkills.update((arr) => [...arr, skill]);
    this.customSkillInput.set('');
  }

  removeCustomBgSkill(skill: string): void {
    this.selectedBgSkills.update((arr) => arr.filter((x) => x !== skill));
  }

  // === OUTILS D'HISTORIQUE ===
  readonly bgToolChoiceGroups = computed(() => {
    if (this.isCustomBg()) return [];
    const choose = this.bgProf()?.tools?.choose || [];
    return choose.map((group: any, gi: number) => ({
      groupIndex: gi,
      chooseCount: group.chooseCount || group.choose_count || 1,
      note: group.note,
      options: (group.options || group.category_options || []).map((opt: any) => {
        const ref = typeof opt === 'string' ? { type: opt, any: true } : opt;
        const key = this.toolRefKey(ref);
        return {
          key,
          label: this.prettifyTool(ref),
          selected: this.selectedBgTools().includes(key),
        };
      }),
    }));
  });

  toggleBgTool(toolKey: string, group: any): void {
    const current = this.selectedBgTools();
    if (current.includes(toolKey)) {
      this.selectedBgTools.update((arr) => arr.filter((x) => x !== toolKey));
    } else {
      const selectedInGroup = group.options.filter((o: any) => current.includes(o.key)).length;
      if (selectedInGroup < group.chooseCount) {
        this.selectedBgTools.update((arr) => [...arr, toolKey]);
      }
    }
  }

  // Historique Custom : 2 outils max par défaut
  readonly customBgToolMax = computed(() => 2);
  readonly customBgToolsRemaining = computed(() =>
    Math.max(0, this.customBgToolMax() - this.selectedBgTools().length),
  );

  addCustomBgTool(): void {
    const tool = this.customToolInput().trim();
    if (!tool) return;
    if (this.selectedBgTools().length >= this.customBgToolMax()) return;
    if (this.selectedBgTools().includes(tool)) return;
    this.selectedBgTools.update((arr) => [...arr, tool]);
    this.customToolInput.set('');
  }

  removeCustomBgTool(tool: string): void {
    this.selectedBgTools.update((arr) => arr.filter((x) => x !== tool));
  }

  // === VALIDATION ===
  readonly isSelectionComplete = computed(() => {
    if (this.classSkillsRemaining() > 0) return false;
    if (this.bgSkillsRemaining() > 0) return false;

    if (this.isCustomBg()) {
      if (this.customBgToolsRemaining() > 0) return false;
    } else {
      for (const group of this.bgToolChoiceGroups()) {
        const selected = group.options.filter((o: any) => o.selected).length;
        if (selected < group.chooseCount) return false;
      }
    }
    return true;
  });

  // === HELPERS & REGROUPEMENT POUR L'AFFICHAGE ===
  isSkillSelected(skillId: string): boolean {
    return (
      this.selectedClassSkills().includes(skillId) || this.selectedBgSkills().includes(skillId)
    );
  }

  getModifierForSkill(skillId: string): string {
    const info = SKILL_MAP[skillId];
    if (!info) return '+0';
    const abilityKey = this.abilityLabelToKey(info.ability);
    if (!abilityKey) return '+0';

    const mod = this.builder.abilityModifiers()[abilityKey] ?? 0;
    const prof = this.isSkillSelected(skillId) ? 2 : 0;
    const total = mod + prof;
    return total >= 0 ? `+${total}` : `${total}`;
  }

  private abilityLabelToKey(label: string): AbilityKey | null {
    const reverseMap: Record<string, AbilityKey> = {
      Force: 'force',
      Dextérité: 'dexterite',
      Constitution: 'constitution',
      Intelligence: 'intelligence',
      Sagesse: 'sagesse',
      Charisme: 'charisme',
    };
    return reverseMap[label] ?? null;
  }

  prettifySkill(id: string): string {
    return (
      SKILL_MAP[id]?.label ??
      id
        .replace(/^skill-/, '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
    );
  }

  prettifyTool(ref: any): string {
    if (ref.any) {
      const labels: Record<string, string> = {
        instrument: 'Instrument de musique (au choix)',
        gameSet: 'Matériel de jeu (au choix)',
        game_set: 'Matériel de jeu (au choix)',
        tool: "Outil d'artisan (au choix)",
        vehicle: 'Véhicule (au choix)',
        language: 'Langue (ignoré ici)',
      };
      return labels[ref.type] ?? ref.type;
    }
    if (ref.id) {
      const MAP: Record<string, string> = {
        'tl-necessaire-de-calligraphie': 'Nécessaire de calligraphie',
        'tl-necessaire-de-cartographe': 'Nécessaire de cartographe',
        'tl-necessaire-dherboristerie': "Nécessaire d'herboristerie",
        'tl-necessaire-dalchimiste': "Nécessaire d'alchimiste",
        'tl-necessaire-de-deguisement': 'Nécessaire de déguisement',
        'tl-necessaire-de-faussaire': 'Nécessaire de faussaire',
        'tl-outils-de-voleur': 'Outils de voleur',
        'tl-vehicules-terrestres': 'Véhicules terrestres',
      };
      return (
        MAP[ref.id] ??
        ref.id
          .replace(/^tl-/, '')
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (c: any) => c.toUpperCase())
      );
    }
    return ref.type;
  }

  toolRefKey(ref: any): string {
    if (ref.id) return ref.id;
    return `${ref.type}-any`;
  }

  // === NAVIGATION ET SAUVEGARDE ===
  confirmSelection(): void {
    const c = this.builder.creation();
    const bgProf = (c as any).backgroundProficiencies;
    const isCustom = c.backgroundPreset === false;

    // 1. Génération des slots d'équipement liés aux outils d'historique
    const givesToolsAsEq =
      bgProf?.equipment?.fromToolProficiency ||
      bgProf?.equipment?.from_tool_proficiency ||
      isCustom;
    const bgSlots: EquipmentSlot[] = [];
    let slotIndex = 200; // On commence à 200 pour éviter toute collision avec l'équipement fixe (100) ou de classe (1)

    if (givesToolsAsEq) {
      const toolsToGive = [
        ...(bgProf?.tools?.fixed?.map((t: any) => t.id || t.type + '-any') ?? []),
        ...this.selectedBgTools(),
      ];

      for (const tool of toolsToGive) {
        if (!tool || tool.includes('language')) continue; // Les langues ne sont pas du matériel physique

        if (tool === 'instrument-any' || tool === 'instrument') {
          bgSlots.push({
            slot: slotIndex++,
            description: 'Instrument de musique (Maîtrise)',
            alternatives: [[{ id: 'category-musical-instruments', qty: 1 }]],
          });
        } else if (tool === 'gameSet-any' || tool === 'game_set-any' || tool === 'game_set') {
          bgSlots.push({
            slot: slotIndex++,
            description: 'Matériel de jeu (Maîtrise)',
            alternatives: [[{ id: 'category-gaming-sets', qty: 1 }]],
          });
        } else if (tool === 'tool-any' || tool === 'tool') {
          bgSlots.push({
            slot: slotIndex++,
            description: "Outil d'artisan (Maîtrise)",
            alternatives: [[{ id: 'category-tools', qty: 1 }]],
          });
        } else if (tool === 'vehicle-any' || tool === 'vehicle') {
          bgSlots.push({
            slot: slotIndex++,
            description: 'Véhicule (Maîtrise)',
            alternatives: [[{ id: 'category-vehicles', qty: 1 }]],
          });
        } else {
          bgSlots.push({
            slot: slotIndex++,
            description: this.prettifySkill(tool) || 'Outil',
            fixed: [{ id: tool, qty: 1 }],
          });
        }
      }
    }

    // 2. Sauvegarde centralisée
    this.builder.setProficiencies(
      this.selectedClassSkills(),
      this.selectedBgSkills(),
      this.selectedBgTools(),
      bgSlots,
    );

    this.builder.nextStep();
  }

  prevStep(): void {
    this.builder.previousStep();
  }
}
