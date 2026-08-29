import { ABILITY_KEY_TO_LABEL, type AbilityKey } from '@core/models/Character/character';
import { apiCodeToAbilityKey } from '@core/utils/ability-mapping';

export interface MechanicsRow {
  label: string;
  value: string;
}

export interface MechanicsBlock {
  title?: string;
  subtitle?: string;
  desc?: string;
  rows: MechanicsRow[];
  badges: string[];
  note?: string;
  children?: MechanicsBlock[];
}

const RECHARGE_LABELS: Record<string, string> = {
  at_will: 'À volonté',
  short_rest: 'Repos court',
  long_rest: 'Repos long',
  short_or_long_rest: 'Repos court ou long',
};

const SHAPE_LABELS: Record<string, string> = {
  cone: 'Cône',
  line: 'Ligne',
  ligne: 'Ligne',
  sphere: 'Sphère',
};

export function buildMechanicsBlocks(value: unknown): MechanicsBlock[] {
  if (value === null || value === undefined) return [];
  if (typeof value !== 'object') {
    return [{ rows: [{ label: 'Valeur', value: String(value) }], badges: [] }];
  }

  const mech = value as Record<string, unknown>;
  const type = String(mech['type'] ?? '');

  switch (type) {
    case 'darkvision':
      return [
        block(undefined, [
          row('Portée', `${mech['range_m'] ?? mech['rangeM'] ?? '?'} m`),
        ]),
      ];
    case 'lineage_selection':
      return [
        block('Lignée draconique', [
          row(
            'Déterminé par',
            refLabel(String(mech['resolved_by_choice'] ?? mech['resolvedByChoice'] ?? '')),
          ),
        ]),
      ];
    case 'context_check':
      return [
        block('Test contextuel', [
          row('Compétence', refLabel(String(mech['skill'] ?? ''))),
          row('Caractéristique', abilityLabel(String(mech['ability'] ?? ''))),
          row('Déclencheur', humanizeText(String(mech['trigger'] ?? ''))),
          ...(mech['note'] ? [row('Note', String(mech['note']))] : []),
        ]),
      ];
    case 'breath_weapon':
      return [parseBreathWeapon(mech)];
    case 'damage_resistance':
      return [
        block('Résistance aux dégâts', [
          row('Source', refLabel(String(mech['source_key'] ?? mech['sourceKey'] ?? ''))),
          row('Types', formatResistanceList(mech['resistances'])),
        ]),
      ];
    case 'innate_spellcasting':
      return [parseInnateSpellcasting(mech)];
    case 'compound':
      return parseCompound(mech);
    case 'saving_throw':
      return [parseSavingThrow(mech)];
    case 'weapon_proficiency':
    case 'armor_proficiency':
    case 'tool_proficiency':
    case 'skill_proficiency':
      return [parseProficiency(mech, type)];
    case 'context_expertise':
      return [
        block('Expertise contextuelle', [
          row('Compétence', refLabel(String(mech['skill'] ?? ''))),
          row('Contexte', humanizeText(String(mech['context'] ?? mech['trigger'] ?? ''))),
        ]),
      ];
    case 'crafting_ability':
      return [
        block('Artisanat', [
          row('Type', humanizeText(String(mech['craft_type'] ?? mech['craftType'] ?? ''))),
          row('Bonus', String(mech['bonus'] ?? '')),
        ]),
      ];
    case 'tool_advantage':
      return [
        block('Avantage outil', [
          row('Outil', refLabel(String(mech['tool'] ?? ''))),
          row('Condition', humanizeText(String(mech['condition'] ?? ''))),
        ]),
      ];
    case 'hp_per_level_bonus':
      return [
        block('Points de vie', [
          row('Bonus par niveau', `+${mech['bonus_per_level'] ?? mech['bonusPerLevel'] ?? 1} PV`),
        ]),
      ];
    case 'proficiency_bundle':
      return [
        block('Maîtrises liées', [
          row(
            'Choix associés',
            listRefs(mech['resolved_by_choices'] ?? mech['resolvedByChoices']),
          ),
        ]),
      ];
    default:
      return [fallbackObjectBlock(mech, type ? humanizeText(type) : undefined)];
  }
}

export function buildOptionBlocks(options: unknown, choiceType?: string): MechanicsBlock[] {
  if (!options) return [];
  if (!Array.isArray(options)) return [fallbackObjectBlock(asRecord(options))];

  const blocks: MechanicsBlock[] = [];
  for (const raw of options) {
    if (typeof raw === 'string') {
      blocks.push({
        title: prettyOptionId(raw, choiceType),
        rows: [],
        badges: choiceType === 'ability_score_increase' ? ['+1'] : [],
      });
      continue;
    }

    const opt = asRecord(raw);
    const nested = opt['options'];
    if (Array.isArray(nested) && nested.length > 0) {
      blocks.push({
        title: String(opt['name'] ?? prettyOptionId(String(opt['id'] ?? ''), choiceType)),
        desc: opt['desc'] ? String(opt['desc']) : undefined,
        rows: languageGrantRows(opt),
        badges: damageBadge(opt),
        children: buildOptionBlocks(nested, choiceType),
      });
      continue;
    }

    blocks.push(parseOptionObject(opt, choiceType));
  }
  return blocks;
}

export function buildOptionGroupBlocks(groups: unknown): { name: string; blocks: MechanicsBlock[] }[] {
  if (!Array.isArray(groups)) return [];
  return groups.map((g) => {
    const group = asRecord(g);
    const name = String(group['name'] ?? group['id'] ?? 'Groupe');
    const opts = group['options'] ?? group['pool'] ?? group['items'];
    return { name, blocks: buildOptionBlocks(opts, String(group['type'] ?? '')) };
  });
}

function parseBreathWeapon(mech: Record<string, unknown>): MechanicsBlock {
  const progression = Array.isArray(mech['damage_progression'] ?? mech['damageProgression'])
    ? (mech['damage_progression'] ?? mech['damageProgression']) as unknown[]
    : [];

  const progLines = progression.map((step) => {
    const s = asRecord(step);
    const dice = asRecord(s['dice']);
    const lvl = s['unlocks_at_level'] ?? s['unlocksAtLevel'];
    return row(`Niveau ${lvl}`, formatDice(dice));
  });

  const save = asRecord(mech['save']);
  return block('Souffle draconique', [
    row('Action', humanizeText(String(mech['action_type'] ?? mech['actionType'] ?? 'action'))),
    row('Recharge', rechargeLabel(String(mech['recharge'] ?? ''))),
    row('JS', save['dc_formula'] ? String(save['dc_formula']) : '8 + maîtrise + mod. CON (lignée)'),
    row('Zone / dégâts', 'Déterminés par l’ascendance draconique'),
    ...progLines,
  ]);
}

function parseInnateSpellcasting(mech: Record<string, unknown>): MechanicsBlock {
  const spells = Array.isArray(mech['innate_spells'] ?? mech['innateSpells'])
    ? (mech['innate_spells'] ?? mech['innateSpells']) as unknown[]
    : [];

  return block('Magie innée', [
    row('Caractéristique', abilityLabel(String(mech['spellcasting_ability'] ?? mech['spellcastingAbility'] ?? ''))),
    ...spells.map((raw) => {
      const s = asRecord(raw);
      const lvl = s['unlocks_at_level'] ?? s['unlocksAtLevel'];
      const spell = refLabel(String(s['spell_id'] ?? s['spellId'] ?? ''));
      const cast = s['cast_as_spell_level'] ?? s['castAsSpellLevel'];
      const recharge = rechargeLabel(String(s['recharge'] ?? ''));
      const dice = s['dice'] ? ` · ${formatDice(asRecord(s['dice']))}` : '';
      return row(`Niv. ${lvl}`, `${spell} (sort niv. ${cast}) · ${recharge}${dice}`);
    }),
  ]);
}

function parseCompound(mech: Record<string, unknown>): MechanicsBlock[] {
  const blocks: MechanicsBlock[] = [];
  const advantages = mech['advantages'];
  if (Array.isArray(advantages) && advantages.length > 0) {
    blocks.push(
      block('Avantages', advantages.map((a) => {
        const adv = asRecord(a);
        return row(
          humanizeText(String(adv['type'] ?? 'Avantage')),
          [
            adv['target'] ? refLabel(String(adv['target'])) : '',
            adv['condition'] ? String(adv['condition']) : '',
          ]
            .filter(Boolean)
            .join(' · ') || '—',
        );
      })),
    );
  }

  const immunities = mech['immunities'];
  if (Array.isArray(immunities) && immunities.length > 0) {
    blocks.push(
      block('Immunités', [
        row('Effets', immunities.map((i) => refLabel(String(i))).join(', ')),
      ]),
    );
  }

  const items = mech['items'];
  if (Array.isArray(items) && items.length > 0) {
    for (const item of items) {
      blocks.push(...buildMechanicsBlocks(item));
    }
  }

  if (blocks.length === 0) return [fallbackObjectBlock(mech, 'Effets combinés')];
  return blocks;
}

function parseSavingThrow(mech: Record<string, unknown>): MechanicsBlock {
  return block('Jet de sauvegarde', [
    row('Cible', refLabel(String(mech['target'] ?? ''))),
    row('Condition', humanizeText(String(mech['condition'] ?? ''))),
    row('Effet', humanizeText(String(mech['effect'] ?? ''))),
  ]);
}

function parseProficiency(mech: Record<string, unknown>, type: string): MechanicsBlock {
  const label = type.replace(/_/g, ' ');
  const weapons = mech['weapons'] ?? mech['weapon_ids'] ?? mech['weaponIds'];
  const tools = mech['tools'] ?? mech['tool_ids'] ?? mech['toolIds'];
  const skills = mech['skills'] ?? mech['skill_ids'] ?? mech['skillIds'];
  const rows: MechanicsRow[] = [];
  if (weapons) rows.push(row('Armes', listRefs(weapons)));
  if (tools) rows.push(row('Outils', listRefs(tools)));
  if (skills) rows.push(row('Compétences', listRefs(skills)));
  if (mech['count']) rows.push(row('Nombre', String(mech['count'])));
  if (rows.length === 0) return fallbackObjectBlock(mech, humanizeText(label));
  return block(humanizeText(label), rows);
}

function parseOptionObject(opt: Record<string, unknown>, choiceType?: string): MechanicsBlock {
  const area = asRecord(opt['breath_area'] ?? opt['breathArea'] ?? opt['area']);
  const rows: MechanicsRow[] = [];

  if (opt['damage_type'] ?? opt['damageType']) {
    rows.push(row('Dégâts', humanizeDamage(String(opt['damage_type'] ?? opt['damageType']))));
  }
  if (area && Object.keys(area).length > 0) {
    rows.push(row('Zone', formatBreathArea(area)));
  }
  if (opt['save_ability'] ?? opt['saveAbility']) {
    rows.push(row('Jet de sauvegarde', abilityLabel(String(opt['save_ability'] ?? opt['saveAbility']))));
  }
  if (opt['grants_language'] ?? opt['grantsLanguage']) {
    rows.push(row('Langue accordée', refLabel(String(opt['grants_language'] ?? opt['grantsLanguage']))));
  }
  if (opt['category']) rows.push(row('Catégorie', humanizeText(String(opt['category']))));

  return {
    title: String(opt['name'] ?? prettyOptionId(String(opt['id'] ?? ''), choiceType)),
    desc: opt['desc'] ? String(opt['desc']) : opt['lore_note'] ? String(opt['lore_note']) : undefined,
    note: opt['note'] ? String(opt['note']) : undefined,
    rows,
    badges: damageBadge(opt),
  };
}

function languageGrantRows(opt: Record<string, unknown>): MechanicsRow[] {
  const lang = opt['grants_language'] ?? opt['grantsLanguage'];
  return lang ? [row('Langue', refLabel(String(lang)))] : [];
}

function damageBadge(opt: Record<string, unknown>): string[] {
  const dt = opt['damage_type'] ?? opt['damageType'];
  return dt ? [humanizeDamage(String(dt))] : [];
}

function block(title: string | undefined, rows: MechanicsRow[]): MechanicsBlock {
  return { title, rows: rows.filter((r) => r.value && r.value !== '—' && r.value !== ''), badges: [] };
}

function row(label: string, value: string): MechanicsRow {
  return { label, value: value.trim() || '—' };
}

function fallbackObjectBlock(obj: Record<string, unknown>, title?: string): MechanicsBlock {
  const rows: MechanicsRow[] = [];
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'type') continue;
    rows.push({ label: humanizeKey(key), value: formatValue(val) });
  }
  return { title, rows, badges: [] };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === 'string')) return value.map((v) => refLabel(v)).join(', ');
    return value.map((v) => formatValue(v)).join(' · ');
  }
  try {
    const rec = asRecord(value);
    const compact = Object.entries(rec)
      .map(([k, v]) => `${humanizeKey(k)}: ${formatValue(v)}`)
      .join(' · ');
    return compact || '—';
  } catch {
    return String(value);
  }
}

function listRefs(value: unknown): string {
  if (!Array.isArray(value)) return formatValue(value);
  return value.map((v) => refLabel(String(v))).join(', ');
}

function formatDice(dice: Record<string, unknown>): string {
  const q = dice['quantity'] ?? dice['count'] ?? '?';
  const f = dice['faces'] ?? dice['die'] ?? '?';
  const mod = dice['modifier'] ?? dice['mod'] ?? 0;
  const modStr = Number(mod) > 0 ? ` + ${mod}` : Number(mod) < 0 ? ` − ${Math.abs(Number(mod))}` : '';
  return `${q}d${f}${modStr}`;
}

function formatBreathArea(area: Record<string, unknown>): string {
  const shape = SHAPE_LABELS[String(area['shape'] ?? '')] ?? String(area['shape'] ?? '');
  const len = area['length_m'] ?? area['lengthM'];
  const width = area['width_m'] ?? area['widthM'];
  const parts = [shape];
  if (len) parts.push(`${len} m`);
  if (width) parts.push(`largeur ${width} m`);
  return parts.filter(Boolean).join(' · ');
}

function formatResistanceList(value: unknown): string {
  if (!Array.isArray(value)) return formatValue(value);
  return value.map((v) => (String(v).includes('lineage') ? 'Selon la lignée draconique' : refLabel(String(v)))).join(', ');
}

function rechargeLabel(value: string): string {
  return RECHARGE_LABELS[value] ?? humanizeText(value);
}

function abilityLabel(code: string): string {
  if (!code) return '—';
  const key = apiCodeToAbilityKey(code);
  if (key) return ABILITY_KEY_TO_LABEL[key as AbilityKey];
  return humanizeText(code);
}

function refLabel(id: string): string {
  if (!id) return '—';
  if (id.startsWith('choice-')) return humanizeText(id.replace(/^choice-/, ''));
  if (id.startsWith('spl-')) return humanizeText(id.replace(/^spl-/, ''));
  if (id.startsWith('skill-') || id.startsWith('ski-')) return humanizeText(id.replace(/^(skill|ski)-/, ''));
  if (id.startsWith('lg-')) return humanizeText(id.replace(/^lg-/, '')) + ' (langue)';
  if (id.startsWith('damage-')) return humanizeDamage(id);
  return prettyOptionId(id);
}

export function prettyOptionId(id: string, choiceType?: string): string {
  const ability = apiCodeToAbilityKey(id);
  if (ability) return ABILITY_KEY_TO_LABEL[ability as AbilityKey];
  if (choiceType === 'dragon_lineage' && id.startsWith('drag-')) {
    return id.replace(/^drag-/, '').replace(/^\w/, (c) => c.toUpperCase());
  }
  return id
    .replace(/^(tl|lg|drag|gen|wp|ski|skill)-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizeDamage(id: string): string {
  return id
    .replace(/^damage-?/, '')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizeText(text: string): string {
  if (!text) return '—';
  return text.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
