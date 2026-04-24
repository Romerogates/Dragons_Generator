// features/character-creation/steps/skills-step/skills-step.ts

import {
  Component,
  inject,
  computed,
  ChangeDetectionStrategy,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CharacterBuilderService } from '../../../../core/services/character-builder.service';
import { type AbilityKey } from '../../../../core/models/Character/character';

interface SkillInfo {
  id: string;
  label: string;
  ability: string;
  icon: string;
}

interface SkillGroup {
  name: string;
  abilityKey: AbilityKey;
  icon: string;
  colorClass: string;
  skills: SkillInfo[];
}

const SKILL_MAP: Record<string, SkillInfo> = {
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
  imports: [CommonModule],
  templateUrl: './skills-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA], // <-- Autorise la balise <iconify-icon>
})
export class SkillsStep {
  readonly builder = inject(CharacterBuilderService);

  readonly availableSkills = computed(() => {
    const options = this.builder.creation().skillOptions;
    if (!options || options.length === 0) {
      return Object.values(SKILL_MAP);
    }
    // "any" ou "any-skills" = toutes les compétences (Barde, Lettré)
    if (options.some((o) => o === 'any' || o === 'any-skills')) {
      return Object.values(SKILL_MAP);
    }
    return options.map((id) => SKILL_MAP[id]).filter((s) => !!s);
  });

  // === REGROUPEMENT PAR CARACTÉRISTIQUE (Comme sur la feuille) ===
  readonly groupedSkills = computed<SkillGroup[]>(() => {
    const available = this.availableSkills();
    const groups: Omit<SkillGroup, 'skills'>[] = [
      {
        name: 'Force',
        abilityKey: 'force',
        icon: 'fluent-emoji:flexed-biceps',
        colorClass: 'text-red-400',
      },
      {
        name: 'Dextérité',
        abilityKey: 'dexterite',
        icon: 'fluent-emoji:person-cartwheeling',
        colorClass: 'text-orange-400',
      },
      {
        name: 'Intelligence',
        abilityKey: 'intelligence',
        icon: 'fluent-emoji:brain',
        colorClass: 'text-blue-400',
      },
      {
        name: 'Sagesse',
        abilityKey: 'sagesse',
        icon: 'fluent-emoji:eye',
        colorClass: 'text-emerald-400',
      },
      {
        name: 'Charisme',
        abilityKey: 'charisme',
        icon: 'fluent-emoji:speaking-head',
        colorClass: 'text-purple-400',
      },
    ];

    return groups
      .map((g) => ({
        ...g,
        skills: available.filter((s) => s.ability === g.name),
      }))
      .filter((g) => g.skills.length > 0);
  });

  readonly chooseCount = computed(() => this.builder.creation().skillChooseCount || 0);
  readonly selectedCount = computed(() => this.builder.creation().selectedSkills.length);
  readonly remaining = computed(() => Math.max(0, this.chooseCount() - this.selectedCount()));

  readonly selectedSkillsDetails = computed<SkillInfo[]>(() => {
    return this.builder
      .creation()
      .selectedSkills.map((id) => SKILL_MAP[id])
      .filter((s) => !!s);
  });

  readonly emptySlots = computed<number[]>(() => {
    return Array(this.remaining()).fill(0);
  });

  isSelected(skillId: string): boolean {
    return this.builder.creation().selectedSkills.includes(skillId);
  }

  canSelect(skillId: string): boolean {
    return this.isSelected(skillId) || this.selectedCount() < this.chooseCount();
  }

  toggle(skillId: string): void {
    this.builder.toggleSkill(skillId);
  }

  getModifierForSkill(skillId: string): string {
    const info = SKILL_MAP[skillId];
    if (!info) return '+0';
    const abilityKey = this.abilityLabelToKey(info.ability);
    if (!abilityKey) return '+0';

    const mod = this.builder.abilityModifiers()[abilityKey] ?? 0;
    const prof = this.isSelected(skillId) ? 2 : 0;
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

  confirmSelection(): void {
    this.builder.nextStep();
  }

  prevStep(): void {
    this.builder.previousStep();
  }
}
