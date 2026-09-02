import type {
  Background,
  BackgroundData,
  BackgroundEquipment,
  BackgroundEquipmentChooseGroup,
  BackgroundProficiencies,
  BackgroundSkillChoice,
  BackgroundToolChooseGroup,
  BackgroundToolRef,
  PersonalityTables,
} from '@core/models/Backgrounds/background';
import { normalizeSkillId } from './skill.utils';

/** Formes brutes renvoyées par l'API avant normalisation wizard. */
interface RawBackgroundToolOption {
  type?: string;
  id?: string;
  category?: string;
  any?: boolean;
}

interface RawBackgroundToolChooseGroup {
  chooseCount?: number;
  choose_count?: number;
  count?: number;
  note?: string;
  options?: unknown[];
  category_options?: unknown[];
  categoryOptions?: unknown[];
}

interface RawBackgroundSkillChoose {
  count?: number;
  chooseCount?: number;
  choose_count?: number;
  options?: string[] | 'any';
}

interface RawBackgroundSkills {
  fixed?: string[];
  choose?: RawBackgroundSkillChoose | 'any';
}

interface RawPersonalityTables {
  traits?: PersonalityTables['traits'];
  ideals?: PersonalityTables['ideals'];
  bonds?: PersonalityTables['bonds'];
  flaws?: PersonalityTables['flaws'];
}

interface RawBackgroundProficiencies {
  skills?: RawBackgroundSkills;
  tools?: { fixed?: unknown[]; choose?: unknown };
  languages?: {
    choiceCount?: number;
    choose_count?: number;
    choice_count?: number;
    note?: string;
  };
}

interface RawBackgroundEquipment {
  fixed?: BackgroundEquipment['fixed'];
  currency?: { or?: number; gp?: number };
  fromToolProficiency?: boolean;
  from_tool_proficiency?: boolean;
  custom?: boolean;
  budgetRules?: BackgroundEquipment['budgetRules'];
  budget_rules?: BackgroundEquipment['budgetRules'];
  choose?: BackgroundEquipmentChooseGroup[];
}

interface RawBackgroundData {
  proficiencies?: RawBackgroundProficiencies;
  equipment?: RawBackgroundEquipment;
  personality_tables?: PersonalityTables;
  personalityTables?: PersonalityTables;
  handicaps_compatible?: string[];
  handicapsCompatible?: string[];
  flavor?: { summary?: string; adventureHook?: string; adventure_hook?: string };
  privilege?: BackgroundData['privilege'];
  preset?: boolean;
  source?: BackgroundData['source'];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function mapToolRef(opt: unknown): BackgroundToolRef {
  if (typeof opt === 'string') {
    const id = opt.toLowerCase();
    if (id === 'tool' || id === 'artisan') return { type: 'tool', any: true };
    if (id === 'instrument' || id === 'musical') return { type: 'instrument', any: true };
    if (id === 'game_set' || id === 'gameset' || id === 'jeu') return { type: 'gameSet', any: true };
    if (id === 'vehicle' || id === 'vehicule') return { type: 'vehicle', any: true };
    if (id.startsWith('tl-vehicules') || id === 'tl-materiel-de-jeu') {
      return id.includes('jeu')
        ? { type: 'gameSet', any: true }
        : { type: 'vehicle', any: true };
    }
    return { type: 'tool', id: opt };
  }

  if (!isRecord(opt)) {
    return { type: 'tool', any: true };
  }

  const raw = opt as RawBackgroundToolOption;

  if (raw.type === 'tool_category') {
    const cat = String(raw.category ?? raw.id ?? '').toLowerCase();
    if (cat.includes('instrument') || cat === 'musical') {
      return { type: 'instrument', any: true };
    }
    if (cat.includes('game') || cat === 'jeu' || cat.includes('materiel-de-jeu')) {
      return { type: 'gameSet', any: true };
    }
    if (cat.includes('vehic') || cat === 'vehicle') {
      return { type: 'vehicle', any: true };
    }
    return { type: 'tool', any: true };
  }

  if (raw.type === 'instrument' || raw.type === 'gameSet' || raw.type === 'vehicle') {
    const id = String(raw.id ?? '');
    if (
      !id ||
      id.startsWith('tl-vehicules') ||
      id === 'tl-materiel-de-jeu' ||
      id.includes('category')
    ) {
      return { type: raw.type, any: true };
    }
    return {
      type: raw.type,
      id: raw.id,
      any: raw.any ?? false,
    };
  }

  if (raw.id) {
    const id = String(raw.id);
    if (id.startsWith('tl-vehicules') || id === 'tl-materiel-de-jeu') {
      return id.includes('jeu')
        ? { type: 'gameSet', any: true }
        : { type: 'vehicle', any: true };
    }
    if (id === 'tl-outils-dalchimiste') {
      return { type: 'tool', id: 'tl-necessaire-dalchimiste' };
    }
    return { type: 'tool', id };
  }

  return { type: 'tool', any: true };
}

function normalizeToolChoose(raw: unknown): BackgroundToolChooseGroup[] {
  if (!raw) return [];
  const groups = Array.isArray(raw) ? raw : [raw];

  return groups.map((group) => {
    const g = group as RawBackgroundToolChooseGroup;
    const categoryOptions = g.categoryOptions ?? g.category_options;
    return {
      chooseCount: g.chooseCount ?? g.choose_count ?? g.count ?? 1,
      note: g.note,
      options: (g.options ?? g.category_options ?? []).map(mapToolRef),
      categoryOptions: Array.isArray(categoryOptions)
        ? categoryOptions.filter((x): x is string => typeof x === 'string')
        : undefined,
    };
  });
}

function normalizeSkills(raw: RawBackgroundSkills | undefined): BackgroundSkillChoice & { fixed: string[] } {
  const fixed = ((raw?.fixed as string[]) ?? []).map(normalizeSkillId);
  const choose = raw?.choose;

  if (!choose) {
    return {
      fixed,
      chooseCount: 0,
      options: [],
    };
  }

  if (choose === 'any' || (isRecord(choose) && choose['options'] === 'any')) {
    const chooseObj = isRecord(choose) ? choose : {};
    return {
      fixed,
      chooseCount:
        (chooseObj as RawBackgroundSkillChoose).count ??
        (chooseObj as RawBackgroundSkillChoose).chooseCount ??
        (chooseObj as RawBackgroundSkillChoose).choose_count ??
        2,
      options: 'any',
    };
  }

  const chooseObj = choose as RawBackgroundSkillChoose;
  return {
    fixed,
    chooseCount: chooseObj.count ?? chooseObj.chooseCount ?? chooseObj.choose_count ?? 0,
    options: ((chooseObj.options as string[]) ?? []).map(normalizeSkillId),
  };
}

function normalizePersonalityTables(raw: RawPersonalityTables | null | undefined): PersonalityTables | null {
  if (!raw) return null;
  return {
    traits: raw.traits!,
    ideals: raw.ideals!,
    bonds: raw.bonds!,
    flaws: raw.flaws!,
  };
}

function normalizeProficiencies(raw: RawBackgroundProficiencies | undefined): BackgroundProficiencies & {
  skills: BackgroundSkillChoice & { fixed: string[] };
} {
  const skills = normalizeSkills(raw?.skills);
  const toolsRaw = raw?.tools ?? {};
  const tools = {
    fixed: ((toolsRaw.fixed ?? []) as unknown[]).map(mapToolRef),
    choose: normalizeToolChoose(toolsRaw.choose),
  };

  return {
    skills,
    tools,
    languages: {
      choiceCount:
        raw?.languages?.choiceCount ??
        raw?.languages?.choose_count ??
        raw?.languages?.choice_count ??
        0,
      note: raw?.languages?.note,
    },
  };
}

function normalizeEquipment(raw: RawBackgroundEquipment | undefined): BackgroundEquipment {
  return {
    fixed: raw?.fixed ?? [],
    currency: {
      or: raw?.currency?.or ?? raw?.currency?.gp ?? 0,
    },
    fromToolProficiency: raw?.fromToolProficiency ?? raw?.from_tool_proficiency ?? true,
    custom: raw?.custom,
    budgetRules: raw?.budgetRules ?? raw?.budget_rules,
    choose: raw?.choose ?? [],
  };
}

/** Adapte le schema 2.0 API (snake_case + choose.count) vers le modèle wizard. */
export function normalizeBackground(bg: Background): Background {
  const raw = bg.data as RawBackgroundData;

  // Déjà normalisé
  if (raw?.proficiencies?.skills && 'chooseCount' in (raw.proficiencies.skills ?? {})) {
    if (!raw.personalityTables && raw.personality_tables) {
      return {
        ...bg,
        data: {
          ...raw,
          personalityTables: normalizePersonalityTables(raw.personality_tables),
        } as BackgroundData,
      };
    }
    return bg;
  }

  const flavor = raw?.flavor ?? {};
  const data: BackgroundData = {
    preset: raw?.preset !== false && bg.id !== 'bg-custom',
    source: raw?.source ?? { book: '', pages: '' },
    flavor: {
      summary: flavor.summary ?? '',
      adventureHook: flavor.adventureHook ?? flavor.adventure_hook ?? null,
    },
    proficiencies: normalizeProficiencies(raw?.proficiencies),
    equipment: normalizeEquipment(raw?.equipment),
    privilege: {
      id: raw?.privilege?.id ?? null,
      name: raw?.privilege?.name ?? null,
      desc: raw?.privilege?.desc ?? null,
      custom: raw?.privilege?.custom,
      guidelines: raw?.privilege?.guidelines,
    },
    personalityTables: normalizePersonalityTables(
      raw?.personalityTables ?? raw?.personality_tables,
    ),
    handicapsCompatible: raw?.handicapsCompatible ?? raw?.handicaps_compatible,
  };

  return { ...bg, data };
}

export function normalizeBackgrounds(backgrounds: Background[]): Background[] {
  return backgrounds.map(normalizeBackground);
}
