/**
 * Restore empty spell JSON from source/Dragons_2_Livre_de_magie.md (cleaned).
 * Usage: node scripts/restore-empty-spells.mjs
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

write('level-2/spl-arme-vengeresse.json', {
  school: 'evocation',
  casting_time: { value: 1, unit: 'bonus_action' },
  range: { type: 'personnelle', distance_m: null, area: null },
  duration: { type: 'concentration', value: 1, unit: 'minute' },
  components: { v: true, s: false, m: null },
  is_concentration: true,
  description:
    'Votre arme de corps à corps exprime l’ire de votre divinité. Chaque fois que vous touchez une cible avec cette arme avant la fin du sort, vous lui infligez des dégâts psychiques supplémentaires égaux à votre modificateur de caractéristique magique. La cible doit également réussir un JS Sagesse sous peine de se retrouver effrayée par vous tant que le sort persiste.\n\nÀ la fin de chacun de ses tours de jeu, la créature peut effectuer un JS Sagesse pour raffermir sa détermination et ne plus être effrayée par vous.',
  higher_levels:
    'Quand vous jetez ce sort en utilisant un emplacement de sort du 4e niveau ou supérieur, les dégâts supplémentaires sont égaux au double de votre modificateur de caractéristique magique.',
});

write('level-2/spl-appel-de-destrier-volant.json', {
  school: 'invocation',
  casting_time: { value: 10, unit: 'minute' },
  range: { type: 'normal', distance_m: 9, area: null },
  duration: { type: 'instantane', value: null, unit: null },
  components: { v: true, s: true, m: null },
  is_concentration: false,
  description:
    'Vous convoquez un esprit qui prend la forme d’un destrier volant particulièrement intelligent, puissant et fidèle, et créez un lien durable avec lui. Le destrier apparaît dans un espace inoccupé situé à portée et prend la forme de votre choix : un griffon, un pégase ou un ange déchu. Il a le profil de la forme choisie, à ces différences près dans le cas d’un griffon : son type habituel est remplacé par fée, sa valeur d’Intelligence passe à 6 et il acquiert la faculté de comprendre une langue de votre choix que vous parlez.\n\nVotre destrier vous sert de monture, y compris au combat, et vous partagez avec lui un lien instinctif qui vous permet de combattre comme si vous ne faisiez qu’un. Tant que vous montez votre destrier, tout sort que vous lancez et qui ne cible que vous peut aussi le cibler.\n\nQuand le destrier tombe à 0 point de vie, il disparaît sans laisser de traces. Vous pouvez aussi le révoquer à tout moment au prix d’une action, il disparaît alors. Dans tous les cas, en relançant ce sort, vous invoquez le même destrier, avec ses points de vie maximums.\n\nTant que votre destrier se situe dans un rayon de 1,5 km de vous, vous pouvez communiquer avec lui par télépathie, et vice versa.\n\nVous ne pouvez avoir qu’un seul destrier lié par ce sort ou par appel de destrier à la fois. Au prix d’une action, vous pouvez le libérer de son lien à tout moment, auquel cas il disparaît.',
  higher_levels: null,
});

write('level-5/spl-appel-de-destrier.json', {
  school: 'invocation',
  casting_time: { value: 10, unit: 'minute' },
  range: { type: 'normal', distance_m: 9, area: null },
  duration: { type: 'instantane', value: null, unit: null },
  components: { v: true, s: true, m: null },
  is_concentration: false,
  description:
    'Vous convoquez un esprit qui prend la forme d’un destrier particulièrement intelligent, puissant et fidèle, et créez un lien durable avec lui. Le destrier apparaît dans un espace inoccupé situé à portée et prend la forme de votre choix : un destrier, un poney, un chameau, un élan ou un molosse (votre meneur peut autoriser d’autres types de monture). Il a le profil de la forme choisie, mais son type habituel est remplacé par céleste, fée ou fiélon (à votre convenance). En outre, si votre destrier a une Intelligence inférieure ou égale à 5, elle passe à 6, et il acquiert la faculté de comprendre une langue de votre choix que vous parlez.\n\nVotre destrier vous sert de monture, y compris au combat, et vous partagez avec lui un lien instinctif qui vous permet de combattre comme si vous ne faisiez qu’un. Tant que vous montez votre destrier, tout sort que vous lancez et qui ne cible que vous peut aussi le cibler.\n\nQuand le destrier tombe à 0 point de vie, il disparaît sans laisser de traces. Vous pouvez aussi le révoquer à tout moment au prix d’une action, il disparaît alors. Dans tous les cas, en relançant ce sort, vous invoquez le même destrier, avec ses points de vie maximums.\n\nTant que votre destrier se situe dans un rayon de 1,5 km de vous, vous pouvez communiquer avec lui par télépathie, et vice versa.\n\nVous ne pouvez avoir qu’un seul destrier lié par ce sort ou par appel de destrier volant à la fois. Au prix d’une action, vous pouvez le libérer de son lien à tout moment, auquel cas il disparaît.',
  higher_levels: null,
});

write('level-6/spl-interdiction.json', {
  school: 'abjuration',
  casting_time: { value: 10, unit: 'minute' },
  range: { type: 'contact', distance_m: null, area: null },
  duration: { type: 'normal', value: 1, unit: 'jour' },
  components: {
    v: true,
    s: true,
    m: 'un peu d’eau bénite, de l’encens rare et de la poudre de rubis d’une valeur minimale de 1 000 po',
  },
  is_ritual: true,
  is_concentration: false,
  description:
    'Vous créez une protection contre les déplacements magiques qui affecte une zone dont la surface au sol peut atteindre 4 000 m² et la hauteur 9 m. Pour toute la durée du sort, aucune créature ne peut se téléporter dans la zone ni même utiliser de portails pour y entrer. Le sort protège la zone contre les déplacements planaires et empêche donc les créatures d’y accéder par le Plan Astral, le Plan Éthéré ou le sort changement de plan.\n\nEn outre, le sort blesse les créatures des types choisis au moment de l’incantation. Choisissez-en au moins un parmi les suivants : célestes, élémentaires, fées, fiélons, morts-vivants ou ravageurs du Chancre. Quand une telle créature entre dans la zone de l’abjuration pour la première fois d’un tour de jeu ou qu’elle y commence son tour, elle subit 5d10 dégâts radiants ou nécrotiques (à votre convenance, au moment de l’incantation).\n\nAu moment de l’incantation, vous pouvez également fixer un mot de passe. Le sort n’inflige aucun dégât à une créature qui le prononce en entrant dans la zone. La zone du sort ne peut pas chevaucher celle d’une autre interdiction. Si vous lancez ce sort tous les jours pendant 30 jours au même endroit, le sort persiste jusqu’à ce qu’il soit dissipé, et les composantes matérielles sont détruites à la dernière incantation.',
  higher_levels: null,
});

write('level-7/spl-inversion-de-la-gravite.json', {
  school: 'transmutation',
  casting_time: { value: 1, unit: 'action' },
  range: { type: 'normal', distance_m: 30, area: null },
  duration: { type: 'concentration', value: 1, unit: 'minute' },
  components: { v: true, s: true, m: 'une magnétite et des copeaux de fer' },
  is_concentration: true,
  description:
    'Ce sort inverse la gravité dans un cylindre de 30 m de haut et de 15 m de rayon centré sur un point situé à portée. Les créatures et objets pris dans la zone qui ne sont pas ancrés ou fixés au sol tombent vers le haut et atteignent le sommet du cylindre au moment de l’incantation du sort. Une créature peut effectuer un JS Dextérité pour s’agripper à un objet fixé qu’elle peut atteindre, et ainsi éviter la chute.\n\nS’il y a un obstacle (le plafond, par exemple), les objets et créatures le percutent comme ils le feraient au cours d’une chute normale. Si un objet ou une créature atteint le sommet de la zone sans rien percuter, il y reste en oscillant légèrement pour toute la durée du sort.\n\nÀ la fin de la durée du sort, les objets et créatures affectés tombent dans l’autre sens.',
  higher_levels: null,
});

write('level-8/spl-bagou.json', {
  school: 'transmutation',
  casting_time: { value: 1, unit: 'action' },
  range: { type: 'personnelle', distance_m: null, area: null },
  duration: { type: 'normal', value: 1, unit: 'heure' },
  components: { v: true, s: false, m: null },
  is_concentration: false,
  description:
    'Tant que le sort persiste, vous pouvez remplacer par un 15 les résultats obtenus sur le dé de vos tests de Charisme. En outre, quoi que vous disiez, toute magie censée révéler si vous dites la vérité indique qu’on peut vous croire sur parole.',
  higher_levels: null,
});

write('level-3/spl-tyrannie.json', {
  school: 'enchantement',
  casting_time: { value: 1, unit: 'action' },
  range: { type: 'personnelle', distance_m: null, area: null },
  duration: { type: 'concentration', value: 10, unit: 'minute' },
  components: { v: true, s: true, m: 'une cravache' },
  is_concentration: true,
  description:
    'Une énergie despotique émane de vous dans un rayon de 6 m. L’aura se déplace avec vous tant que le sort persiste, et vous en restez le centre.\n\nUne fois par round, lors de votre tour, vous pouvez donner un ordre à une créature comprise dans l’aura. Si celle-ci vous comprend, elle peut choisir de vous obéir docilement. Si elle refuse de se soumettre, elle doit réussir un JS Charisme sous peine de subir 5d6 dégâts psychiques, ou la moitié en cas de réussite. Une créature qui ne peut être effrayée est immunisée contre ce sort.\n\nL’ordre doit se limiter à un mot. Si la cible se soumet à votre instruction, elle doit consacrer son tour suivant à s’exécuter (cf. sort injonction). Si, pour une raison ou une autre, elle est incapable d’obéir à votre ordre, elle reste inactive lors de son tour mais ne subit pas de dégâts comme décrit ci-dessus.',
  higher_levels:
    'Quand vous jetez ce sort en utilisant un emplacement de sort du 4e niveau ou supérieur, chaque niveau d’emplacement au-dessus du 3e augmente les dégâts de 1d6 et le rayon d’action de 3 m.',
});

write('level-6/spl-invocation-de-fee-ou-de-ravageur.json', {
  school: 'invocation',
  casting_time: { value: 1, unit: 'minute' },
  range: { type: 'normal', distance_m: 27, area: null },
  duration: { type: 'concentration', value: 1, unit: 'heure' },
  components: { v: true, s: true, m: null },
  is_concentration: true,
  description:
    'Vous invoquez une créature féerique d’un facteur de puissance de 6 ou moins, ou un esprit féerique qui prend la forme d’une bête d’un facteur de puissance de 6 ou moins. La créature apparaît dans un espace inoccupé que vous voyez à portée et disparaît quand elle tombe à 0 point de vie ou quand le sort prend fin.\n\nLa créature féerique invoquée est amicale envers vous et vos compagnons pour toute la durée du sort. Déterminez son initiative ; elle a ses propres tours de jeu. Elle obéit aux ordres verbaux que vous lui donnez (sans que cela ne vous coûte d’action) tant qu’ils n’enfreignent pas son alignement. Si vous ne lui en donnez pas, elle n’entreprend pas d’actions, mais se défend contre les créatures hostiles.\n\nSi votre concentration est interrompue, la créature féerique ne disparaît pas. Vous en perdez le contrôle, elle devient hostile envers vous et vos compagnons, et est susceptible d’attaquer. Vous ne pouvez pas révoquer une créature féerique incontrôlée, qui disparaît 1 heure après que vous l’avez invoquée.\n\nLa variante invocation de ravageur de ce sort invoque un ravageur à la place d’une créature féerique ou d’un esprit féerique.',
  higher_levels:
    'Quand vous jetez ce sort en utilisant un emplacement de sort du 7e niveau ou supérieur, le facteur de puissance augmente de 1 par niveau d’emplacement au-dessus du 6e.',
});

write('level-5/spl-mythes-et-legendes.json', {
  school: 'divination',
  casting_time: { value: 10, unit: 'minute' },
  range: { type: 'personnelle', distance_m: null, area: null },
  duration: { type: 'instantane', value: null, unit: null },
  components: {
    v: true,
    s: true,
    m: 'de l’encens pour une valeur d’au moins 250 po, que le sort détruit, et quatre lamelles d’ivoire d’une valeur minimale de 50 po chacune',
  },
  is_concentration: false,
  description:
    'Nommez ou décrivez une personne, un endroit ou un objet. Le sort vous dévoile les grandes lignes de ce qu’il faut savoir sur la cible citée. Il peut s’agir de récits actuels, d’histoires oubliées ou de connaissances secrètes qui n’ont jamais connu une large diffusion. Si la chose que vous nommez n’est pas d’importance légendaire, vous ne gagnez aucune information. Plus nombreux sont les renseignements dont vous disposez déjà sur la cible, plus ceux que vous glanerez seront précis et détaillés.\n\nLes informations acquises sont exactes, mais peuvent avoir un sens figuré.',
  higher_levels: null,
});

write('level-1/spl-simulacre-de-vie.json', {
  school: 'necromancie',
  casting_time: { value: 1, unit: 'action' },
  range: { type: 'personnelle', distance_m: null, area: null },
  duration: { type: 'normal', value: 1, unit: 'heure' },
  components: { v: true, s: true, m: 'une petite quantité d’alcool ou d’eau-de-vie' },
  is_concentration: false,
  description:
    'Vous vous renforcez au moyen d’un semblant de vie nécromantique, ce qui vous fait gagner 1d4 + 4 points de vie temporaires pour toute la durée du sort.',
  higher_levels:
    'Quand vous jetez ce sort en utilisant un emplacement de sort du 2e niveau ou supérieur, vous gagnez 5 points de vie temporaires supplémentaires par niveau d’emplacement au-dessus du 1er.',
});

write('level-4/spl-soif-de-sang.json', {
  school: 'necromancie',
  casting_time: { value: 1, unit: 'action' },
  range: { type: 'personnelle', distance_m: null, area: null },
  duration: { type: 'normal', value: 10, unit: 'minute' },
  components: { v: true, s: true, m: null },
  is_concentration: false,
  description:
    'Une énergie vampirique émane de vous dans un rayon de 9 m. L’aura se déplace avec vous tant que le sort persiste, et vous en restez le centre. Une fois par round, quand vous voyez une créature de taille P ou supérieure comprise dans la zone subir des dégâts contondants, perforants ou tranchants, vous pouvez récupérer un nombre de points de vie égal à la moitié des dégâts en question. Les créatures dont le type est l’un des suivants ne vous permettent pas d’activer cet effet : créature artificielle, élémentaire, mort-vivant, plante et vase.',
  higher_levels:
    'Quand vous jetez ce sort en utilisant un emplacement de sort du 5e niveau ou supérieur, le rayon d’effet augmente de 3 m par niveau d’emplacement au-dessus du 4e.',
});

console.log('done');
