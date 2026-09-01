#!/usr/bin/env node
/**
 * Valide les JSON de classes (schéma 3.0) avant déploiement.
 * Usage : node scripts/validate-class-json.mjs
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const classDir = join(root, 'DragonsGenerator.API', 'Data', 'Classes');

const SPELLCASTING_CLASSES = new Set([
  'cls-magicien',
  'cls-ensorceleur',
  'cls-sorcier',
  'cls-pretre',
  'cls-druide',
  'cls-barde',
  'cls-rodeur',
  'cls-paladin',
]);

const DEFAULT_SKILL_POOL_CLASSES = new Set(['cls-barbare', 'cls-druide']);

function hasSkillPool(data) {
  const pools = data.choice_pools ?? [];
  return pools.some((p) => {
    const type = p.type ?? '';
    return type === 'skill_proficiency' || type === 'skill';
  });
}

function hasEquipmentChoices(data) {
  const se = data.starting_equipment;
  if (se && !Array.isArray(se)) {
    const fixed = se.fixed ?? [];
    const pools = se.choice_pools ?? [];
    if (fixed.length || pools.length) return true;
  }
  const rootPools = data.choice_pools ?? [];
  return rootPools.some((p) => {
    const type = p.type ?? '';
    return type === 'equipment' || type === 'starting_equipment';
  });
}

function validateStartingEquipment(data, file, errors) {
  if (!hasEquipmentChoices(data)) {
    errors.push(`${file}: no starting equipment (fixed, choice_pools, or equipment pools)`);
  }
}

const files = (await readdir(classDir)).filter((f) => f.startsWith('cls-') && f.endsWith('.json'));
const errors = [];

for (const file of files) {
  const raw = await readFile(join(classDir, file), 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    errors.push(`${file}: invalid JSON`);
    continue;
  }

  const expectedId = file.replace(/\.json$/, '');
  if (data.id !== expectedId) {
    errors.push(`${file}: id "${data.id}" does not match filename`);
  }
  if (!data.name?.trim()) errors.push(`${file}: missing name`);
  if (!data.hit_die) errors.push(`${file}: missing hit_die`);

  if (!hasSkillPool(data) && !DEFAULT_SKILL_POOL_CLASSES.has(data.id)) {
    errors.push(`${file}: no skill_proficiency choice_pool (and no frontend default)`);
  }

  validateStartingEquipment(data, file, errors);

  if (SPELLCASTING_CLASSES.has(data.id) && !data.spellcasting) {
    errors.push(`${file}: spellcasting class without spellcasting block`);
  }
}

if (errors.length) {
  console.error('Class JSON validation failed:\n' + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}

console.log(`OK — ${files.length} class files validated.`);
