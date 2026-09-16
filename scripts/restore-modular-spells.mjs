/**
 * Restore remaining modular / empty spells from Livre de magie.
 * Usage: node scripts/restore-modular-spells.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'DragonsGenerator.API', 'Data', 'Spells');

function write(rel, patch) {
  const file = path.join(root, rel);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  Object.assign(data, patch);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log('updated', rel);
}

write('level-0/spl-un-message-etrange.json', {
  name: 'Un message étrange',
  school: 'illusion',
  casting_time: { value: 1, unit: 'action' },
  range: { type: 'personnelle', distance_m: null, area: null },
  duration: { type: 'instantane', value: null, unit: null },
  components: { v: false, s: false, m: null },
  description:
    'Option modulaire du sort texte illusoire. Lorsqu’une créature autre que les destinataires lit le texte, elle peut effectuer un test de Sagesse (Intuition) contre votre DD de sauvegarde des sorts. Une réussite ne permet pas de lire le message caché, mais la créature a la sensation dérangeante que quelque chose lui échappe.\n\nAprès cette prise de conscience, un test d’Intelligence (Arcanes) DD 15 permet de savoir avec certitude que la magie est à l’œuvre.',
  higher_levels: null,
});

write('level-1/spl-cauchemar.json', {
  school: 'illusion',
  casting_time: { value: 1, unit: 'minute' },
  range: { type: 'speciale', distance_m: null, area: null },
  duration: { type: 'normal', value: 8, unit: 'heure' },
  components: {
    v: true,
    s: true,
    m: 'une poignée de sable, un petit peu d’encre, et une plume arrachée à un oiseau endormi',
  },
  is_concentration: false,
  is_corrupted: true,
  description:
    'Option modulaire du sort songe (variante corrompue). Vous pouvez donner une apparence monstrueuse et terrifiante au messager. Dans ce cas, le message doit se limiter à dix mots et la cible doit effectuer un JS Sagesse. En cas d’échec, les échos de cette monstruosité fantasmagorique donnent naissance à un cauchemar qui persiste le temps du sommeil de la cible et l’empêche de profiter de son repos. Par ailleurs, elle subit 3d6 dégâts psychiques au réveil.\n\nSi vous détenez un échantillon corporel de la cible, comme une mèche de cheveux, une rognure d’ongle ou quelque autre élément charnel lui appartenant, elle subit un désavantage au jet de sauvegarde.',
  higher_levels: null,
});

write('level-1/spl-privation-de-sommeil.json', {
  school: 'illusion',
  casting_time: { value: 1, unit: 'minute' },
  range: { type: 'speciale', distance_m: null, area: null },
  duration: { type: 'normal', value: 8, unit: 'heure' },
  components: {
    v: true,
    s: true,
    m: 'une poignée de sable, un petit peu d’encre, et une plume arrachée à un oiseau endormi',
  },
  is_corrupted: true,
  description:
    'Option modulaire du sort songe (variante cauchemar). Si la cible d’un cauchemar échoue son JS Sagesse avec une marge de 10 ou plus, la privation de sommeil et le choc mental l’épuisent, et elle subit 1 niveau de fatigue en plus des autres effets.',
  higher_levels:
    'Quand vous jetez ce sort en utilisant un emplacement de sort du 6e niveau ou supérieur, vous pouvez ajouter un effet par niveau d’emplacement au-dessus du 5e. Chaque effet peut être choisi plusieurs fois : +1d6 dégâts psychiques en cas d’échec au JS Sagesse (cauchemar) ; +1 niveau de fatigue en cas d’échec (cauchemar) ; élimination d’1 niveau de fatigue dans le cas d’un rêve.',
});

write('level-3/spl-provenance-de-la-nourriture.json', {
  school: 'invocation',
  casting_time: { value: 1, unit: 'action' },
  range: { type: 'personnelle', distance_m: null, area: null },
  duration: { type: 'instantane', value: null, unit: null },
  components: { v: true, s: true, m: null },
  description:
    'Option modulaire liée au festin des héros. La magie seule ne peut créer de la nourriture, seulement l’apporter. En pratique, festin des héros dérobe dans un rayon de 100 km des mets aux goûts du lanceur de sorts. Les habitants de la région seront rarement satisfaits de voir leur repas leur échapper. S’il n’y a rien à manger, ou juste des brouets infâmes, le banquet ne présentera que des assiettes vides ou des plats peu ragoûtants. La magie du festin enchantera cependant tout de même la nourriture pour lui donner des effets bienfaisants sur la santé.',
  higher_levels: null,
});

write('level-4/spl-l-avant-poste-des-fees.json', {
  name: "L'avant-poste des fées",
  school: 'invocation',
  casting_time: { value: 1, unit: 'minute' },
  range: { type: 'normal', distance_m: 36, area: null },
  duration: { type: 'normal', value: 8, unit: 'heure' },
  components: { v: true, s: true, m: null },
  description:
    'Option modulaire de l’abri du chasseur. Si vous lancez ce sort avec un emplacement de sort de 4e niveau ou supérieur, votre abri est un espace extradimensionnel de la même nature que les contrées enchantées.\n\nSi vous êtes allié avec des fées ou des djinns d’un royaume proche, votre abri comporte une issue menant à l’entrée de leur domaine. La distance en kilomètres qui sépare votre abri du royaume en question ne peut excéder le niveau de l’emplacement du sort. Les fées ou djinns du royaume peuvent librement emprunter l’issue et rejoindre votre abri. En revanche, vous ne pouvez pénétrer en leur domaine qu’avec leur accord.\n\nPar ailleurs, s’il y a de l’eau à proximité, votre abri en est pourvu (eau pure), et une lumière faible éclaire l’intérieur depuis les parois.',
  higher_levels:
    'Quand vous jetez ce sort en utilisant un emplacement de sort de niveau supérieur, la durée et la taille de l’abri s’accroissent (2e : 8 h / 15 m² ; 3e : 24 h / 30 m² ; 4e : 1 semaine / 50 m² ; 5e : permanent jusqu’à dissipation).',
});

write('level-5/spl-echos-des-disparus.json', {
  name: 'Échos des disparus',
  school: 'transmutation',
  casting_time: { value: 1, unit: 'heure' },
  range: { type: 'contact', distance_m: null, area: null },
  duration: { type: 'instantane', value: null, unit: null },
  components: { v: true, s: true, m: null },
  description:
    'Option modulaire de réincarnation. Si cette variante est utilisée, la magie copie l’apparence d’une personne dont la mort a eu lieu dans la région. Le meneur détermine les détails : qui, où, comment, quand ?\n\nSi le décès est récent et que sa nouvelle ne s’est pas répandue, la nouvelle identité du réincarné risque de lui poser des problèmes : quiproquos, dettes, rancunes, réputation fâcheuse, etc.',
  higher_levels:
    'Quand vous jetez ce sort en utilisant un emplacement de sort du 6e niveau ou supérieur, la mort peut remonter à 5 jours supplémentaires par niveau d’emplacement au-dessus du 5e.',
});

write('level-5/spl-invocation-d-elementaires.json', {
  name: "Invocation d'élémentaire",
  school: 'invocation',
  casting_time: { value: 1, unit: 'minute' },
  range: { type: 'normal', distance_m: 27, area: null },
  duration: { type: 'concentration', value: 1, unit: 'heure' },
  components: {
    v: true,
    s: true,
    m: 'de l’encens brûlant pour l’air, de l’argile douce pour la terre, du soufre et du phosphore pour le feu, de l’eau et du sable pour l’eau',
  },
  is_concentration: true,
  description:
    'Vous appelez un serviteur élémentaire. Choisissez une zone d’air, de terre, de feu ou d’eau emplissant un cube de 3 m d’arête à portée. Un élémentaire d’un facteur de puissance de 5 ou moins correspondant à la zone choisie apparaît dans un espace inoccupé, dans un rayon de 3 m de celle-ci. L’élémentaire disparaît quand il tombe à 0 point de vie ou quand le sort prend fin.\n\nL’élémentaire invoqué est amical envers vous et vos compagnons pour toute la durée du sort. Déterminez son initiative ; il a ses propres tours de jeu. Il obéit aux ordres verbaux que vous lui donnez (sans que cela ne vous coûte d’action). Si vous ne lui en donnez pas, il n’entreprend pas d’actions, mais se défend contre les créatures hostiles. Si votre concentration est interrompue, l’élémentaire ne disparaît pas. Vous en perdez le contrôle, il devient hostile envers vous et vos compagnons et est susceptible d’attaquer. Vous ne pouvez pas révoquer un élémentaire incontrôlé, qui disparaît 1 heure après que vous l’avez invoqué.',
  higher_levels:
    'Quand vous jetez ce sort en utilisant un emplacement de sort du 6e niveau ou supérieur, le facteur de puissance augmente de 1 par niveau d’emplacement au-dessus du 5e.',
});

write('level-5/spl-remonter-le-cours-du-temps-recent.json', {
  name: 'Remonter le cours du temps récent',
  school: 'transmutation',
  casting_time: { value: 1, unit: 'action' },
  range: { type: 'normal', distance_m: 1.5, area: null },
  duration: { type: 'instantane', value: null, unit: null },
  components: { v: true, s: true, m: null },
  description:
    'Option modulaire de réparation (à partir du niveau 5 de lanceur). Variante à portée 1,50 m et temps d’incantation d’1 action. Elle permet de rétablir l’état d’un objet tel qu’il était au round précédent, pourvu que toutes ses composantes soient dans la zone d’effet du sort. Tout ce qui est avalé, incorporé, fusionné, qui a servi à infliger des dégâts, ou est tenu dans les mains est exclu.\n\nAu niveau 11, la portée passe à 3 m et vous pouvez restaurer un objet affecté au cours des deux précédents rounds. Au niveau 17, lancer le sort restaure tous les objets dans le rayon d’action.',
  higher_levels: null,
});

write('level-6/spl-tempete-en-marche.json', {
  name: 'Tempête en marche',
  school: 'transmutation',
  casting_time: { value: 1, unit: 'action' },
  range: { type: 'normal', distance_m: 9, area: null },
  duration: { type: 'concentration', value: 1, unit: 'heure' },
  components: { v: true, s: true, m: null },
  is_concentration: true,
  description:
    'Option modulaire du sort vent divin. Un groupe voyageant sous forme de nuée relativement compacte a l’aspect d’un souffle brumeux et tempétueux.\n\nFatigue — transformées en nuages, les cibles ne fournissent aucun effort pour se déplacer et peuvent voyager sous cette forme sans risque de fatigue.\n\nMutisme — en tant que nuages, les cibles ne peuvent pas communiquer verbalement. Elles peuvent tout au plus donner une forme approximative à leur nuée, de manière à s’exprimer par mime ou par rébus.',
  higher_levels: null,
});

console.log('done');
