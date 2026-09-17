/**
 * Apply extracted combat blocks onto creature JSON files.
 * Usage: node scripts/apply-creature-combat.mjs [path-to-extract.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const extractPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, 'scripts/_creature-combat-extract.json');

if (!fs.existsSync(extractPath)) {
  console.error('Missing extract file:', extractPath);
  process.exit(1);
}

const extract = JSON.parse(fs.readFileSync(extractPath, 'utf8'));
const index = JSON.parse(
  fs.readFileSync(path.join(root, 'DragonsGenerator.API/Data/index/creatures.json'), 'utf8'),
);
const byId = Object.fromEntries(index.creatures.map((c) => [c.id, c.file]));

let applied = 0;
for (const [id, block] of Object.entries(extract)) {
  const rel = byId[id];
  if (!rel) {
    // try walk
    console.warn('not in index, skip', id);
    continue;
  }
  const file = path.join(root, 'DragonsGenerator.API/Data', rel);
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (Array.isArray(block.traits)) j.traits = block.traits;
  if (Array.isArray(block.actions)) j.actions = block.actions;
  if (Array.isArray(block.reactions)) j.reactions = block.reactions;
  if (Array.isArray(block.legendary_actions)) j.legendary_actions = block.legendary_actions;
  if (typeof block.description === 'string' && block.description.trim()) {
    j.description = block.description.trim();
  } else if (typeof block.description_prefix === 'string' && block.description_prefix.trim()) {
    const cur = (j.description || '').trim();
    if (!cur.toLowerCase().startsWith(block.description_prefix.trim().toLowerCase().slice(0, 20))) {
      j.description = (block.description_prefix.trim() + ' ' + cur).replace(/\s+/g, ' ').trim();
    }
  }
  fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n', 'utf8');
  applied++;
  console.log('applied', id, 'actions=', (j.actions || []).length, 'traits=', (j.traits || []).length);
}
console.log('done', applied);
