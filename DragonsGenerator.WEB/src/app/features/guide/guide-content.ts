import type {
  GuideBlogPost,
  GuideEditorTool,
  GuideFaqItem,
  GuideFlashCard,
  GuideGlossaryItem,
  GuideIndexItem,
  GuideLabeledFlowStep,
  GuideNavItem,
  GuideNavGroup,
  GuideOneshotStep,
  GuideQuickCard,
  GuideRoleFlowStep,
  GuideStep,
} from './guide.types';

export type { GuideBlogPost };

export const GUIDE_TIPS: string[] = [
      'Activez les notifications push avant une session pour les rappels 24 h et 1 h.',
      'Quand un joueur propose un perso, le MJ reçoit une push + une entrée Activité.',
      'Après Accepter / Refuser, le joueur est notifié (push + centre de notifications).',
      'Le MJ peut ouvrir la fiche proposée avant d’accepter un personnage.',
      'Guerrier · 2 armes : choisissez l’alternative ×2 puis deux armes différentes.',
      'Un message « Export incomplet » signifie qu’il reste un choix d’équipement ou de maîtrise.',
      'Les amis déjà dans la campagne n’apparaissent plus dans Inviter un ami.',
      'Import party : les PJ déjà dans le combat sont ignorés ; un bandeau signale les fiches incomplètes.',
      'La table surligne les combattants sans initiative ou sans PV.',
      'Utilisez le bandeau campagne pour saisir votre initiative rapidement.',
      'Publiez un document : les joueurs le voient dans Activité et Documents.',
      'Terminez le combat pour archiver un résumé dans l’historique MJ.',
      'Pendant la table : Générer une carte sans quitter la soirée — elle s’affiche pour tout le monde.',
      'Vous pouvez aussi préparer les donjons plus tôt dans Préparation → Donjons.',
      'document brouillon carte : image PNG + légende — les joueurs ne voient qu’après publication.',
      'Paramètres → onglet Notifications : filtrez amis, campagnes et push par type.',
];

export const GUIDE_UPDATED_AT = '17 novembre 2026';

export const GUIDE_VERSION = '1.6';

export const GUIDE_NAV_GROUPS: GuideNavGroup[] = [
  {
    id: 'discover',
    label: 'Aide du site',
    sectionIds: ['parcours', 'oneshot-parcours', 'actions', 'journal', 'demarrage'],
  },
  {
    id: 'tools',
    label: 'Outils',
    sectionIds: ['schemas'],
  },
  {
    id: 'table',
    label: 'Fonctions',
    sectionIds: ['compte', 'personnage', 'scenario', 'table', 'donjons', 'initiative', 'documents'],
  },
  {
    id: 'reference',
    label: 'Référence',
    sectionIds: ['social', 'notifications', 'codex', 'pdf', 'faq', 'glossaire', 'index', 'support'],
  },
];

export const GUIDE_ALL_NAV: GuideNavItem[] = [
    { id: 'parcours', label: 'Parcours', icon: 'fluent-emoji:compass', accent: 'text-amber-400', audience: 'all' },
    { id: 'oneshot-parcours', label: 'One-shot', icon: 'fluent-emoji:film-frames', accent: 'text-pink-400', audience: 'all' },
    { id: 'actions', label: '30 secondes', icon: 'fluent-emoji:high-voltage', accent: 'text-amber-400', audience: 'all' },
    { id: 'journal', label: 'Journal', icon: 'fluent-emoji:newspaper', accent: 'text-violet-400', audience: 'all' },
    { id: 'demarrage', label: 'Premiers pas', icon: 'fluent-emoji:rocket', accent: 'text-amber-400', audience: 'all' },
    { id: 'schemas', label: 'Schémas', icon: 'fluent-emoji:world-map', accent: 'text-sky-400', audience: 'all' },
    { id: 'compte', label: 'Compte', icon: 'fluent-emoji:bust-in-silhouette', accent: 'text-sky-400', audience: 'all' },
    { id: 'personnage', label: 'Personnage', icon: 'fluent-emoji:shield', accent: 'text-emerald-400', audience: 'all' },
    { id: 'scenario', label: 'Campagnes', icon: 'fluent-emoji:globe-showing-europe-africa', accent: 'text-violet-400', audience: 'all' },
    { id: 'table', label: 'La table', icon: 'fluent-emoji:performing-arts', accent: 'text-amber-400', audience: 'all' },
    { id: 'donjons', label: 'Donjons & cartes', icon: 'fluent-emoji:castle', accent: 'text-violet-400', audience: 'dm' },
    { id: 'initiative', label: 'Combat', icon: 'fluent-emoji:crossed-swords', accent: 'text-red-400', audience: 'all' },
    { id: 'documents', label: 'Documents', icon: 'fluent-emoji:scroll', accent: 'text-sky-400', audience: 'all' },
    { id: 'social', label: 'Social', icon: 'fluent-emoji:speech-balloon', accent: 'text-pink-400', audience: 'all' },
    { id: 'notifications', label: 'Notifications', icon: 'fluent-emoji:bell', accent: 'text-amber-400', audience: 'all' },
    { id: 'codex', label: 'Codex', icon: 'fluent-emoji:books', accent: 'text-emerald-400', audience: 'all' },
    { id: 'pdf', label: 'PDF', icon: 'fluent-emoji:printer', accent: 'text-slate-300', audience: 'all' },
    { id: 'faq', label: 'FAQ', icon: 'fluent-emoji:red-question-mark', accent: 'text-amber-400', audience: 'all' },
    { id: 'glossaire', label: 'Glossaire', icon: 'fluent-emoji:label', accent: 'text-violet-400', audience: 'all' },
    { id: 'index', label: 'Index', icon: 'fluent-emoji:input-latin-letters', accent: 'text-slate-300', audience: 'all' },
    { id: 'support', label: 'Support', icon: 'fluent-emoji:raising-hands', accent: 'text-violet-400', audience: 'all' },
  ];

export const GUIDE_QUICK_CARDS: GuideQuickCard[] = [
    {
      title: 'Forger un héros',
      description: 'Assistant pas-à-pas · niveaux 1–20',
      icon: 'fluent-emoji:sparkles',
      link: '/create',
      accent: 'border-amber-500/40 hover:border-amber-400 bg-amber-950/20',
      prefetch: 'create',
    },
    {
      title: 'Mes campagnes',
      description: 'MJ ou joueur · sessions & combats',
      icon: 'fluent-emoji:world-map',
      link: '/campaigns',
      accent: 'border-violet-500/40 hover:border-violet-400 bg-violet-950/20',
      prefetch: 'campaigns',
    },
    {
      title: 'Codex',
      description: 'Règles, classes, bestiaire…',
      icon: 'fluent-emoji:books',
      link: '/codex',
      accent: 'border-emerald-500/40 hover:border-emerald-400 bg-emerald-950/20',
      prefetch: 'species',
    },
    {
      title: 'Support',
      description: 'Bug, question, suggestion',
      icon: 'fluent-emoji:raising-hands',
      link: '/support',
      accent: 'border-sky-500/40 hover:border-sky-400 bg-sky-950/20',
      prefetch: 'support',
    },
  ];

/** Durée d’affichage « Nouveau » pour les posts journal (ms). */
export const GUIDE_NEWS_TTL_MS = 14 * 86_400_000;

const GUIDE_FR_MONTHS: Record<string, number> = {
  janvier: 0,
  février: 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  août: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  décembre: 11,
};

/** Parse « 31 août 2026 » → epoch UTC (minuit). */
export function parseGuideBlogDate(date: string): number | null {
  const m = /^(\d{1,2})\s+([a-zéûô]+)\s+(\d{4})$/i.exec(date.trim());
  if (!m) return null;
  const month = GUIDE_FR_MONTHS[m[2].toLowerCase()];
  if (month == null) return null;
  return Date.UTC(+m[3], month, +m[1]);
}

/**
 * « Nouveau » si le post est marqué isNew et daté depuis moins de 14 j.
 * La lecture (prefs) retire le badge navbar séparément.
 */
export function isGuideBlogPostNew(post: GuideBlogPost, now = Date.now()): boolean {
  if (!post.isNew) return false;
  const t = parseGuideBlogDate(post.date);
  if (t == null) return true;
  return now - t <= GUIDE_NEWS_TTL_MS;
}

export const GUIDE_BLOG_POSTS: GuideBlogPost[] = [
    {
      id: 'news-carte-soiree',
      date: '17 novembre 2026',
      tag: 'Table',
      title: 'La carte de la soirée, sur la table',
      summary:
        'Pendant la session, le donjon s’affiche pour tout le monde. Le MJ le génère ou l’importe sans quitter la table, pose les héros et les déplace. Les joueurs voient qui est vraiment à la table.',
      icon: 'fluent-emoji:world-map',
      border: 'border-sky-500/30',
      tagColor: 'text-sky-400 bg-sky-950/40',
      isNew: true,
    },
    {
      id: 'news-campagne-vide-handout',
      date: '31 août 2026',
      tag: 'Campagnes',
      title: 'Campagne vide, document carte & résumé joueur',
      summary:
        'Créez une campagne sans wizard scénario. Les documents carte embarquent l’image PNG. Les joueurs voient leur XP et les sessions passées dans le Résumé.',
      icon: 'fluent-emoji:world-map',
      border: 'border-violet-500/30',
      tagColor: 'text-violet-400 bg-violet-950/40',
      isNew: true,
    },
    {
      id: 'news-donjon-v1',
      date: '31 août 2026',
      tag: 'Cartes MJ',
      title: 'Générateur de donjons v1',
      summary:
        'Onglet Préparation → Donjons : génération procédurale, édition grille, rencontres par salle, export PNG/PDF/JSON et document brouillon.',
      icon: 'fluent-emoji:castle',
      border: 'border-violet-500/30',
      tagColor: 'text-violet-400 bg-violet-950/40',
      isNew: true,
    },
    {
      id: 'news-parametres-profil',
      date: '31 août 2026',
      tag: 'Compte',
      title: 'Paramètres, profil & notifications',
      summary:
        'Paramètres par onglets, profil avec stats, centre de notifications filtrable et préférences par type (localStorage).',
      icon: 'fluent-emoji:bust-in-silhouette',
      border: 'border-sky-500/30',
      tagColor: 'text-sky-400 bg-sky-950/40',
      isNew: true,
    },
    {
      id: 'news-proposition-validation',
      date: '30 août 2026',
      tag: 'Campagnes',
      title: 'Boucle proposition → validation',
      summary:
        'Proposer, accepter ou refuser : push + activité pour MJ et joueurs. Notif « Personnage approuvé » côté joueur. Liens directs vers l’onglet Joueurs.',
      icon: 'fluent-emoji:bell',
      border: 'border-amber-500/30',
      tagColor: 'text-amber-400 bg-amber-950/40',
      isNew: true,
    },
    {
      id: 'news-table-stabilisee',
      date: '30 août 2026',
      tag: 'Table MJ',
      title: 'Table de jeu stabilisée',
      summary:
        'Bannière de feedback (import party, sauvegarde, XP, lien init). Cases sans init/PV surlignées. Confirmation avant retrait. Cibles tactiles plus grandes.',
      icon: 'fluent-emoji:performing-arts',
      border: 'border-emerald-500/30',
      tagColor: 'text-emerald-400 bg-emerald-950/40',
      isNew: true,
    },
    {
      id: 'news-guide-v12',
      date: '30 août 2026',
      tag: 'Wiki',
      title: 'Guide forgeron v1.2',
      summary:
        'Recherche, parcours one-shot, fiches 30 s, aperçus UI annotés, feedback sections et mémorisation du rôle.',
      icon: 'fluent-emoji:books',
      border: 'border-violet-500/30',
      tagColor: 'text-violet-400 bg-violet-950/40',
    },
    {
      id: 'news-fiches-joueurs',
      date: '30 août 2026',
      tag: 'Campagnes MJ',
      title: 'Fiches joueurs + retrait de membres',
      summary:
        'Voir la fiche proposée/approuvée. Invitations filtrées. Bouton Retirer. Synthèse MJ et import combat corrigés.',
      icon: 'fluent-emoji:identification-card',
      border: 'border-violet-500/30',
      tagColor: 'text-violet-400 bg-violet-950/40',
    },
    {
      id: 'news-double-arme-guerrier',
      date: '30 août 2026',
      tag: 'Équipement',
      title: 'Double arme de guerre (Guerrier)',
      summary:
        'Alternative ×2 à l’Arsenal : deux armes différentes. Compteur 1/2. Export PDF OK pour les maîtrises de catégorie.',
      icon: 'fluent-emoji:crossed-swords',
      border: 'border-emerald-500/30',
      tagColor: 'text-emerald-400 bg-emerald-950/40',
    },
    {
      id: 'news-rappels-combats',
      date: '30 août 2026',
      tag: 'Sessions',
      title: 'Rappels & historique combats',
      summary: 'Push 24 h et 1 h avant une session. Résumé repliable de chaque combat terminé (MJ).',
      icon: 'fluent-emoji:calendar',
      border: 'border-amber-500/30',
      tagColor: 'text-amber-400 bg-amber-950/40',
    },
    {
      id: 'news-collecte-initiative',
      date: '30 août 2026',
      tag: 'Initiative',
      title: 'Collecte côté joueurs',
      summary:
        'Bandeau + notification quand le MJ ouvre la collecte. Les joueurs saisissent leur jet depuis le lien fourni.',
      icon: 'fluent-emoji:game-die',
      border: 'border-sky-500/30',
      tagColor: 'text-sky-400 bg-sky-950/40',
    },
    {
      id: 'news-handouts-markdown',
      date: '29 août 2026',
      tag: 'Documents',
      title: 'Documents markdown & activité',
      summary: 'Publication joueurs, aperçu depuis l’activité, markdown léger (gras, titres, listes).',
      icon: 'fluent-emoji:scroll',
      border: 'border-sky-500/30',
      tagColor: 'text-sky-400 bg-sky-950/40',
    },
  ];

export const GUIDE_ONESHOT_STEPS: GuideOneshotStep[] = [
    { role: 'Tous', title: 'Comptes prêts', detail: 'MJ et joueurs inscrits, amis entre eux · push activées.' },
    { role: 'MJ', title: 'Créer la campagne', detail: 'Titre, synopsis, niveau conseillé.' },
    { role: 'MJ', title: 'Inviter la table', detail: 'Onglet Joueurs → inviter chaque ami.' },
    { role: 'Joueur', title: 'Accepter & proposer', detail: 'Invitation → proposer un héros · le MJ est notifié.' },
    { role: 'MJ', title: 'Valider les fiches', detail: 'Notif / Activité → Voir la fiche → Accepter (ou Refuser).' },
    { role: 'Joueur', title: 'Confirmation', detail: 'Push « approuvé » ou « refusé » → re-proposer si besoin.' },
    { role: 'MJ', title: 'Préparer & planifier', detail: 'Rencontre + session + push activés. Une carte n’est pas obligatoire à l’avance.' },
    { role: 'MJ', title: 'Entrer en session', detail: 'Générer ou choisir la carte de soirée · notes · combat.' },
    { role: 'Joueur', title: 'Rejoindre la table', detail: 'Depuis l’accueil ou « Ce soir » · vous voyez la carte et qui est là.' },
    { role: 'Joueur', title: 'Saisir l’initiative', detail: 'Bandeau / notification → jet d20.' },
    { role: 'MJ', title: 'Fin de session', detail: 'Terminer combat → historique · Terminer session.' },
  ];

export const GUIDE_FLASH_CARDS: GuideFlashCard[] = [
    {
      title: 'Campagne vide',
      bullets: ['Mes campagnes → Campagne vide', 'Inviter amis · ajouter contenu à la main', 'Sans assistant scénario'],
      audience: 'dm',
      icon: 'fluent-emoji:memo',
      sectionId: 'scenario',
    },
    {
      title: 'Mon résumé joueur',
      bullets: ['Campagne → Résumé', 'Mon XP et mon personnage', 'Sessions à venir et passées'],
      audience: 'player',
      icon: 'fluent-emoji:bar-chart',
      sectionId: 'scenario',
    },
    {
      title: 'Publier un document',
      bullets: ['Documents → Créer', 'Rédiger (markdown léger)', 'Publier → push joueurs'],
      audience: 'dm',
      icon: 'fluent-emoji:scroll',
      sectionId: 'documents',
    },
    {
      title: 'Valider un perso',
      bullets: ['Notif ou Activité', 'Voir la fiche proposée', 'Accepter / Refuser → joueur notifié'],
      audience: 'dm',
      icon: 'fluent-emoji:identification-card',
      sectionId: 'scenario',
    },
    {
      title: 'Importer la party',
      bullets: ['Table → + Toute la party', 'Lire le bandeau de feedback', 'Compléter init / PV manquants'],
      audience: 'dm',
      icon: 'fluent-emoji:busts-in-silhouette',
      sectionId: 'table',
    },
    {
      title: 'Générer un donjon',
      bullets: [
        'Pendant la table : Générer (sans quitter)',
        'Ou Préparation → Donjons plus tôt',
        'La première carte devient celle de la soirée',
      ],
      audience: 'dm',
      icon: 'fluent-emoji:castle',
      sectionId: 'donjons',
    },
    {
      title: 'Carte de la soirée',
      bullets: ['MJ : Entrer en session → Générer ou choisir', 'Les héros apparaissent sur la carte', 'Glissez un pion (MJ)'],
      audience: 'dm',
      icon: 'fluent-emoji:world-map',
      sectionId: 'table',
    },
    {
      title: 'Rejoindre la soirée',
      bullets: ['Campagne → Ce soir, ou Rejoindre la table', 'Vous voyez qui est à la table', 'La carte s’affiche quand le MJ l’a choisie'],
      audience: 'player',
      icon: 'fluent-emoji:fire',
      sectionId: 'table',
    },
    {
      title: 'Collecter l’init',
      bullets: ['Tracker → Collecter', 'Joueurs reçoivent bandeau', 'Importer les jets'],
      audience: 'dm',
      icon: 'fluent-emoji:game-die',
      sectionId: 'initiative',
    },
    {
      title: 'Proposer mon héros',
      bullets: ['Accepter l’invitation', 'Onglet Joueurs → choisir perso', 'Attendre push MJ'],
      audience: 'player',
      icon: 'fluent-emoji:shield',
      sectionId: 'scenario',
    },
    {
      title: 'Saisir mon initiative',
      bullets: ['Attendre la collecte MJ', 'Clic bandeau / notif', 'Envoyer le jet d20'],
      audience: 'player',
      icon: 'fluent-emoji:game-die',
      sectionId: 'initiative',
    },
    {
      title: 'Exporter mon PDF',
      bullets: ['Finir toutes les étapes', 'Vérifier l’aperçu', 'Sauvegarder puis télécharger'],
      audience: 'all',
      icon: 'fluent-emoji:printer',
      sectionId: 'pdf',
    },
  ];

export const GUIDE_START_STEPS: GuideStep[] = [
    {
      title: 'Créer un compte',
      body: 'Inscription + confirmation e-mail. Vos personnages sont synchronisés dans le cloud.',
      link: '/register',
      linkLabel: 'S’inscrire',
    },
    {
      title: 'Forger un héros',
      body: 'Parcourez le wizard jusqu’au récap et téléchargez votre fiche PDF.',
      link: '/create',
      linkLabel: 'Créer',
    },
    {
      title: 'Lancer une campagne',
      body: 'MJ : assistant scénario (synopsis IA) ou bouton Campagne vide depuis Mes campagnes — puis invitez vos amis.',
      badge: 'MJ',
      link: '/campaigns',
      linkLabel: 'Campagnes',
    },
    {
      title: 'Rejoindre la table',
      body: 'Joueur : acceptez l’invitation, proposez un héros, puis Rejoindre la table. L’onglet Ce soir résume la soirée.',
      badge: 'Joueur',
      link: '/campaigns',
      linkLabel: 'Mes campagnes',
    },
    {
      title: 'Activer les notifications',
      body: 'Push PWA pour sessions, documents, initiative, propositions de perso et messages.',
      link: '/settings',
      linkLabel: 'Paramètres',
    },
  ];

export const GUIDE_CHARACTER_STEPS: GuideStep[] = [
    { title: 'Espèce', body: 'Traits raciaux, sous-espèce, bonus de taille ou vitesse.' },
    { title: 'Civilisation', body: 'Carte d’Eana — langues et compétences bonus.' },
    { title: 'Historique', body: 'Prédéfini ou custom ; équipement automatique inclus.' },
    { title: 'Classe', body: 'Sous-classe, styles, ASI et invocations aux niveaux clés.' },
    { title: 'Caractéristiques', body: 'Point-buy — validez le total avant de continuer.' },
    { title: 'Compétences', body: 'Maîtrises + choix « au choix » (Lettré : arme ou outil).' },
    {
      title: 'Équipement',
      body: 'Alternatives par slot, grilles d’armes. Guerrier ×2 : deux armes différentes.',
    },
    { title: 'Langues', body: 'Bonus espèce, civilisation et historique.' },
    { title: 'Magie', body: 'Sorts, grimoire, domaines (lanceurs uniquement).' },
    { title: 'Identité', body: 'Nom, alignement, backstory IA optionnelle.' },
    { title: 'Récap & PDF', body: 'Sauvegarde cloud + téléchargement fiche et grimoire.' },
  ];

export const GUIDE_CAMPAIGN_MJ_FLOW = [
    'Scénario ou campagne vide',
    'Inviter amis',
    'Valider persos',
    'Préparer docs (optionnel : donjon)',
    'Planifier session',
    'Entrer en session · carte de soirée',
  ];

export const GUIDE_CAMPAIGN_PLAYER_FLOW = [
    'Accepter invite',
    'Proposer perso',
    'Notif MJ → validation',
    'Ce soir (table, récit, docs)',
    'Rejoindre la table',
    'Saisir initiative',
  ];

export const GUIDE_PROPOSAL_FLOW: GuideRoleFlowStep[] = [
    { role: 'Joueur', label: 'Propose un perso' },
    { role: 'Système', label: 'Push + Activité MJ' },
    { role: 'MJ', label: 'Voir la fiche' },
    { role: 'MJ', label: 'Accepter / Refuser' },
    { role: 'Joueur', label: 'Notifié du résultat' },
  ];

export const GUIDE_ARSENAL_FLOW: GuideLabeledFlowStep[] = [
    { label: 'Choisir l’alternative ×2', detail: '2 armes de guerre' },
    { label: 'Sélectionner arme 1', detail: 'Compteur 1/2' },
    { label: 'Sélectionner arme 2', detail: 'Arme différente' },
    { label: 'Slot validé', detail: 'Inventaire à jour' },
  ];

export const GUIDE_COMBAT_FLOW = [
    { role: 'MJ', label: 'Import party' },
    { role: 'MJ', label: 'Collecter l’init' },
    { role: 'Joueurs', label: 'Saisir le jet' },
    { role: 'MJ', label: 'Compléter PV · jouer' },
  ];

export const GUIDE_NOTIFICATION_EVENTS = [
    'Sessions (24 h / 1 h)',
    'Documents publiés',
    'Collecte initiative',
    'Perso proposé (MJ)',
    'Perso accepté / refusé',
    'Messages & invites',
  ];

export const GUIDE_TABLE_PLAY_STEPS: GuideLabeledFlowStep[] = [
    { label: 'Ouvrir', detail: 'MJ : Entrer en session. Joueurs : Rejoindre la table ou Ce soir.' },
    { label: 'Carte', detail: 'MJ : Générer ou choisir un donjon sans quitter. Les héros se posent dessus.' },
    { label: 'Présence', detail: 'On voit qui est connecté et qui est vraiment à la table.' },
    { label: 'Combat', detail: 'Import party, initiative, tours — la carte reste visible.' },
    { label: 'Terminer', detail: 'Fin de combat puis Terminer la session.' },
  ];

export const GUIDE_DUNGEON_GEN_STEPS: GuideStep[] = [
    {
      title: 'Pendant la soirée',
      body: 'À la table : Générer ou Importer — vous ne quittez pas la session. La première carte créée devient celle de tout le monde.',
      badge: 'MJ',
      link: '/campaigns',
      linkLabel: 'Mes campagnes',
    },
    {
      title: 'Ou plus tôt',
      body: 'Campagne → Préparation → Donjons. Plusieurs cartes possibles. Bouton Nouveau donjon : nom, thème, taille.',
      badge: 'MJ',
    },
    {
      title: 'Gravure',
      body: 'Choisissez un thème et une taille, puis Gravure. Salles, couloirs et portes se dessinent tout seuls.',
      badge: 'MJ',
    },
    {
      title: 'Éditer la grille',
      body: 'Outils : sol, mur, porte, piège, coffre, escalier. Zoom +/-. Panneau latéral : salles numérotées.',
      badge: 'MJ',
    },
    {
      title: 'Assigner les rencontres',
      body: 'Par salle : choisir une rencontre campagne (boss fixe) ou garder le tirage aléatoire · Relancer si besoin.',
      badge: 'MJ',
    },
    {
      title: 'Exporter & partager',
      body: 'PNG, PDF (carte + légende), JSON (réouvrir plus tard). document brouillon → image PNG + légende dans Documents.',
      badge: 'MJ',
    },
    {
      title: 'Publier aux joueurs',
      body: 'Documents → ouvrir le document carte → Publier. Les joueurs voient la carte en image et la légende des salles révélées (fog of war activable dans l’éditeur de donjon).',
      badge: 'MJ',
    },
  ];

export const GUIDE_DUNGEON_EDITOR_TOOLS: GuideEditorTool[] = [
    { tool: 'Sélection', detail: 'Cliquer une salle pour la surligner et éditer ses notes / rencontre' },
    { tool: 'Sol / Mur / Porte', detail: 'Peindre au clic ou en glissant sur le canvas' },
    { tool: 'Piège / Coffre / Escalier', detail: 'Marqueurs ronds (! $ S) — re-clic pour retirer ou changer' },
    { tool: 'Navigation', detail: 'Molette = zoom · Espace + glisser = déplacer · Ctrl+Z = annuler' },
    { tool: 'Numéros de salle', detail: 'Affichés au centre de chaque pièce sur la carte' },
  ];

export const GUIDE_DUNGEON_THEMES = [
    'Crypte',
    'Caverne',
    'Ruines',
    'Temple',
    'Égouts',
    'Forêt souterraine',
    'Générique',
  ];

export const GUIDE_FAQ_ITEMS: GuideFaqItem[] = [
    {
      id: 'faq-donjon',
      question: 'Où générer un donjon pour ma campagne ?',
      answer:
        'Le plus simple : ouvrez la table (Entrer en session) → Générer. Vous restez avec vos joueurs. Vous pouvez aussi préparer plus tôt : campagne → Préparation → Donjons → Nouveau donjon. Thème, taille, puis Gravure. La première carte créée pendant la table devient celle de la soirée.',
      audience: 'dm',
    },
    {
      id: 'faq-carte-soiree',
      question: 'Où est la carte pendant la session ?',
      answer:
        'Sur la table, pour tout le monde, pas seulement pendant un combat. Le MJ choisit ou génère un donjon ; les héros approuvés apparaissent dessus. Le MJ déplace les pions. Les joueurs voient la carte et qui est à la table. Un document « Carte » publié, c’est autre chose : une image à lire dans Documents, même hors session.',
      audience: 'all',
    },
    {
      id: 'faq-handout-carte',
      question: 'Les joueurs voient-ils tout de suite un document carte ?',
      answer:
        'Un document « Carte » (image dans Documents) reste invisible tant qu’il n’est pas publié. Ce n’est pas la carte de soirée de la table. Pour le brouillard d’un document : activez-le dans l’éditeur, révélez les salles, puis publiez.',
      audience: 'dm',
    },
    {
      id: 'faq-google-mdp',
      question: 'Je me connecte avec Google : comment changer de mot de passe ou supprimer le compte ?',
      answer:
        'Paramètres → Sécurité : vous pouvez choisir un mot de passe sans en connaître un actuel. Pour supprimer le compte : Paramètres → Données, tapez votre e-mail. Un compte e-mail et un compte Google avec la même adresse, c’est le même compte. Deux adresses différentes, ce sont deux comptes.',
      audience: 'all',
    },
    {
      id: 'faq-campagne-vide',
      question: 'Puis-je créer une campagne sans passer par l’assistant scénario ?',
      answer:
        'Oui. Mes campagnes → Campagne vide : choisissez un titre, une table vierge est créée. Invitez vos amis, ajoutez créatures, donjons et sessions à la main — idéal pour une campagne longue ou une table déjà préparée ailleurs.',
      audience: 'dm',
    },
    {
      id: 'faq-resume-joueur',
      question: 'Où voir mon XP et l’historique des sessions ?',
      answer:
        'Joueur : ouvrez la campagne → onglet Résumé. Vous y voyez votre XP gagné, votre personnage approuvé, les sessions à venir et les sessions déjà jouées. Le total XP du groupe reste réservé au MJ.',
      audience: 'player',
    },
    {
      id: 'faq-pdf',
      question: 'Mon PDF affiche « Export incomplet »',
      answer:
        'Il reste des choix non résolus (arme ou outil « au choix », catégorie d’équipement). Revenez aux étapes Compétences ou Équipement, terminez chaque sélection, puis régénérez le PDF au récap.',
      audience: 'all',
    },
    {
      id: 'faq-fiche',
      question: 'Le MJ ne voit pas ma fiche / les PDF joueurs sont vides',
      answer:
        'Le personnage doit d’abord être proposé puis approuvé. Le MJ utilise « Voir la fiche » depuis le Résumé ou l’onglet Joueurs — pas besoin de posséder le personnage. Les amis déjà dans la campagne n’apparaissent plus dans les invitations.',
      audience: 'all',
    },
    {
      id: 'faq-propos',
      question: 'J’ai proposé mon perso — le MJ n’est pas prévenu ?',
      answer:
        'Le MJ reçoit une notification push « Personnage à valider », une entrée dans le centre de notifications, et une ligne dans l’onglet Activité. Vérifiez que le MJ a activé Push PWA. Vous pouvez aussi lui signaler manuellement ; le bouton reste dans Groupe / Joueurs.',
      audience: 'all',
    },
    {
      id: 'faq-refuse',
      question: 'Mon personnage a été refusé — que faire ?',
      answer:
        'Vous recevez une push et une notif « Personnage refusé ». Corrigez ou choisissez un autre héros, puis proposez à nouveau depuis l’onglet Joueurs. Le statut redevient « en attente » pour le MJ.',
      audience: 'player',
    },
    {
      id: 'faq-armes',
      question: 'Le Guerrier dit « 2 armes de guerre » mais je n’en choisis qu’une',
      answer:
        'Choisissez l’alternative avec quantité ×2, puis cliquez deux armes différentes dans la grille. Un compteur « 1/2 choisi(s) » confirme la progression avant de passer au slot suivant.',
      audience: 'all',
    },
    {
      id: 'faq-retirer',
      question: 'Comment retirer un joueur de la campagne ?',
      answer:
        'MJ : onglet Joueurs (ou bloc Groupe) → Retirer → confirmer. Le joueur quitte la table ; vous pourrez le réinviter plus tard. Les pré-tirés qui lui étaient assignés sont libérés.',
      audience: 'dm',
    },
    {
      id: 'faq-party',
      question: 'L’import party ne fait rien / affiche un message d’erreur',
      answer:
        'Il faut au moins un personnage approuvé. Si tous les PJ sont déjà dans le combat, un bandeau l’indique. Si des fiches sont incomplètes (PV manquants), le bandeau demande de vérifier init/PV — les cases concernées sont surlignées.',
      audience: 'dm',
    },
    {
      id: 'faq-push',
      question: 'Les notifications push ne marchent pas',
      answer:
        'Paramètres → activer Push PWA, accepter la permission du navigateur (Chrome / Edge recommandés). Sur mobile, ajoutez le site à l’écran d’accueil. Vérifiez aussi que vous êtes bien connecté.',
      audience: 'all',
    },
    {
      id: 'faq-init',
      question: 'Je ne trouve pas où saisir mon initiative',
      answer:
        'Quand le MJ ouvre la collecte, un bandeau apparaît sur la campagne et une notification est envoyée. Utilisez le bouton du bandeau ou le lien reçu. Le MJ importe ensuite les jets dans le tracker.',
      audience: 'player',
    },
    {
      id: 'faq-invite',
      question: 'Comment inviter quelqu’un qui n’est pas encore ami ?',
      answer:
        'Onglet Joueurs → Copier le lien campagne. Vos invités ouvrent le lien, se connectent, et rejoignent sans amitié préalable. Vous pouvez aussi Inviter un ami (liste Amis) ou régénérer / désactiver le lien.',
      audience: 'dm',
    },
    {
      id: 'faq-pretire',
      question: 'À quoi servent les personnages pré-tirés ?',
      answer:
        'Le MJ peut les préparer avant même que les joueurs aient l’app (Préparation → Pré-tirés). Les joueurs consultent en lecture seule, utilisent à la table, ou en font une copie optionnelle dans Mes héros.',
      audience: 'all',
    },
    {
      id: 'faq-archive-delete',
      question: 'Archiver, historique, fermer, supprimer ou quitter — quelle différence ?',
      answer:
        'Archiver masque la campagne de vos Actives sans quitter. Quitter / être retiré vous place en Historique (lecture seule, snapshot). Fermer (MJ, s’il y a eu des joueurs) arrête la table mais conserve l’historique pour tous. Supprimer définitivement n’arrive que si le MJ est seul (aucun joueur n’a jamais rejoint).',
      audience: 'all',
    },
  ];

export const GUIDE_GLOSSARY: GuideGlossaryItem[] = [
    { term: 'Table', definition: 'Espace de jeu en direct : carte de soirée, présence, notes, combat. MJ et joueurs y sont ensemble.' },
    {
      term: 'Carte de la soirée',
      definition:
        'Le donjon affiché pendant la session, pour tout le monde. Le MJ le génère ou le choisit à la table, et déplace les héros.',
    },
    { term: 'Pré-tiré', definition: 'Personnage préparé par le MJ pour l’aventure ; consultation / usage table sans appropriation obligatoire.' },
    {
      term: 'Archive (campagne)',
      definition:
        'Masque une campagne de votre liste Actives sans quitter : toujours dans Archives, URL inchangée.',
    },
    {
      term: 'Historique (campagne)',
      definition:
        'Campagne quittée, dont vous avez été retiré, ou fermée par le MJ — consultation lecture seule (snapshot figé).',
    },
    { term: 'Lien d’invitation', definition: 'URL /join/… que le MJ partage pour faire rejoindre une campagne sans être ami.' },
    { term: 'Document', definition: 'Fiche publiée aux joueurs (lettre, carte, résumé…) en markdown léger ; les cartes embarquent une image PNG.' },
    {
      term: 'Donjon',
      definition:
        'Carte de salles et couloirs. On la génère à la table ou dans Préparation → Donjons. Export image / PDF possible.',
    },
    {
      term: 'Collecte d’initiative',
      definition: 'Le MJ ouvre une saisie ; chaque joueur envoie son jet avant le combat.',
    },
    {
      term: 'Synthèse MJ',
      definition: 'PDF compact des joueurs approuvés (CA, PV, init, attaques) pour la table.',
    },
    {
      term: 'Proposition',
      definition:
        'Un joueur soumet un personnage ; le MJ est notifié (push + activité), consulte la fiche, puis accepte ou refuse — le joueur est notifié du résultat.',
    },
    {
      term: 'Import party',
      definition:
        'Sur la table, ajoute les personnages approuvés au tracker. Ignore les doublons et signale les fiches sans PV.',
    },
    { term: 'Activité', definition: 'Journal de campagne : invites, propositions, documents, sessions…' },
    { term: 'Codex', definition: 'Référence de règles du site : espèces, classes, sorts, bestiaire…' },
    { term: 'PWA', definition: 'Application installable + notifications push hors navigateur classique.' },
  ];

export const GUIDE_FEATURE_INDEX: GuideIndexItem[] = [
    { label: 'Amis & chat', description: 'Demandes, messages, invitations', sectionId: 'social', audience: 'all', href: '/friends' },
    { label: 'Arsenal de départ', description: 'Équipement et choix d’armes', sectionId: 'personnage', audience: 'all', href: '/equipments' },
    { label: 'Bestiaire / créatures', description: 'Préparation MJ et PDF', sectionId: 'scenario', audience: 'dm', href: '/creatures' },
    { label: 'Campagnes', description: 'Création, joueurs, sessions', sectionId: 'scenario', audience: 'all', href: '/campaigns' },
    { label: 'Préparation → Donjons', description: 'Préparer une carte avant la soirée', sectionId: 'donjons', audience: 'dm', href: '/campaigns' },
    { label: 'Carte de la soirée', description: 'Donjon visible à toute la table', sectionId: 'table', audience: 'all', href: '/campaigns' },
    { label: 'Collecte d’initiative', description: 'Jets joueurs synchronisés', sectionId: 'initiative', audience: 'all', href: '/combat-actions' },
    { label: 'Documents', description: 'Publication markdown', sectionId: 'documents', audience: 'all', href: '/campaigns' },
    { label: 'Fiche personnage PDF', description: 'Export & sauvegarde', sectionId: 'pdf', audience: 'all', href: '/characters' },
    { label: 'Historique des combats', description: 'Résumé après combat', sectionId: 'initiative', audience: 'dm', href: '/campaigns' },
    { label: 'Import party', description: 'PJ approuvés dans le tracker', sectionId: 'table', audience: 'dm', href: '/campaigns' },
    { label: 'Notifications push', description: 'Sessions, init, propositions, messages', sectionId: 'notifications', audience: 'all', href: '/settings?tab=notifications' },
    { label: 'One-shot type', description: 'Scénario de session complète', sectionId: 'oneshot-parcours', audience: 'all', href: '/guide/oneshot' },
    { label: 'Pré-tirés', description: 'Héros assignables', sectionId: 'scenario', audience: 'all', href: '/campaigns' },
    { label: 'Proposition de personnage', description: 'Propose → push → valider', sectionId: 'scenario', audience: 'all', href: '/campaigns' },
    { label: 'Table de jeu', description: 'Session live, carte, présence, combat', sectionId: 'table', audience: 'all', href: '/campaigns' },
    { label: 'Validation de personnage', description: 'Voir fiche → accepter / refuser', sectionId: 'scenario', audience: 'dm', href: '/campaigns' },
    { label: 'Paramètres compte', description: 'Onglets profil, notifs, sécurité, données', sectionId: 'compte', audience: 'all', href: '/settings' },
    { label: 'Centre notifications', description: 'Filtres, masquage, préférences', sectionId: 'notifications', audience: 'all', href: '/notifications' },
    { label: 'Espèces (Codex)', description: 'Peuples d’Eana', sectionId: 'codex', audience: 'all', href: '/species' },
    { label: 'Classes (Codex)', description: 'Classes et sous-classes', sectionId: 'codex', audience: 'all', href: '/classes' },
    { label: 'Sortilèges (Codex)', description: 'Grimoire des sorts', sectionId: 'codex', audience: 'all', href: '/spells' },
  ];
