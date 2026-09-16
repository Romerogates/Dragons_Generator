/**
 * Dump source snippets for empty spells from Livre de magie.
 * Usage: node scripts/extract-empty-spell-sources.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(
  path.join(__dirname, '..', 'source', 'Dragons_2_Livre_de_magie.md'),
  'utf8',
);

const names = [
  'Un message étrange',
  'Cauchemar',
  'Privation de sommeil',
  'Simulacre de vie',
  'Appel de destrier volant',
  'Arme vengeresse',
  'Provenance de la nourriture',
  'Tyrannie',
  "L'avant-poste des fées",
  'Soif de sang',
  'Appel de destrier',
  'Échos des disparus',
  "Invocation d'élémentaires",
  'Mythes et légendes',
  'Remonter le cours du temps récent',
  'Interdiction',
  'Invocation de fée ou de ravageur',
  'Tempête en marche',
  'Inversion de la gravité',
  'Bagou',
];

for (const n of names) {
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|\\n)(?:#+\\s*)?${escaped}\\b`, 'i');
  const m = re.exec(src);
  if (!m) {
    console.log('MISSING', n);
    continue;
  }
  console.log('\n==========', n, '@', m.index, '==========');
  console.log(src.slice(m.index, m.index + 1100));
}
