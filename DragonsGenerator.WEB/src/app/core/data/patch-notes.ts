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
