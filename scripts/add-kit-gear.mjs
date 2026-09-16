/**
 * Ajoute les objets d'équipement manquants des kits (sacs) depuis Dragons_1,
 * aligne le grimoire, et régénère l'index equipments.json depuis le filesystem.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const gearDir = path.join(root, 'DragonsGenerator.API/Data/Equipment/gear');
const equipRoot = path.join(root, 'DragonsGenerator.API/Data/Equipment');
const indexPath = path.join(root, 'DragonsGenerator.API/Data/index/equipments.json');

const items = [
  {
    id: 'gr-sac-a-dos',
    name: 'Sac à dos',
    subcategory: 'container',
    cost: { value: 2, unit: 'po' },
    weight_kg: 2.5,
    description:
      "Contenant de 30 l / 30 kg d'équipement. Des objets comme un sac de couchage ou un rouleau de corde peuvent être attachés à l'extérieur.",
  },
  {
    id: 'gr-sac-de-couchage',
    name: 'Sac de couchage',
    subcategory: null,
    cost: { value: 1, unit: 'po' },
    weight_kg: 3.5,
    description: 'Couverture rembourrée pour dormir à la belle étoile ou au campement.',
  },
  {
    id: 'gr-gamelle',
    name: 'Gamelle',
    subcategory: null,
    cost: { value: 2, unit: 'pa' },
    weight_kg: 0.5,
    description:
      "Récipient en étain avec tasse et couverts. Deux parties détachables : casserole d'un côté, assiette ou bol de l'autre.",
  },
  {
    id: 'gr-torche',
    name: 'Torche',
    subcategory: null,
    cost: { value: 1, unit: 'pc' },
    weight_kg: 0.5,
    description:
      "Brûle 1 heure : lumière vive 6 m, lumière faible 6 m de plus. Attaque au corps à corps avec une torche allumée : 1 dégât de feu en cas de touche.",
  },
  {
    id: 'gr-outre',
    name: 'Outre',
    subcategory: 'container',
    cost: { value: 2, unit: 'pa' },
    weight_kg: 2.5,
    description: "Outre en peau, capacité 2 l (poids indiqué pleine).",
  },
  {
    id: 'gr-corde-en-chanvre',
    name: 'Corde en chanvre (15 m)',
    subcategory: null,
    cost: { value: 1, unit: 'po' },
    weight_kg: 5,
    description:
      "Corde de 15 m, diamètre ~20 mm. Supporte jusqu'à 3 tonnes avant de rompre. 5 PV face aux dégâts tranchants ou au feu.",
  },
  {
    id: 'gr-corde-en-soie',
    name: 'Corde en soie (15 m)',
    subcategory: null,
    cost: { value: 100, unit: 'po' },
    weight_kg: 1,
    description:
      "Corde de 15 m en soie d'araignée géante, diamètre ~10 mm. Supporte jusqu'à 5 tonnes avant de rompre. 5 PV face aux dégâts tranchants ou au feu.",
  },
  {
    id: 'gr-huile',
    name: 'Huile (flasque)',
    subcategory: null,
    cost: { value: 1, unit: 'pa' },
    weight_kg: 0.5,
    description:
      "Flasque d'un demi-litre. Action pour répandre (1,50 m) ou lancer (6 m) comme arme improvisée : la cible est couverte d'huile. Si elle subit des dégâts de feu dans la minute, elle prend 5 dégâts de feu de plus. Peut aussi enflammer une zone de 1,50 m de côté (2 rounds, 5 dégâts de feu).",
  },
  {
    id: 'gr-pied-de-biche',
    name: 'Pied-de-biche',
    subcategory: null,
    cost: { value: 2, unit: 'po' },
    weight_kg: 2.5,
    description:
      "Confère un avantage aux tests de Force lorsque l'effet de levier s'applique efficacement.",
  },
  {
    id: 'gr-piton',
    name: 'Piton',
    subcategory: null,
    cost: { value: 5, unit: 'pc' },
    weight_kg: 0.125,
    description: "Pointe métallique à planter dans la roche ou le bois pour l'escalade ou l'ancrage.",
  },
  {
    id: 'gr-marteau',
    name: 'Marteau',
    subcategory: null,
    cost: { value: 1, unit: 'po' },
    weight_kg: 1.5,
    description: 'Marteau utilitaire pour planter des pitons, enfoncer des clous ou des travaux de campement.',
  },
  {
    id: 'gr-lampe',
    name: 'Lampe',
    subcategory: null,
    cost: { value: 5, unit: 'pa' },
    weight_kg: 0.5,
    description:
      "Lampe à huile. Avec une flasque d'huile : lumière vive 4,50 m et lumière faible 4,50 m de plus pendant 6 heures.",
  },
  {
    id: 'gr-savon',
    name: 'Savon',
    subcategory: null,
    cost: { value: 2, unit: 'pc' },
    weight_kg: null,
    description: 'Pain de savon pour la toilette.',
  },
  {
    id: 'gr-clochette',
    name: 'Clochette',
    subcategory: null,
    cost: { value: 1, unit: 'po' },
    weight_kg: null,
    description: 'Petite cloche métallique. Son audible à une bonne distance ; utile en alarme ou diversion.',
  },
  {
    id: 'gr-ficelle',
    name: 'Ficelle (3 m)',
    subcategory: null,
    cost: { value: 1, unit: 'pc' },
    weight_kg: null,
    description: 'Bobine de ficelle d’environ 3 m, pour pièges rudimentaires, attaches ou repères.',
  },
  {
    id: 'gr-tente',
    name: 'Tente (deux places)',
    subcategory: null,
    cost: { value: 2, unit: 'po' },
    weight_kg: 10,
    description: 'Tente simple pour deux personnes.',
  },
  {
    id: 'gr-palan',
    name: 'Palan',
    subcategory: null,
    cost: { value: 1, unit: 'po' },
    weight_kg: 2.5,
    description:
      "Jeu de poulies et câble à crochet. Permet de hisser le quadruple du poids que vous pourriez normalement soulever.",
  },
  {
    id: 'gr-craie',
    name: 'Craie (boîte de 10)',
    subcategory: null,
    cost: { value: 1, unit: 'pc' },
    weight_kg: null,
    description: 'Boîte de 10 bâtons de craie pour marquer murs, sols ou parchemins.',
  },
  {
    id: 'gr-echelle',
    name: 'Échelle (3 m)',
    subcategory: null,
    cost: { value: 1, unit: 'pa' },
    weight_kg: 12.5,
    description: 'Échelle portable de 3 m.',
  },
];

let created = 0;
for (const item of items) {
  const file = path.join(gearDir, `${item.id}.json`);
  if (fs.existsSync(file)) {
    console.log('skip existing', item.id);
    continue;
  }
  const json = {
    schema_version: '2.0',
    id: item.id,
    name: item.name,
    category: 'gear',
    subcategory: item.subcategory,
    cost: item.cost,
    weight_kg: item.weight_kg,
    description: item.description,
  };
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
  created++;
  console.log('created', item.id);
}

// Align it-grimoire on source (350 pages vélin) ; retirer le doublon gr-grimoire
const itGrimoire = {
  schema_version: '2.0',
  id: 'it-grimoire',
  name: 'Grimoire',
  category: 'gear',
  subcategory: null,
  cost: { value: 50, unit: 'po' },
  weight_kg: 1,
  description:
    'Indispensable pour les magiciens. Épais volume relié de cuir contenant 350 pages de vélin vierge sur lesquelles inscrire leurs sorts.',
};
fs.writeFileSync(
  path.join(gearDir, 'it-grimoire.json'),
  JSON.stringify(itGrimoire, null, 2) + '\n',
  'utf8',
);
const dup = path.join(gearDir, 'gr-grimoire.json');
if (fs.existsSync(dup)) {
  fs.unlinkSync(dup);
  console.log('removed duplicate gr-grimoire.json');
}

function walkJson(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkJson(p));
    else if (ent.name.endsWith('.json')) out.push(p);
  }
  return out;
}

const files = walkJson(equipRoot);
const indexItems = [];
const byCat = {};

for (const file of files) {
  const rel = path.relative(path.join(root, 'DragonsGenerator.API/Data'), file).replaceAll('\\', '/');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cat = data.category || path.basename(path.dirname(file));
  byCat[cat] = (byCat[cat] || 0) + 1;
  const entry = {
    id: data.id,
    name: data.name,
    category: cat,
    subcategory: data.subcategory ?? null,
    cost: data.cost ?? { value: null, unit: 'po' },
    weight_kg: data.weight_kg ?? null,
    file: rel,
  };
  if (cat === 'armor') {
    if (data.ac_base != null) entry.ac_base = data.ac_base;
    if (data.str_required !== undefined) entry.str_required = data.str_required;
    if (data.stealth_disadvantage !== undefined) entry.stealth_disadvantage = data.stealth_disadvantage;
  }
  if (cat === 'weapon') {
    if (data.damage_dice != null) entry.damage_dice = data.damage_dice;
    if (data.damage_type != null) entry.damage_type = data.damage_type;
    if (Array.isArray(data.properties)) entry.properties = data.properties;
  }
  indexItems.push(entry);
}

indexItems.sort((a, b) => a.id.localeCompare(b.id, 'fr'));

const index = {
  schema_version: '2.0',
  description:
    "Index des équipements (armes, armures, outils, objets, montures, véhicules, services). Chaque entrée référence son fichier JSON dans Equipment/<category>/.",
  stats: {
    total: indexItems.length,
    by_category: Object.fromEntries(Object.entries(byCat).sort(([a], [b]) => a.localeCompare(b))),
  },
  items: indexItems,
};

fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n', 'utf8');
console.log(`index rebuilt: ${indexItems.length} items, created ${created} gear files`);
