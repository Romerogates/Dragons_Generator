/**
 * Restore high-traffic incomplete/merged spell JSON from Livre de magie.
 * Usage: node scripts/restore-critical-spells.mjs
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

write('level-3/spl-vol.json', {
  school: 'transmutation',
  casting_time: { value: 1, unit: 'action' },
  range: { type: 'contact', distance_m: null, area: null },
  duration: { type: 'concentration', value: 10, unit: 'minute' },
  components: { v: true, s: true, m: "une plume d'oiseau" },
  is_concentration: true,
  description:
    'Vous touchez une créature consentante. La cible gagne une VD en vol de 18 m pour toute la durée du sort. Quand le sort prend fin, la cible tombe si elle était encore en l’air, à moins qu’elle ne puisse empêcher sa chute.',
  higher_levels:
    'Quand vous jetez ce sort en utilisant un emplacement de sort du 4e niveau ou supérieur, vous pouvez cibler une créature supplémentaire par niveau d’emplacement au-dessus du 3e.',
});

write('level-2/spl-aide.json', {
  school: 'abjuration',
  casting_time: { value: 1, unit: 'action' },
  range: { type: 'normal', distance_m: 9, area: null },
  duration: { type: 'normal', value: 8, unit: 'heure' },
  components: { v: true, s: true, m: 'une minuscule bande de tissu blanc' },
  is_concentration: false,
  description:
    'Votre sort galvanise vos alliés en leur conférant une robustesse et une détermination accrues. Choisissez jusqu’à trois créatures situées à portée. Leurs points de vie maximums et leurs points de vie actuels augmentent de 5 pour toute la durée du sort.',
  higher_levels:
    'Quand vous jetez ce sort en utilisant un emplacement de sort du 3e niveau ou supérieur, les cibles gagnent 5 points de vie supplémentaires par niveau d’emplacement au-dessus du 2e.',
});

write('level-2/spl-arme-spirituelle.json', {
  school: 'evocation',
  casting_time: { value: 1, unit: 'bonus_action' },
  range: { type: 'normal', distance_m: 18, area: null },
  duration: { type: 'normal', value: 1, unit: 'minute' },
  components: { v: true, s: true, m: null },
  is_concentration: false,
  description:
    'Une arme spectrale flottante apparaît à portée et persiste pour toute la durée du sort ou jusqu’à ce que vous relanciez ce sort. Au moment de l’incantation, vous pouvez effectuer une attaque de sort de corps à corps contre une créature située dans un rayon de 1,50 m de l’arme. En cas de réussite, la cible subit des dégâts de force égaux à 1d8 + votre modificateur de caractéristique magique.\n\nAu prix d’une action bonus à votre tour de jeu, vous pouvez déplacer l’arme jusqu’à 6 m et répéter l’attaque contre une créature située dans un rayon de 1,50 m de celle-ci.\n\nL’arme prend la forme de votre choix.',
  higher_levels:
    'Quand vous jetez ce sort en utilisant un emplacement de sort du 3e niveau ou supérieur, les dégâts augmentent de 1d8 tous les deux niveaux d’emplacement au-dessus du 2e.',
});

write('level-4/spl-vision-aveugle.json', {
  description:
    'Vous touchez une créature consentante et lui conférez la faculté de percevoir l’environnement sans recourir à la vue. La cible gagne la vision aveugle sur 18 m pour toute la durée du sort.',
  higher_levels:
    'Quand vous jetez ce sort en utilisant un emplacement de sort du 5e niveau ou supérieur, vous pouvez cibler une créature supplémentaire par niveau d’emplacement au-dessus du 4e.',
});

write('level-6/spl-voie-vegetale.json', {
  range: { type: 'normal', distance_m: 3, area: null },
  duration: { type: 'normal', value: 1, unit: 'round' },
  components: { v: true, s: true, m: null },
  is_concentration: false,
  description:
    'Ce sort crée un lien magique entre une plante inanimée de taille G ou supérieure située à portée et une autre plante, qui peut se trouver à n’importe quelle distance mais obligatoirement sur le même plan d’existence. Vous devez avoir vu ou touché la plante de destination au moins une fois. Pour toute la durée, n’importe quelle créature peut entrer dans la plante ciblée et ressortir par l’autre au prix de 1,50 m de déplacement.',
  higher_levels:
    'Quand vous jetez ce sort en utilisant un emplacement de sort du 7e niveau ou supérieur, vous pouvez augmenter la durée de 1 round par niveau d’emplacement au-dessus du 6e.',
});

write('level-3/spl-esprits-gardiens.json', {
  name: 'Esprits gardiens',
  school: 'invocation',
  casting_time: { value: 1, unit: 'action' },
  range: { type: 'personnelle', distance_m: null, area: null },
  duration: { type: 'concentration', value: 10, unit: 'minute' },
  components: { v: true, s: true, m: 'un symbole sacré' },
  is_concentration: true,
  description:
    'Vous appelez des esprits protecteurs qui volettent à une distance de 4,50 m de vous pour toute la durée du sort. Si vous êtes bon ou neutre, les formes spectrales ont une apparence angélique ou féerique (à votre convenance). Si vous êtes mauvais, ils évoquent des fiélons.\n\nAu moment de l’incantation, vous pouvez désigner autant de créatures que vous voyez que vous le souhaitez et qui ne seront pas affectées. La VD d’une créature affectée est réduite de moitié dans la zone, et quand elle y entre pour la première fois d’un tour de jeu ou y commence son tour de jeu, elle doit effectuer un JS Sagesse et subit 3d8 dégâts radiants (si vous êtes bon ou neutre) ou 3d8 dégâts nécrotiques (si vous êtes mauvais) en cas d’échec, la moitié en cas de réussite.',
  higher_levels:
    'Quand vous jetez ce sort en utilisant un emplacement de sort du 4e niveau ou supérieur, les dégâts augmentent de 1d8 par niveau d’emplacement au-dessus du 3e.',
});

write('level-3/spl-etat-gazeux.json', {
  name: 'État gazeux',
  school: 'transmutation',
  casting_time: { value: 1, unit: 'action' },
  range: { type: 'contact', distance_m: null, area: null },
  duration: { type: 'concentration', value: 1, unit: 'heure' },
  components: { v: true, s: true, m: 'un peu de gaze et une volute de fumée' },
  is_concentration: true,
  description:
    'Vous transformez une créature consentante que vous touchez – ainsi que tout ce qu’elle porte et transporte – en nuage de brume pour toute la durée du sort. Le sort prend fin si la créature tombe à 0 point de vie. Une créature intangible n’est pas affectée.\n\nSous cette forme, la créature a une vitesse de déplacement en vol de 3 m (il s’agit de son seul mode de déplacement). La cible peut entrer dans l’espace d’une autre créature et l’occuper. Elle bénéficie d’une résistance aux dégâts non magiques et d’un avantage aux jets de sauvegarde de Force, de Dextérité et de Constitution. Elle peut se glisser dans un petit trou, une porte entrebâillée ou une simple fissure. En revanche, les liquides constituent des surfaces solides en ce qui la concerne. La cible ne peut pas chuter et reste comme suspendue dans les airs quand elle est étourdie ou neutralisée.\n\nSous forme de brume, la cible ne peut ni parler ni manipuler d’objets. Les objets qu’elle transportait ou tenait ne peuvent pas être lâchés ou utilisés, il est tout bonnement impossible d’interagir avec eux. Enfin, la cible ne peut ni attaquer ni lancer de sorts.',
  higher_levels:
    'Quand vous jetez ce sort en utilisant un emplacement de sort du 4e niveau ou supérieur, vous pouvez cibler une créature supplémentaire par niveau d’emplacement au-dessus du 3e.',
});

write('level-8/spl-esprit-impenetrable.json', {
  components: { v: true, s: true, m: null },
  duration: { type: 'normal', value: 24, unit: 'heure' },
  is_concentration: false,
  description:
    'Tant que le sort persiste, une créature consentante que vous touchez est immunisée contre les dégâts psychiques, ainsi que contre tout effet détectant ses émotions ou lisant ses pensées, les sorts de divination et l’état préjudiciable charmé. Cette abjuration se joue même du sort souhait et des sorts et effets de puissance équivalente utilisés pour affecter l’esprit de la cible ou recueillir des informations la concernant.',
  higher_levels: null,
});

console.log('done');
