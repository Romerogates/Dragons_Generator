/**
 * Nettoie les descriptions de sorts (artefacts OCR des livres sources).
 * Usage: node scripts/clean-spell-ocr.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const spellsRoot = path.join(__dirname, '..', 'DragonsGenerator.API', 'Data', 'Spells');

export function cleanSpellOcrText(description) {
  if (!description || typeof description !== 'string') return description;
  let text = description;

  // Filigranes / crédits
  text = text.replace(/\bAnthony Martin Romero\b/gi, ' ');
  text = text.replace(/\bMartin Romero\b/gi, ' ');
  text = text.replace(/\(Order\s*#\d+\)/gi, ' ');
  text = text.replace(/\bOrder\s*#\d+\b/gi, ' ');

  // Alt text / blocs décoratifs
  text = text.replace(/\bDecorative icons?\b/gi, ' ');
  text = text.replace(/\bDecorative elements?\b/gi, ' ');
  text = text.replace(/\bDecorative text blocks?\b/gi, ' ');
  text = text.replace(/\bDecorative letter [A-Z][^.]*\.?/gi, ' ');
  text = text.replace(/\bDecorative border[^.]*\.?/gi, ' ');
  text = text.replace(/\bDecorative illustration[^.]*\.?/gi, ' ');
  text = text.replace(/\bIllustration of [^.]*\.?/gi, ' ');
  text = text.replace(/\bIllustration d['’][^.]*\.?/gi, ' ');
  text = text.replace(/\bPhotograph[^.]*\.?/gi, ' ');
  text = text.replace(/\bSpell icons? for \d+\w*\s+level\s+\w+/gi, ' ');
  text = text.replace(/\bDiagramme de glyphe\b/gi, ' ');
  text = text.replace(/\bIcone?\b(?=\s+\*\*)/gi, ' ');
  text = text.replace(/\bIcon,\s*logo[^.]*\.?/gi, ' ');
  text = text.replace(/\bLogo( de sort)?\b/gi, ' ');
  text = text.replace(/\bLogo,\s*icon,\s*and(\s*stamp)?\b/gi, ' ');
  text = text.replace(/\band\s+icons?\b/gi, ' ');
  text = text.replace(/\bstamp\b/gi, ' ');
  text = text.replace(/\bLettre ornée D\b/gi, ' ');
  text = text.replace(/^(and)\s+/i, '');
  text = text.replace(/^(icons?)\s+/i, '');
  text = text.replace(/\b[A-Za-zÀ-ÿ'’\-]+ illustration\b/gi, ' ');
  text = text.replace(/\b[A-Za-zÀ-ÿ'’\-]+ logo\b/gi, ' ');
  text = text.replace(/\b[A-Za-zÀ-ÿ'’\-]+ icon\b/gi, ' ');
  text = text.replace(/\bSanglier illustration\b/gi, ' ');
  text = text.replace(/<page_number>\d+<\/page_number>/gi, ' ');
  text = text.replace(/<page_number>\*\*\d+\*\*<\/page_number>/gi, ' ');
  text = text.replace(/\b\d{2,3}\b(?=\s*(?:Sanglier|Illustration|Anthony|Martin))/g, ' ');

  // Titres markdown collés
  text = text.replace(/\s*##\s+/g, '\n\n## ');
  text = text.replace(/\s*###\s+/g, '\n\n### ');

  // « Vous » tronqué
  text = text.replace(/\.\s+D Jous\b/g, '. Vous');
  text = text.replace(/\bD Jous\b/g, 'Vous');
  text = text.replace(/\bJous\b/g, 'Vous');
  text = text.replace(/\bV ous\b/g, 'Vous');
  text = text.replace(/\bD ous\b/g, 'Vous');
  text = text.replace(/\bJouhait\b/g, 'Souhait');
  text = text.trim();
  if (text.startsWith('ous ')) text = `V${text}`;
  if (/^D\s+Vous\b/.test(text)) text = text.replace(/^D\s+/, '');
  if (/^D\s+Du\b/.test(text)) text = text.replace(/^D\s+/, '');
  if (/^C\s+Choisissez\b/.test(text)) text = text.replace(/^C\s+/, '');
  text = text.replace(/\bO\s+\*\*/g, '**');

  text = text.replace(/[ \t]{2,}/g, ' ');
  text = text.replace(/ *\n */g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith('.json')) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of walk(spellsRoot)) {
  const raw = fs.readFileSync(file, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    console.warn('skip parse', file);
    continue;
  }
  let dirty = false;
  if (typeof data.description === 'string') {
    const next = cleanSpellOcrText(data.description);
    if (next !== data.description) {
      data.description = next;
      dirty = true;
    }
  }
  if (typeof data.higher_levels === 'string') {
    const next = cleanSpellOcrText(data.higher_levels);
    if (next !== data.higher_levels) {
      data.higher_levels = next;
      dirty = true;
    }
  }
  if (dirty) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
    changed += 1;
    console.log('cleaned', path.relative(spellsRoot, file));
  }
}
console.log(`Done. ${changed} file(s) updated.`);
