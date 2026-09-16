/**
 * Remplit les descriptions stub/OCR des créatures depuis Dragons_3.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const creRoot = path.join(root, 'DragonsGenerator.API/Data/Creatures');
const mdPath = path.join(root, 'source/Dragons_3_Bestiaire_Créatures.md');

const md = fs.readFileSync(mdPath, 'utf8');

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (ent.name.endsWith('.json')) out.push(p);
  }
  return out;
}

function cleanLore(text) {
  let t = text;
  t = t.replace(/Anthony Martin Romero\s*\(Order\s*#\d+\)/gi, ' ');
  t = t.replace(/<page_number>.*?<\/page_number>/gi, ' ');
  t = t.replace(/\b(Logo|icon|icone|Icône|stamp|photograph|decorative divider)\b/gi, ' ');
  t = t.replace(/\bTLTSLLTTPE\b/g, ' ');
  t = t.replace(/\*\*/g, '');
  t = t.replace(/^#+\s*/gm, '');
  t = t.replace(/\n{3,}/g, '\n\n');
  t = t.replace(/[ \t]{2,}/g, ' ');
  return t.trim();
}

function isStub(desc, name) {
  const d = (desc || '').trim();
  if (!d) return true;
  if (d.length < 80) return true;
  if (/^(icon|icone|logo|---)/i.test(d)) return true;
  if (d === name) return true;
  if (/^\d+\s*\(/.test(d)) return true;
  if (/^[A-ZÇÉÈÀ]$/i.test(d)) return true;
  if (/icon$/i.test(d)) return true;
  if (/^Giant spider/i.test(d)) return true;
  if (/de taille Gig/i.test(d) && d.length < 100) return true;
  if (/^Élémentaire \(feu\)/i.test(d) && d.length < 80) return true;
  if (/^1d6 Humeur/i.test(d)) return true;
  return false;
}

/** Extract lore paragraphs before the first stat-block marker after a # Name heading. */
function extractLore(creatureName) {
  const name = creatureName.trim();
  if (!name || name.length < 2) return null;

  // Prefer # Heading that is followed by prose (not immediately a type line)
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `(?:^|\\n)#\\s+${escaped}\\s*\\n+([\\s\\S]{20,2500}?)(?=\\n#\\s+|\\n•\\s+\\*\\*Classe d'|\\nMonstruosité|\\nBête de taille|\\nHumanoïde|\\nCréature|\\nMort-vivant|\\nDragon de taille|\\nFée de taille|\\nAberration|\\nÉlémentaire|\\nPlante de taille|\\nVase de taille)`,
    'i',
  );
  const m = md.match(re);
  if (!m) return null;
  let body = m[1];
  // Drop subsection headings but keep their paragraphs
  body = body.replace(/^##\s+.+$/gm, '');
  body = cleanLore(body);
  // Keep first 2-4 substantial paragraphs
  const paras = body
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter((p) => p.length > 40 && !/^•/.test(p) && !/^\|/.test(p) && !/Classe d'armure/i.test(p));
  if (!paras.length) return null;
  const joined = paras.slice(0, 3).join(' ');
  if (joined.length < 60) return null;
  return joined.slice(0, 1200);
}

/** Fallback short blurbs for common beasts without lore chapters. */
const FALLBACKS = {
  Aigle: 'Rapace diurne de grande envergure. Vue perçante ; souvent familier ou animal de chasse.',
  'Aigle géant':
    "Immense rapace intelligent capable de parler. Monture et allié redoutable dans les massifs montagneux.",
  Faucon: 'Petit rapace au vol agile. Vue perçante ; familier courant des druides et rôdeurs.',
  'Faucon de sang':
    "Rapace agressif lié aux rites du sang. Plus dangereux qu'un faucon ordinaire, souvent dressé pour la chasse ou la guerre.",
  Renard: 'Petit canidé rusé des bois et campagnes. Discret, vif, difficile à surprendre.',
  Blaireau:
    'Mammifère fouisseur trapu, tenace au combat lorsqu’il est acculé.',
  'Blaireau géant':
    "Version monstrueuse du blaireau, capable d'affronter un aventurier débutant. Fouisseur agressif.",
  Minotaure:
    "Légendaire gardien de labyrinthes, créé par des rites bestiaux de l'antique empire de Bail. Incarnation de la sauvagerie, attiré par la violence et lié mystiquement aux dédales.",
  Schatz: 'Créature du Bestiaire Dragons — voir la fiche stats pour le profil de combat.',
  'Jeune schatz': 'Jeune spécimen de schatz. Voir la fiche stats pour le profil de combat.',
};

const OCR_STUB =
  'Description absente du Bestiaire source (entrée OCR / incomplète).';

let filled = 0;
let fallback = 0;
let ocrLeft = 0;
const changed = [];

for (const file of walk(creRoot)) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!isStub(j.description, j.name)) continue;

  let lore = extractLore(j.name);
  // try without accents / parentheses
  if (!lore && j.name) {
    const simple = j.name.replace(/\s*\(.*?\)\s*/g, '').trim();
    if (simple !== j.name) lore = extractLore(simple);
  }

  let next;
  if (lore) {
    next = lore;
    filled++;
  } else if (FALLBACKS[j.name]) {
    next = FALLBACKS[j.name];
    fallback++;
  } else if (
    /cre-\d+$/i.test(j.id) ||
    /cre-adulte/i.test(j.id) ||
    /spider-icon/i.test(j.id) ||
    /mille-visages/i.test(j.id) ||
    /jeune-dragon-d-agate/i.test(j.id)
  ) {
    next = OCR_STUB;
    ocrLeft++;
  } else if (j.type && String(j.type).length > 10) {
    next = `${j.name}. ${j.type}. Voir la fiche pour le profil de combat.`;
    fallback++;
  } else {
    next = OCR_STUB;
    ocrLeft++;
  }

  if (next !== j.description) {
    j.description = next;
    fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n', 'utf8');
    changed.push(path.basename(file));
  }
}

console.log(
  JSON.stringify({ filledFromSource: filled, fallback, ocrStub: ocrLeft, changed: changed.length, files: changed }, null, 2),
);
