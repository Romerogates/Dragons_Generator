import type { Background } from '@core/models/Backgrounds/background';
import type { EquipmentInstance, EquipmentSlot } from '@core/models/Character/character';
import type { BackgroundSelection } from '@core/services/character-builder.service';
import { pickRandom } from '@core/utils/pregen-random.util';
import { normalizeSkillId, type SkillInfo } from '@core/utils/skill.utils';
import { pickRandomSubset } from './random';

function rollPersonalityTable(
  tables: Background['data']['personalityTables'],
  key: 'traits' | 'ideals' | 'bonds' | 'flaws',
): string | undefined {
  const table = tables?.[key];
  if (!table?.entries?.length) return undefined;
  return pickRandom(table.entries)?.text;
}

export function buildAutoBackgroundSelection(
  bg: Background,
  skillMap: Record<string, SkillInfo>,
): BackgroundSelection {
  const data = bg.data;
  if (!data.preset) {
    throw new Error('Custom backgrounds not supported for auto-generation');
  }

  const fixedSkills = (data.proficiencies?.skills?.fixed ?? []).map(normalizeSkillId);
  const skillOpts = (data.proficiencies?.skills?.options ?? []) as string[];
  const skillChoose = data.proficiencies?.skills?.chooseCount ?? 0;
  let extraSkills: string[] = [];
  if (skillChoose > 0) {
    const pool =
      !skillOpts.length || skillOpts.includes('any')
        ? Object.keys(skillMap)
        : skillOpts.map(normalizeSkillId);
    extraSkills = pickRandomSubset(
      pool.filter((id) => !fixedSkills.includes(id)),
      skillChoose,
    );
  }

  const bgTools: string[] = [];
  for (const group of data.proficiencies?.tools?.choose ?? []) {
    const opts = (group.options ?? []).map((opt) => {
      if (typeof opt === 'string') return opt;
      if (opt.id) return opt.id;
      if (opt.type === 'instrument') return 'instrument-any';
      if (opt.type === 'gameSet') return 'gameSet-any';
      if (opt.type === 'vehicle') return 'vehicle-any';
      return 'tool-any';
    });
    bgTools.push(...pickRandomSubset(opts, group.chooseCount ?? 1));
  }

  const fixedEquipment: EquipmentInstance[] = (data.equipment?.fixed ?? []).map((item) => ({
    instanceId: crypto.randomUUID(),
    refId: item.id,
    name: item.name,
    qty: item.qty ?? 1,
    location: 'backpack',
    equipped: false,
    wKg: null,
  }));

  const choiceSlots: EquipmentSlot[] = (data.equipment?.choose ?? []).map((choice, i) => ({
    slot: 100 + i,
    description: choice.name ?? "Choix d'équipement",
    alternatives: (choice.pool ?? []).map((item: { id: string; qty?: number }) => [
      { id: item.id, qty: item.qty ?? 1 },
    ]),
  }));

  return {
    backgroundId: bg.id,
    backgroundName: bg.name,
    backgroundPreset: true,
    skills: [...fixedSkills, ...extraSkills],
    tools: bgTools,
    proficiencies: data.proficiencies,
    languages: [],
    bonusLanguageCount: data.proficiencies?.languages?.choiceCount ?? 0,
    equipment: fixedEquipment,
    equipmentSlots: choiceSlots,
    currency: {
      cuivre: 0,
      argent: 0,
      or: data.equipment?.currency?.or ?? 0,
      platine: 0,
    },
    privilegeId: data.privilege.id,
    privilegeName: data.privilege.name,
    privilegeDesc: data.privilege.desc,
    selectedHandicaps: [],
    handicapCompensationType: null,
    backgroundText: data.flavor?.summary ?? bg.name,
    traits: rollPersonalityTable(data.personalityTables, 'traits'),
    ideal: rollPersonalityTable(data.personalityTables, 'ideals'),
    bonds: rollPersonalityTable(data.personalityTables, 'bonds'),
    flaws: rollPersonalityTable(data.personalityTables, 'flaws'),
  };
}

export function pickPresetBackgrounds(all: Background[]): Background[] {
  return all.filter((b) => b.data?.preset !== false && b.id !== 'bg-custom');
}
