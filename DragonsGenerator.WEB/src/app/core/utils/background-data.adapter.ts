import type {
  Background,
  BackgroundData,
  BackgroundEquipment,
  BackgroundProficiencies,
  BackgroundSkillChoice,
  BackgroundToolChoice,
  BackgroundToolChooseGroup,
  BackgroundToolRef,
  PersonalityTables,
} from '@core/models/Backgrounds/background';
import { normalizeSkillId } from './skill.utils';

function mapToolRef(opt: any): BackgroundToolRef {
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

  if (opt?.type === 'tool_category') {
    const cat = String(opt.category ?? opt.id ?? '').toLowerCase();
    if (cat.includes('instrument') || cat === 'musical') {
      return { type: 'instrument', any: true };
    }
    if (cat.includes('game') || cat === 'jeu' || cat.includes('materiel-de-jeu')) {
      return { type: 'gameSet', any: true };
    }
    if (cat.includes('vehic') || cat === 'vehicle') {
      return { type: 'vehicle', any: true };
    }
    // artisan / tool / défaut
    return { type: 'tool', any: true };
  }

  if (opt?.type === 'instrument' || opt?.type === 'gameSet' || opt?.type === 'vehicle') {
    const id = String(opt.id ?? '');
    // Placeholders de catégorie (pas d'objets concrets dans le catalogue)
    if (
      !id ||
      id.startsWith('tl-vehicules') ||
      id === 'tl-materiel-de-jeu' ||
      id.includes('category')
    ) {
      return { type: opt.type, any: true };
    }
    return {
      type: opt.type,
      id: opt.id,
      any: opt.any ?? false,
    };
  }

  if (opt?.id) {
    const id = String(opt.id);
    if (id.startsWith('tl-vehicules') || id === 'tl-materiel-de-jeu') {
      return id.includes('jeu')
        ? { type: 'gameSet', any: true }
        : { type: 'vehicle', any: true };
    }
    // Alias données : alchimiste
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

  return groups.map((group: any) => ({
    chooseCount: group.chooseCount ?? group.choose_count ?? group.count ?? 1,
    note: group.note,
    options: (group.options ?? group.category_options ?? []).map(mapToolRef),
    categoryOptions: group.categoryOptions ?? group.category_options,
  }));
}

function normalizeSkills(raw: any): BackgroundSkillChoice & { fixed: string[] } {
  const fixed = ((raw?.fixed as string[]) ?? []).map(normalizeSkillId);
  const choose = raw?.choose;

  if (!choose) {
    return {
      fixed,
      chooseCount: 0,
      options: [],
    };
  }

  if (choose === 'any' || choose?.options === 'any') {
    return {
      fixed,
      chooseCount: choose?.count ?? choose?.chooseCount ?? choose?.choose_count ?? 2,
      options: 'any',
    };
  }

  return {
    fixed,
    chooseCount: choose.count ?? choose.chooseCount ?? choose.choose_count ?? 0,
    options: ((choose.options as string[]) ?? []).map(normalizeSkillId),
  };
}

function normalizePersonalityTables(raw: any): PersonalityTables | null {
  if (!raw) return null;
  return {
    traits: raw.traits,
    ideals: raw.ideals,
    bonds: raw.bonds,
    flaws: raw.flaws,
  };
}

function normalizeProficiencies(raw: any): BackgroundProficiencies & {
  skills: BackgroundSkillChoice & { fixed: string[] };
} {
  const skills = normalizeSkills(raw?.skills);
  const toolsRaw = raw?.tools ?? {};
  const tools: BackgroundToolChoice = {
    fixed: (toolsRaw.fixed ?? []).map(mapToolRef),
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

function normalizeEquipment(raw: any): BackgroundEquipment & { choose?: any[] } {
  return {
    fixed: raw?.fixed ?? [],
    currency: {
      or: raw?.currency?.or ?? raw?.currency?.gp ?? 0,
    },
    fromToolProficiency: raw?.fromToolProficiency ?? raw?.from_tool_proficiency ?? true,
    custom: raw?.custom,
    budgetRules: raw?.budgetRules ?? raw?.budget_rules,
    choose: raw?.choose ?? [],
  } as BackgroundEquipment & { choose?: any[] };
}

/** Adapte le schema 2.0 API (snake_case + choose.count) vers le modèle wizard. */
export function normalizeBackground(bg: Background): Background {
  const raw = bg.data as any;

  // Déjà normalisé
  if (raw?.proficiencies?.skills && 'chooseCount' in (raw.proficiencies.skills ?? {})) {
    if (!raw.personalityTables && raw.personality_tables) {
      return {
        ...bg,
        data: {
          ...raw,
          personalityTables: normalizePersonalityTables(raw.personality_tables),
        },
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
