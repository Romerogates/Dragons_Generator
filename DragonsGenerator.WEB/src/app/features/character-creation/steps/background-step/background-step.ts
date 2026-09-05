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
import { DataService } from '@core/services/data.service';
import {
  CharacterBuilderService,
  BackgroundSelection,
} from '@core/services/character-builder.service';
import {
  Background,
  BackgroundData,
  BackgroundToolRef,
  PersonalityTable,
  PersonalityTableKey,
  PersonalityTableWithAlignment,
} from '@core/models/Backgrounds/background';
import { Currency } from '@core/models/Character/character';
import { normalizeBackgrounds } from '@core/utils/background-data.adapter';
import {
  mapBackgroundEquipmentChoiceSlots,
  mapBackgroundFixedEquipment,
} from '@core/utils/character-background-equipment.util';
import { normalizeSkillId } from '@core/utils/skill.utils';
import { labelForGameId } from '@core/utils/game-id-labels';
import {
  deleteCustomBackgroundTemplate,
  listCustomBackgroundTemplates,
  saveCustomBackgroundTemplate,
  type CustomBackgroundTemplate,
} from '@core/utils/custom-background-templates.util';

// ─── Types locaux ────────────────────────────────────────────────────────────

interface ToolChoiceGroup {
  groupIndex: number;
  chooseCount: number;
  note?: string;
  options: { key: string; label: string }[];
}

@Component({
  selector: 'app-background-step',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './background-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class BackgroundStep implements OnInit {
  private readonly dataService = inject(DataService);
  readonly builder = inject(CharacterBuilderService);

  // ── Chargement ──
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly backgrounds = signal<Background[]>([]);

  // ── Sélection ──
  readonly selectedBgId = signal<string | null>(null);
  readonly phase = signal<'pick' | 'configure'>('pick');

  // ── Custom background ──
  readonly customPrivilegeName = signal('');
  readonly customPrivilegeDesc = signal('');
  // ── Custom background (ajouter après les signaux existants) ──
  readonly customBgName = signal('');
  readonly customGold = signal(15);
  readonly customTrait = signal('');
  readonly customIdeal = signal('');
  readonly customBond = signal('');
  readonly customFlaw = signal('');
  /** Option : 3 compétences d'historique au lieu de 2 (custom only). */
  readonly customExtraSkill = signal(false);
  readonly savedTemplates = signal<CustomBackgroundTemplate[]>([]);
  readonly templateMsg = signal<string | null>(null);

  // ── Personnalité (tables) ──
  readonly rolledTrait = signal<string | null>(null);
  readonly rolledIdeal = signal<string | null>(null);
  readonly rolledBond = signal<string | null>(null);
  readonly rolledFlaw = signal<string | null>(null);

  // ── Personality table keys ──
  readonly personalityTableKeys: PersonalityTableKey[] = [
    'traits',
    'ideals',
    'bonds',
    'flaws',
  ];

  // ── Computed ──

  readonly c = computed(() => this.builder.creation());

  readonly charSummary = computed(() => {
    const cr = this.c();
    const parts: string[] = [];
    if (cr.speciesName) parts.push(cr.speciesName);
    if (cr.civilizationName) parts.push(cr.civilizationName);
    return parts.join(' · ') || 'Aventurier';
  });

  readonly selectedBg = computed<Background | null>(() => {
    const id = this.selectedBgId();
    if (!id) return null;
    return this.backgrounds().find((b) => b.id === id) ?? null;
  });

  readonly selectedData = computed<BackgroundData | null>(() => {
    return this.selectedBg()?.data ?? null;
  });

  readonly isCustom = computed<boolean>(() => {
    return this.selectedData()?.preset === false;
  });

  // ── Skills (Pour affichage uniquement) ──

  readonly maxSkills = computed<number>(() => {
    return this.selectedData()?.proficiencies.skills.chooseCount ?? 0;
  });

  // ── Tools (Pour affichage uniquement) ──

  readonly toolChoiceGroups = computed<ToolChoiceGroup[]>(() => {
    const data = this.selectedData();
    if (!data || this.isCustom()) return [];
    return data.proficiencies.tools.choose.map((group, gi) => ({
      groupIndex: gi,
      chooseCount: group.chooseCount,
      note: group.note,
      options: (group.options ?? []).map((opt) => ({
        key: this.toolRefKey(opt),
        label: this.prettifyTool(opt),
      })),
    }));
  });

  readonly hasToolFixed = computed<boolean>(() => {
    const data = this.selectedData();
    return (data?.proficiencies.tools.fixed?.length ?? 0) > 0;
  });

  readonly hasToolChoices = computed<boolean>(() => {
    return this.toolChoiceGroups().length > 0;
  });

  // ── Languages (Pour affichage uniquement) ──

  readonly maxLanguages = computed<number>(() => {
    return this.selectedData()?.proficiencies.languages.choiceCount ?? 0;
  });

  // ── Personality ──

  readonly hasPersonalityTables = computed<boolean>(() => {
    const tables = this.selectedData()?.personalityTables;
    return tables != null;
  });

  // ── Validation ──

  readonly validationMessages = computed<string[]>(() => {
    const data = this.selectedData();
    if (!data) return ['Sélectionnez un historique'];
    const msgs: string[] = [];

    if (this.isCustom()) {
      if (!this.customBgName().trim()) {
        msgs.push('Donnez un nom à votre historique personnalisé.');
      }
      if (!this.customPrivilegeName().trim() || !this.customPrivilegeDesc().trim()) {
        msgs.push('Définissez un nom et une description pour votre privilège personnalisé.');
      }
    }

    return msgs;
  });

  readonly isConfigValid = computed<boolean>(() => {
    return this.validationMessages().length === 0;
  });

  // ── Lifecycle ──

  ngOnInit(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.savedTemplates.set(listCustomBackgroundTemplates());

    this.dataService.getBackgrounds().subscribe({
      next: (bgs) => {
        this.backgrounds.set(normalizeBackgrounds(bgs));
        this.loading.set(false);

        const existing = this.c().backgroundId;
        if (existing) {
          const found = this.backgrounds().some((b) => b.id === existing);
          if (!found) {
            this.phase.set('pick');
            this.selectedBgId.set(null);
          } else {
            this.selectedBgId.set(existing);
            this.phase.set('configure');
            this.hydrateFieldsFromCreation();
          }
        }
      },
      error: () => {
        this.error.set('Impossible de charger les historiques.');
        this.loading.set(false);
      },
    });
  }

  // ── Actions : Sélection ──

  selectBackground(bgId: string): void {
    this.selectedBgId.set(bgId);
    this.customPrivilegeName.set('');
    this.customPrivilegeDesc.set('');
    this.customBgName.set('');
    this.customGold.set(15);
    this.customTrait.set('');
    this.customIdeal.set('');
    this.customBond.set('');
    this.customFlaw.set('');
    this.customExtraSkill.set(false);
    this.rolledTrait.set(null);
    this.rolledIdeal.set(null);
    this.rolledBond.set(null);
    this.rolledFlaw.set(null);
    this.phase.set('configure');
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  }

  backToPick(): void {
    this.phase.set('pick');
    this.selectedBgId.set(null);
    this.templateMsg.set(null);
  }

  saveCurrentAsTemplate(): void {
    if (!this.isCustom()) return;
    const name = this.customBgName().trim();
    if (!name) {
      this.templateMsg.set('Indiquez un nom d’historique avant de sauvegarder le modèle.');
      return;
    }
    this.savedTemplates.set(
      saveCustomBackgroundTemplate({
        name,
        privilegeName: this.customPrivilegeName(),
        privilegeDesc: this.customPrivilegeDesc(),
        gold: this.customGold(),
        trait: this.customTrait(),
        ideal: this.customIdeal(),
        bond: this.customBond(),
        flaw: this.customFlaw(),
        extraSkill: this.customExtraSkill(),
      }),
    );
    this.templateMsg.set('Modèle sauvegardé sur cet appareil.');
  }

  applyTemplate(t: CustomBackgroundTemplate): void {
    this.customBgName.set(t.name);
    this.customPrivilegeName.set(t.privilegeName);
    this.customPrivilegeDesc.set(t.privilegeDesc);
    this.customGold.set(t.gold);
    this.customTrait.set(t.trait);
    this.customIdeal.set(t.ideal);
    this.customBond.set(t.bond);
    this.customFlaw.set(t.flaw);
    this.customExtraSkill.set(!!t.extraSkill);
    this.templateMsg.set(`Modèle « ${t.name} » chargé.`);
  }

  removeTemplate(id: string): void {
    this.savedTemplates.set(deleteCustomBackgroundTemplate(id));
    this.templateMsg.set('Modèle supprimé.');
  }

  // ── Actions : Tables de personnalité ──

  rollOnTable(tableType: PersonalityTableKey): void {
    const table = this.getTable(tableType);
    if (!table) return;
    const idx = Math.floor(Math.random() * table.entries.length);
    this.setRolledValue(tableType, table.entries[idx].text);
  }

  pickEntry(tableType: PersonalityTableKey, text: string): void {
    this.setRolledValue(tableType, text);
  }

  isEntrySelected(tableType: PersonalityTableKey, text: string): boolean {
    return this.getSelectedText(tableType) === text;
  }

  getTable(key: PersonalityTableKey): PersonalityTable | PersonalityTableWithAlignment | null {
    return this.selectedData()?.personalityTables?.[key] ?? null;
  }

  getSelectedText(key: PersonalityTableKey): string | null {
    switch (key) {
      case 'traits':
        return this.rolledTrait();
      case 'ideals':
        return this.rolledIdeal();
      case 'bonds':
        return this.rolledBond();
      case 'flaws':
        return this.rolledFlaw();
    }
  }

  private setRolledValue(key: PersonalityTableKey, text: string): void {
    switch (key) {
      case 'traits':
        this.rolledTrait.set(text);
        break;
      case 'ideals':
        this.rolledIdeal.set(text);
        break;
      case 'bonds':
        this.rolledBond.set(text);
        break;
      case 'flaws':
        this.rolledFlaw.set(text);
        break;
    }
  }

  // ── Confirmation ──

  confirm(): void {
    if (!this.isConfigValid()) return;
    const bg = this.selectedBg();
    const data = this.selectedData();
    if (!bg || !data) return;

    const isCustom = this.isCustom();

    const fixedEquipment = mapBackgroundFixedEquipment(data.equipment?.fixed ?? []);
    const choiceSlots = mapBackgroundEquipmentChoiceSlots(data.equipment?.choose ?? []);

    const goldAmount = isCustom ? this.customGold() : (data.equipment?.currency?.or ?? 0);
    const bgCurrency: Currency = { cuivre: 0, argent: 0, or: goldAmount, platine: 0 };

    const bgName = isCustom ? this.customBgName().trim() || 'Personnalisé' : bg.name;

    // Personnalité : tables pour presets, texte libre pour custom
    const traits = isCustom ? this.customTrait() || undefined : (this.rolledTrait() ?? undefined);
    const ideal = isCustom ? this.customIdeal() || undefined : (this.rolledIdeal() ?? undefined);
    const bonds = isCustom ? this.customBond() || undefined : (this.rolledBond() ?? undefined);
    const flaws = isCustom ? this.customFlaw() || undefined : (this.rolledFlaw() ?? undefined);

    const fixedSkills = (data.proficiencies?.skills?.fixed ?? []).map(normalizeSkillId);

    const customSkillCount = this.customExtraSkill() ? 3 : 2;
    const proficiencies = isCustom
      ? {
          ...data.proficiencies,
          skills: {
            fixed: [] as string[],
            chooseCount: customSkillCount,
            options: 'any' as const,
          },
        }
      : data.proficiencies;

    const selection: BackgroundSelection = {
      backgroundId: bg.id,
      backgroundName: bgName,
      backgroundPreset: data.preset,
      skills: fixedSkills,
      tools: [],
      proficiencies,
      languages: [],
      bonusLanguageCount: isCustom ? 0 : this.maxLanguages(),
      equipment: fixedEquipment,
      equipmentSlots: choiceSlots,
      currency: bgCurrency,
      privilegeId: isCustom ? 'priv-custom' : data.privilege.id,
      privilegeName: isCustom ? this.customPrivilegeName() || null : data.privilege.name,
      privilegeDesc: isCustom ? this.customPrivilegeDesc() || null : data.privilege.desc,
      selectedHandicaps: [],
      handicapCompensationType: null,
      backgroundText: isCustom
        ? `${bgName} : ${this.customPrivilegeDesc()}`
        : `${bg.name} : ${data.flavor.summary}`,
      traits,
      ideal,
      bonds,
      flaws,
    };

    this.builder.setBackground(selection);
    this.builder.nextStep();
  }

  prevStep(): void {
    this.builder.previousStep();
  }

  /** Recharge les champs UI depuis le builder (retour depuis une étape suivante). */
  private hydrateFieldsFromCreation(): void {
    const cr = this.c();
    const isCustom = cr.backgroundPreset === false || cr.privilegeId === 'priv-custom';

    if (isCustom) {
      this.customBgName.set(cr.backgroundName || '');
      this.customPrivilegeName.set(cr.privilegeName || '');
      this.customPrivilegeDesc.set(cr.privilegeDesc || '');
      this.customGold.set(cr.backgroundCurrency?.or ?? 15);
      this.customTrait.set(cr.traits || '');
      this.customIdeal.set(cr.ideal || '');
      this.customBond.set(cr.bonds || '');
      this.customFlaw.set(cr.flaws || '');
      const choose =
        cr.backgroundProficiencies?.skills?.chooseCount ??
        (cr.backgroundProficiencies?.skills as { choose_count?: number } | undefined)?.choose_count ??
        2;
      this.customExtraSkill.set(choose >= 3);
      return;
    }

    this.rolledTrait.set(cr.traits?.trim() ? cr.traits : null);
    this.rolledIdeal.set(cr.ideal?.trim() ? cr.ideal : null);
    this.rolledBond.set(cr.bonds?.trim() ? cr.bonds : null);
    this.rolledFlaw.set(cr.flaws?.trim() ? cr.flaws : null);
  }

  // ── Helpers ──

  prettifySkill(id: string): string {
    return labelForGameId(id);
  }

  prettifyTool(ref: BackgroundToolRef): string {
    if (ref.any) return labelForGameId(ref.type);
    if (ref.id) return labelForGameId(ref.id);
    return labelForGameId(ref.type);
  }

  toolRefKey(ref: BackgroundToolRef): string {
    if (ref.id) return ref.id;
    return `${ref.type}-any`;
  }

  bgIcon(bgId: string): string {
    const icons: Record<string, string> = {
      'bg-acolyte': 'fluent-emoji:prayer-beads',
      'bg-animiste': 'fluent-emoji:crystal-ball',
      'bg-bohemien': 'fluent-emoji:circus-tent',
      'bg-condottiere': 'fluent-emoji:shield',
      'bg-erudit': 'fluent-emoji:books',
      'bg-explorateur': 'fluent-emoji:compass',
      'bg-larron': 'fluent-emoji:dagger',
      'bg-notable': 'fluent-emoji:crown',
      'bg-reclus': 'fluent-emoji:mountain',
      'bg-survivant': 'fluent-emoji:campfire',
      'bg-custom': 'fluent-emoji:wrench',
    };
    return icons[bgId] ?? 'fluent-emoji:scroll';
  }

  tableIcon(type: PersonalityTableKey): string {
    const icons: Record<PersonalityTableKey, string> = {
      traits: 'fluent-emoji:smiling-face-with-halo',
      ideals: 'fluent-emoji:glowing-star',
      bonds: 'fluent-emoji:handshake',
      flaws: 'fluent-emoji:broken-heart',
    };
    return icons[type];
  }

  tableLabel(type: PersonalityTableKey): string {
    const labels: Record<PersonalityTableKey, string> = {
      traits: 'Traits de personnalité',
      ideals: 'Idéal',
      bonds: 'Obligations',
      flaws: 'Failles',
    };
    return labels[type];
  }
}
