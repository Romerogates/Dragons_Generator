/**
 * Journal des versions. La plus récente en premier.
 * `version` = `1.{nombre de commits}` affiché dans le pied de page.
 * `player` : langage joueur, aucun terme technique. `tech` : détail pour le support.
 */
export interface PatchNote {
  version: string;
  date: string;
  title: string;
  player: string[];
  tech: string[];
}

export const PATCH_NOTES: readonly PatchNote[] = [
  {
    version: '1.469',
    date: '2026-11-17',
    title: 'La table en ligne devient une scène',
    player: [
      'En session en ligne, un bandeau dit ce qu’il faut faire, avec un sablier quand vous attendez.',
      'Un fil « Ce qui se passe » raconte la scène, les coups et les messages — le MJ peut annoncer un événement.',
      'Petits bonhommes pixel sur la table (pack Kenney, libre). L’accueil propose « Rejoindre la table » si une soirée est ouverte.',
    ],
    tech: [
      'Table online : `stageEvents`, sablier `waitingOnTable`, `announceSceneBeat` via `tablePin`.',
      'Sprites CC0 Kenney Tiny Dungeon `public/sprites/kenney-tiny-dungeon/`. `GET /me/home-summary` + `liveTable`.',
      'Hub : prochaine action aussi pour le MJ. Copy joueur sans jargon `/play`.',
    ],
  },
  {
    version: '1.468',
    date: '2026-11-17',
    title: 'Rechargement franc après une mise à jour',
    player: [
      'Quand le site a été mis à jour, une bannière propose de recharger — vous n’êtes plus coincé sur une ancienne page.',
      '« Plus tard » masque la bannière une heure ; elle revient ensuite si la nouvelle version est toujours là.',
    ],
    tech: [
      '`PwaLifecycleService` : `checkForUpdate` toutes les 5 min + onglet visible ; `unrecoverable` → reload.',
      'Recharger : `activateUpdate` puis `clearAppCaches` (unregister SW + Cache Storage) avant `location.reload`.',
      'Snooze 1 h `localStorage` `dg-pwa-update-snooze`. SW `registerWhenStable:5000`.',
    ],
  },
  {
    version: '1.467',
    date: '2026-11-17',
    title: 'Admin : disque, charge et file support',
    player: [],
    tech: [
      'Stats : `hostDisk*` + `load1/5/15`, `supportDesk` (à traiter / attente joueur / catégories / plus ancien).',
      'Desk tickets : file « À traiter » par défaut, recherche, tri du plus ancien, pastille d’attente, tickets > 48 h en orange.',
      '`GET /admin/support/tickets` : `lastFromStaff`. `SupportDeskStats` + `/proc/loadavg` / `DriveInfo("/")`.',
    ],
  },
  {
    version: '1.466',
    date: '2026-11-17',
    title: 'Admin : observabilité serveur et IA',
    player: [],
    tech: [
      'Admin Statistiques : RAM VPS (`/proc/meminfo`), RAM cgroup API, CPU, uptime, trafic HTTP (depuis restart), tokens IA persistés.',
      '`GET /admin/stats` : `server` (`hostMemoryTotalBytes`/`hostMemoryAvailableBytes`, `http`, tokens). Migration `026_ai_generation_tokens`.',
      '`HttpRequestMetricsMiddleware` + `HostResourceSampler` ; `AiGenerationLogs` colonnes tokens/modèle/latence.',
    ],
  },
  {
    version: '1.465',
    date: '2026-11-17',
    title: 'Support : pastilles de statut alignées',
    player: [
      'Sur Support, les étiquettes Ouvert / En cours / Fermé ont le même format — plus de « Le support consulte » en gros bandeau.',
    ],
    tech: [
      '`supportStatusLabel` : `in_progress` → « En cours » (joueur et desk). `supportStatusBadgeClass` chips outline identiques.',
    ],
  },
  {
    version: '1.464',
    date: '2026-11-17',
    title: 'Barre : plus de doublons de création',
    player: [
      'La barre affiche Campagnes, Héros et Donjons — plus de menu Création.',
      'Pour forger un héros, passez par Héros ; pour un nouveau scénario, passez par Campagnes.',
      'Les textes générés par l’IA passent uniquement par le cloud (plus de moteur local).',
    ],
    tech: [
      'Navbar : plus de `nav-creation` / `creationLinks` ; `workshopLinks` = `/characters`, `/dungeons`.',
      '`isNavPathActive` : `/create` → Héros, `/story/create` → Campagnes. Menu contextuel aligné.',
      'Ollama retiré des compose local/prod/e2e ; `LocalLlm`, `OllamaWarmupWorker` et le stream local supprimés. Groq (+ Gemini si clé).',
    ],
  },
  {
    version: '1.463',
    date: '2026-10-11',
    title: 'CI : couverture fiche PDF',
    player: [],
    tech: [
      'Karma branches : specs `format-sheet-feature`, `class-resource-labels`, `downloadPdf` (seuil 90 %).',
    ],
  },
  {
    version: '1.462',
    date: '2026-10-11',
    title: 'Fiche : PDF en un clic et aptitudes lisibles',
    player: [
      'Sur la fiche d’un héros, le bouton PDF est de nouveau entre « Mes héros » et « Modifier ».',
      'Page Aptitudes : les styles de combat, l’ennemi juré et les terrains du rôdeur s’affichent en français, sans codes techniques.',
    ],
    tech: [
      'Sheet : `data-testid="sheet-download-pdf"` → `PdfGeneratorService.generatePdf`.',
      'PDF p2 : `foldFeaturesForSheet` + `textFit` noms ; masque `enemy_count`/`terrain_count`.',
    ],
  },
  {
    version: '1.461',
    date: '2026-10-11',
    title: 'Nouveautés à portée de main, guide recentré',
    player: [
      'Les nouveautés de chaque version sont sur la page d’accueil et dans le menu du compte, à côté des paramètres et du support.',
      'Le guide s’affiche comme les autres pages : au centre, sans barre latérale à part.',
    ],
    tech: [
      'Lien `/patch-notes` dans le menu compte (desktop + mobile) et teaser accueil (`PatchNotesList` `limit=1`).',
      'Guide : plus de rail gauche ; colonne `max-w-3xl` ; sommaire repliable sur les fiches/livrets (`showOutline`).',
    ],
  },
  {
    version: '1.460',
    date: '2026-10-10',
    title: 'Fiche page 2 : maîtrises d’armure lisibles',
    player: [
      'Sur la fiche (page Aptitudes), les maîtrises d’armure tiennent dans la colonne de gauche et n’empiètent plus sur les résistances.',
      'Le site s’affiche un peu plus vite au premier chargement (messages et session se chargent ensuite).',
    ],
    tech: [
      'PDF page 2 : `textFit` sur armures/armes (police 11→7, largeur max 230 px avant `resX`).',
      'Warnings Angular NG8102/NG8107/NG8113 : `??`/`?.` inutiles et `RouterLink` morts (Background/Deity/Feat by-id).',
      'Bundle initial ~800→699 kB : docks messages/session en `@defer (on idle)`. jsPDF : `externalDependencies` canvg+html2canvas (exports JPEG uniquement, plus d’alertes CommonJS). CSS FullCalendar reste global (encapsulation Angular casse le thème). Budget warning 700 kB.',
    ],
  },
  {
    version: '1.459',
    date: '2026-10-10',
    title: 'CI e2e : un seul pull d’image',
    player: [],
    tech: [
      'E2e CI : plus de second `docker pull` `nginx:alpine` (429 ECR anonyme). Un seul prefetch `node:24-alpine`, stubs MailHog/Ollama + `Dockerfile.e2e` (nginx via apk Alpine).',
    ],
  },
  {
    version: '1.458',
    date: '2026-10-09',
    title: 'Annonces, notes de version et confort d’affichage',
    player: [
      'Nouvelle page « Nouveautés » : retrouvez ici tout ce qui change à chaque version.',
      'Bandeau d’annonces en haut du site (maintenance, incident…). Un clic dessus le masque ; le message reste dans vos notifications.',
      'Atlas : la liste des civilisations est plus compacte et laisse toute la place à la carte, sur téléphone la carte passe en premier.',
      'Récap du personnage : l’aperçu de la fiche s’affiche en entier à l’écran, du haut jusqu’en bas, sans avoir à défiler.',
      'Création d’aventure : la carte occupe toute la largeur et n’affiche plus de coin disgracieux en haut à gauche quand on zoome.',
    ],
    tech: [
      'API : table `SiteAnnouncements` (migration 025), `GET /announcements/active` anonyme, CRUD `/admin/announcements` (create / end / delete), sévérités info|warning|outage, durée 1–60 j.',
      'Notifications : les annonces actives sont injectées dans `/me/notifications` (kind `announcement`, clé `announcement-{id}`) ; compteurs serveur inchangés.',
      'Web : `SiteAnnouncementService` (poll 5 min + focus, dismiss localStorage `dragons-announcements-dismissed`), bannière `data-dg-banner` dans `app.html`, onglets admin « Annonces » et « Patch notes ».',
      'Patch notes : source unique `core/data/patch-notes.ts`, page publique `/patch-notes`, lien dans le footer.',
      'Bundle Iconify offline régénéré (`npm run icons:bundle`) pour l’icône `fluent-emoji:loudspeaker` des annonces.',
      'Atlas : liste civilisations en grille compacte sans `lore.fullDescription` (liste + tooltip), recherche limitée au nom et aux tags.',
      '`PdfPagePreview` : input `fitPage` (fit hauteur via sonde CSS `--pdf-fit-height`), output `pageRendered`, re-rendu au resize ; le récap cadre l’aperçu au premier rendu.',
      'Aventure : la carte et le rail d’étapes sortent du padding en full-bleed symétrique (suppression de `w-full` + marges négatives).',
      'CI e2e : images node/nginx préchargées depuis ECR public, MailHog/Ollama remplacés par des stubs `nginx:alpine` (`docker-compose.e2e.yml`), plus aucun pull Docker Hub.',
    ],
  },
  {
    version: '1.450',
    date: '2026-10-08',
    title: 'Support, connexion Google et vies de créatures',
    player: [
      'Connexion et inscription avec Google (choix du pseudo et consentement).',
      'Support repensé : conversation en plein écran, réponses en direct, catégories et bouton « Signaler » sur les générations.',
      'Les vies de créatures se génèrent une par une, en français, et seule celle qui échoue est relancée.',
      'Un message calme s’affiche quand l’IA est très sollicitée, au lieu d’une erreur.',
      'Fenêtre des messages entre amis : bouton de fermeture bien visible.',
      'Emojis toujours chargés, barres de défilement discrètes, Atlas plein écran corrigé sur téléphone.',
    ],
    tech: [
      'Google Sign-In (COOP autorisé pour la popup), pseudo + RGPD à l’inscription.',
      'Desk support : badges, fil live, catégories, comptes désactivables, réponse e-mail via SMTP, IMAP, téléchargement des backups VPS.',
      'IA : Ollama prioritaire (génération longue), bascule Groq si pas de premier token ; ids de modèles Gemini/Groq retirés remplacés (Groq qwen3.8) ; stats admin.',
      'Ops : alertes e-mail coupées au profit du journal admin, snapshot 3 h réellement exécuté, autoheal ignore les 301 HTTP→HTTPS, Ollama ne fait plus tomber la prod.',
    ],
  },
  {
    version: '1.424',
    date: '2026-10-07',
    title: 'Stabilité du site et premier guichet support',
    player: [
      'Ouverture du support : vous pouvez nous écrire directement depuis le site.',
      'Recherche dans tout le Codex.',
      'Réponse aux invitations de séance directement depuis l’e-mail.',
      'Le numéro de version apparaît en bas de page.',
      'Le site reste disponible même quand l’IA est très chargée.',
    ],
    tech: [
      'Desk tickets + tables ops + packs diagnostic Cursor.',
      'RSVP par mail, backup SQLite zip quotidien, version footer = nombre de commits.',
      'Autoheal des conteneurs, watchdog externe, DNS/logs/cron, renouvellement Let’s Encrypt (HTTP-01).',
      'Perf : requêtes EF groupées, fin des 504 sur le catalogue ; health-check API depuis Docker.',
    ],
  },
  {
    version: '1.410',
    date: '2026-10-03',
    title: 'Fiches PDF et confort sur téléphone',
    player: [
      'Fiche PDF : page armes corrigée, récap plus large, nouvelle fiche « Compacte ».',
      'Choix du lieu depuis l’Atlas.',
      'Smileys disponibles hors ligne, interface plus compacte sur téléphone.',
      'L’étape équipement se récupère toute seule si elle était vide.',
    ],
    tech: [
      'Iconify offline, préférence PDF mobile de la forge, picker Atlas + Lieu.',
      'Fix `prevPhase` de classe et récupération de l’étape équipement vide.',
    ],
  },
  {
    version: '1.406',
    date: '2026-10-02',
    title: 'Forge rapide et grand lot de finitions',
    player: [
      'Création rapide de personnage : niveau et mode d’abord, puis directement le récap.',
      'Les prétirés de campagne ne se mélangent plus avec « Mes héros ».',
      'Accueil : la prochaine action à faire est mise en avant.',
      'Table de jeu : macros, minuteur de scène et message épinglé dans le chat.',
      'Nombreuses finitions sur Personnages, Campagnes, Donjons, Guide et Codex.',
    ],
    tech: [
      'Quotas magie, fiche par id, hub Codex, gestion des conflits de table.',
      'Découpage cartes/quotas (archi P0) et clusters de vérification P1/P2.',
      'CI Deploy accélérée, lint Angular débloqué.',
    ],
  },
  {
    version: '1.398',
    date: '2026-09-30',
    title: 'Outils du MJ à la table',
    player: [
      'Ordre de tour réorganisable librement.',
      'Tiroir secret du MJ pendant la partie.',
      'Fiche PDF plus soignée et table de jeu plus agréable.',
    ],
    tech: ['Gate de couverture CI restaurée, quick wins MJ sur `/play`, retours e2e.'],
  },
  {
    version: '1.395',
    date: '2026-09-29',
    title: 'Expérience, agenda et portraits',
    player: [
      'Passage de niveau directement depuis la table.',
      'Partage des présences (RSVP) dans la discussion entre amis.',
      'Choix du portrait de pion et impression de fiche améliorés.',
      'Agenda personnel, même sans campagne.',
    ],
    tech: [
      'Activité `combat_ended`, pack de préparation de soirée, budgets de timeout Ollama.',
    ],
  },
  {
    version: '1.390',
    date: '2026-09-27',
    title: 'Agenda, présences et partage de donjons',
    player: [
      'Agenda global et calendrier de table, export vers votre agenda.',
      'Réponses de présence (RSVP), rappels et séances récurrentes.',
      'Mode spectateur à la table et galerie.',
      'Partage public des donjons par lien.',
      'Annuler ou laisser tourner une génération IA en arrière-plan.',
      'Carte d’Eana plus nette au zoom.',
    ],
    tech: [
      'FullCalendar (thème sombre, grille 12 h–22 h), ICS, RRULE.',
      'Clés IA personnelles (BYOK), batch d’histoires de créatures durci, archivage des campagnes.',
    ],
  },
];

export const LATEST_PATCH_NOTE: PatchNote | undefined = PATCH_NOTES[0];
