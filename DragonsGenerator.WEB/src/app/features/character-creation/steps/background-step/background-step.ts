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
  PersonalityTableWithAlignment,
} from '@core/models/Backgrounds/background';
import { Currency, EquipmentSlot, EquipmentInstance } from '@core/models/Character/character';

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

  // ── Personnalité (tables) ──
  readonly rolledTrait = signal<string | null>(null);
  readonly rolledIdeal = signal<string | null>(null);
  readonly rolledBond = signal<string | null>(null);
  readonly rolledFlaw = signal<string | null>(null);

  // ── Personality table keys ──
  readonly personalityTableKeys: ('traits' | 'ideals' | 'bonds' | 'flaws')[] = [
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

    // Chargement des historiques
    this.dataService.getBackgrounds().subscribe({
      next: (bgs) => {
        this.backgrounds.set(bgs);
        this.loading.set(false);

        const existing = this.c().backgroundId;
        if (existing) {
          this.selectedBgId.set(existing);
          this.phase.set('configure');

          // Recharger les données custom si existantes
          if (this.c().backgroundPreset === false) {
            this.customPrivilegeName.set(this.c().privilegeName || '');
            this.customPrivilegeDesc.set(this.c().privilegeDesc || '');
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
  }

  // ── Actions : Tables de personnalité ──

  rollOnTable(tableType: 'traits' | 'ideals' | 'bonds' | 'flaws'): void {
    const table = this.getTable(tableType);
    if (!table) return;
    const idx = Math.floor(Math.random() * table.entries.length);
    this.setRolledValue(tableType, table.entries[idx].text);
  }

  pickEntry(tableType: 'traits' | 'ideals' | 'bonds' | 'flaws', text: string): void {
    this.setRolledValue(tableType, text);
  }

  isEntrySelected(tableType: string, text: string): boolean {
    return this.getSelectedText(tableType as any) === text;
  }

  getTable(
    key: 'traits' | 'ideals' | 'bonds' | 'flaws',
  ): PersonalityTable | PersonalityTableWithAlignment | null {
    return this.selectedData()?.personalityTables?.[key] ?? null;
  }

  getSelectedText(key: 'traits' | 'ideals' | 'bonds' | 'flaws'): string | null {
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

  private setRolledValue(key: 'traits' | 'ideals' | 'bonds' | 'flaws', text: string): void {
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
    const bg = this.selectedBg();
    const data = this.selectedData();
    if (!bg || !data) return;

    const isCustom = this.isCustom();

    const fixedEquipment: EquipmentInstance[] = (data.equipment?.fixed ?? []).map((item: any) => ({
      instanceId: crypto.randomUUID(),
      refId: item.id,
      name: item.name,
      qty: item.qty ?? 1,
      location: item.location ?? 'backpack',
      equipped: item.location === 'equipped',
      wKg: null,
      customData: undefined,
    }));

    const choiceSlots: EquipmentSlot[] = [];

    const goldAmount = isCustom ? this.customGold() : (data.equipment?.currency?.or ?? 0);
    const bgCurrency: Currency = { cuivre: 0, argent: 0, or: goldAmount, platine: 0 };

    const bgName = isCustom ? this.customBgName().trim() || 'Personnalisé' : bg.name;

    // Personnalité : tables pour presets, texte libre pour custom
    const traits = isCustom ? this.customTrait() || undefined : (this.rolledTrait() ?? undefined);
    const ideal = isCustom ? this.customIdeal() || undefined : (this.rolledIdeal() ?? undefined);
    const bonds = isCustom ? this.customBond() || undefined : (this.rolledBond() ?? undefined);
    const flaws = isCustom ? this.customFlaw() || undefined : (this.rolledFlaw() ?? undefined);

    const selection: BackgroundSelection = {
      backgroundId: bg.id,
      backgroundName: bgName,
      backgroundPreset: data.preset,
      skills: [],
      tools: [],
      proficiencies: data.proficiencies,
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

  // ── Helpers ──

  prettifySkill(id: string): string {
    const MAP: Record<string, string> = {
      'skill-acrobaties': 'Acrobaties',
      'skill-athletisme': 'Athlétisme',
      'skill-arcanes': 'Arcanes',
      'skill-discretion': 'Discrétion',
      'skill-dressage': 'Dressage',
      'skill-escamotage': 'Escamotage',
      'skill-histoire': 'Histoire',
      'skill-intimidation': 'Intimidation',
      'skill-intuition': 'Intuition',
      'skill-investigation': 'Investigation',
      'skill-medecine': 'Médecine',
      'skill-nature': 'Nature',
      'skill-perception': 'Perception',
      'skill-persuasion': 'Persuasion',
      'skill-religion': 'Religion',
      'skill-representation': 'Représentation',
      'skill-survie': 'Survie',
      'skill-tromperie': 'Tromperie',
    };
    return (
      MAP[id] ??
      id
        .replace(/^skill-/, '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
    );
  }

  prettifyTool(ref: BackgroundToolRef): string {
    if (ref.any) {
      const labels: Record<string, string> = {
        instrument: 'Instrument de musique (au choix)',
        gameSet: 'Matériel de jeu (au choix)',
        tool: "Outil d'artisan (au choix)",
        vehicle: 'Véhicule (au choix)',
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
          .replace(/\b\w/g, (c) => c.toUpperCase())
      );
    }
    return ref.type;
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

  tableIcon(type: string): string {
    const icons: Record<string, string> = {
      traits: 'fluent-emoji:smiling-face-with-halo',
      ideals: 'fluent-emoji:glowing-star',
      bonds: 'fluent-emoji:handshake',
      flaws: 'fluent-emoji:broken-heart',
    };
    return icons[type] ?? 'fluent-emoji:game-die';
  }

  tableLabel(type: string): string {
    const labels: Record<string, string> = {
      traits: 'Traits de personnalité',
      ideals: 'Idéal',
      bonds: 'Obligations',
      flaws: 'Failles',
    };
    return labels[type] ?? type;
  }
}
