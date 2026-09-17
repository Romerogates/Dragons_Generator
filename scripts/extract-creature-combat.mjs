/**
 * Extract Traits/Actions/Reactions/Legendary from Dragons_3 around known headings.
 * Writes scripts/_creature-combat-extract.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const mdPath = path.join(root, 'source/Dragons_3_Bestiaire_Créatures.md');
const md = fs.readFileSync(mdPath, 'utf8');
const lines = md.split(/\r?\n/);

/** Search windows: id -> regex to find start of combat profile section */
const TARGETS = [
  { id: 'cre-maitre-assassin', start: /Icon \*\*Maître assassin\*\*|### Icon \*\*Maître assassin\*\*/i },
  { id: 'cre-synthia-paladine', start: /## Logo \*\*Paladin\*\*|### Logo \*\*Paladin\*\*|^# Paladin\s*$/m },
  { id: 'cre-itelgini-haut-chamane', start: /Logo \*\*Haut chamane\*\*|### Logo \*\*Haut chamane\*\*/i },
  { id: 'cre-berserker-sacre', start: /### Berserker sacr[ée]/i },
  { id: 'cre-kentigern-le-seigneur-vampire', start: /^# Kentigern le seigneur vampire/m },
  { id: 'cre-reine-salamandre-tssikrreta', start: /### Reine salamandre Tssikrreta/i },
  { id: 'cre-dragon-de-cuivre-venerable', start: /## Dragon de cuivre vénérable|^# Dragon de cuivre vénérable/m },
  { id: 'cre-delsednae', start: /^# Delsednae\s*$/m },
  { id: 'cre-ez-galwyn', start: /## Ez['’]Galwyn/i },
  { id: 'cre-ame-en-peine', start: /### Âme-en-peine|^# Âme-en-peine/m },
  { id: 'cre-ecclesiastique', start: /### Ecclésiastique|^# Ecclésiastique/m },
  { id: 'cre-guerrier-gobelin', start: /### Guerrier gobelin/i },
  { id: 'cre-brute-gobelourse', start: /### Brute gobelourse/i },
  { id: 'cre-queteuse-gobelours', start: /### Quêteuse gobelours/i },
  { id: 'cre-araignees-nuee', start: /### Araignées - Nuée/i },
  { id: 'cre-lycose-geante', start: /### Lycose géante/i },
  { id: 'cre-chaine-animee', start: /## Chaîne animée/i },
];

function clean(text) {
  let t = text;
  t = t.replace(/Anthony Martin Romero\s*\(Order\s*#\d+\)/gi, ' ');
  t = t.replace(/<page_number>.*?<\/page_number>/gi, ' ');
  t = t.replace(/\b(Logo|icon|icone|Icône|stamp|photograph)\b/gi, ' ');
  t = t.replace(/~~([^~]+)~~/g, '$1');
  t = t.replace(/\*\*/g, '');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

function findStart(re) {
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) return i;
  }
  // fallback: search in full md
  const m = md.match(re);
  if (!m) return -1;
  const idx = md.indexOf(m[0]);
  // map char to line
  let pos = 0;
  for (let i = 0; i < lines.length; i++) {
    pos += lines[i].length + 1;
    if (pos > idx) return i;
  }
  return -1;
}

function sliceUntilNextMajor(startLine) {
  const out = [];
  for (let i = startLine; i < Math.min(lines.length, startLine + 250); i++) {
    const L = lines[i];
    if (i > startLine + 5 && /^#\s+[^#]/.test(L) && !/Traits|Actions|Réactions|Reactions|légendaire/i.test(L)) {
      // stop at next top-level creature chapter (but allow ### subsections)
      if (/^#\s/.test(L) && !/^##/.test(L)) break;
    }
    if (i > startLine + 30 && /^#\s+[A-ZÉÈÀÂÄÔÙÛÎÏÇ]/.test(L) && !/^##/.test(L) && !/Incarner|Traits|Actions/i.test(L)) {
      break;
    }
    out.push(L);
  }
  return out.join('\n');
}

function parseNamedBlocks(sectionText, sectionLabel) {
  // Find ### Traits / ### Actions etc (with possible OCR bold)
  const re = new RegExp(
    `(?:###\\s*\\*?\\*?\\s*${sectionLabel}|\\*\\*${sectionLabel}\\*\\*|###\\s*${sectionLabel})\\s*\\n([\\s\\S]*?)(?=\\n###\\s|\\n##\\s|#\\s+[A-ZÉ]|\\n\\*\\*(?:Traits|Actions|Réactions|Reactions|Actions légendaires))`,
    'i',
  );
  let m = sectionText.match(re);
  let body = m ? m[1] : '';
  if (!body) {
    // looser: from label to next ###
    const idx = sectionText.search(new RegExp(`${sectionLabel}`, 'i'));
    if (idx >= 0) {
      const rest = sectionText.slice(idx);
      const next = rest.search(/\n###\s|\n##\s[^#]/);
      body = next > 0 ? rest.slice(0, next) : rest.slice(0, 2000);
      body = body.replace(new RegExp(`^.*?${sectionLabel}\\*?\\*?\\s*`, 'i'), '');
    }
  }
  if (!body) return [];

  // Split on **Name.** or * **Name.** or lines starting with **Name.**
  const items = [];
  const pattern = /(?:^|\n)\s*(?:\*\s*)?\*\*([^*\n]+?)\*\*\.?\s*([\s\S]*?)(?=(?:\n\s*(?:\*\s*)?\*\*[^*\n]+?\*\*)|\n###|\n##\s|$)/g;
  let match;
  while ((match = pattern.exec(body)) !== null) {
    const name = clean(match[1]).replace(/\.$/, '');
    let desc = clean(match[2]);
    if (!name || name.length > 80) continue;
    if (/^(Traits|Actions|Réactions|Reactions|Actions légendaires)$/i.test(name)) continue;
    if (desc.length < 5 && name.length < 3) continue;
    items.push({ name, description: desc });
  }

  // Fallback: lines like **Name.** text
  if (!items.length) {
    const linePat = /\*\*([^*]+)\*\*\.\s*([^\n]+(?:\n(?!\*\*)[^\n]+)*)/g;
    while ((match = linePat.exec(body)) !== null) {
      items.push({ name: clean(match[1]), description: clean(match[2]) });
    }
  }
  return items.filter((it) => it.name && it.description);
}

const out = {};
const report = [];

for (const t of TARGETS) {
  const start = findStart(t.start);
  if (start < 0) {
    report.push({ id: t.id, error: 'start not found' });
    continue;
  }
  const section = sliceUntilNextMajor(start);
  const traits = parseNamedBlocks(section, 'Traits');
  const actions = parseNamedBlocks(section, 'Actions');
  const reactions = parseNamedBlocks(section, 'Réactions');
  const legendary = parseNamedBlocks(section, 'Actions légendaires');
  // Also try "Reactions" spelling
  const reactions2 = reactions.length ? reactions : parseNamedBlocks(section, 'Reactions');

  out[t.id] = {
    traits,
    actions,
    reactions: reactions2,
    legendary_actions: legendary,
    _meta: { startLine: start + 1, traits: traits.length, actions: actions.length },
  };
  report.push({
    id: t.id,
    start: start + 1,
    traits: traits.length,
    actions: actions.length,
    reactions: reactions2.length,
    legendary: legendary.length,
  });
}

const outPath = path.join(root, 'scripts/_creature-combat-extract.json');
// strip _meta before write for apply script
const cleanOut = {};
for (const [id, v] of Object.entries(out)) {
  const { _meta, ...rest } = v;
  cleanOut[id] = rest;
}
fs.writeFileSync(outPath, JSON.stringify(cleanOut, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report, null, 2));
console.log('wrote', outPath);
