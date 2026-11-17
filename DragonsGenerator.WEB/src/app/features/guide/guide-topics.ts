import type { GuideAudience, GuideNavGroup, GuideStep } from './guide.types';
import {
  GUIDE_ALL_NAV,
  GUIDE_BLOG_POSTS,
  GUIDE_CAMPAIGN_MJ_FLOW,
  GUIDE_CAMPAIGN_PLAYER_FLOW,
  GUIDE_CHARACTER_STEPS,
  GUIDE_COMBAT_FLOW,
  GUIDE_DUNGEON_GEN_STEPS,
  GUIDE_FEATURE_INDEX,
  GUIDE_FAQ_ITEMS,
  GUIDE_FLASH_CARDS,
  GUIDE_GLOSSARY,
  GUIDE_NAV_GROUPS,
  GUIDE_NOTIFICATION_EVENTS,
  GUIDE_ONESHOT_STEPS,
  GUIDE_PROPOSAL_FLOW,
  GUIDE_QUICK_CARDS,
  GUIDE_START_STEPS,
  GUIDE_TABLE_PLAY_STEPS,
  GUIDE_TIPS,
  isGuideBlogPostNew,
} from './guide-content';
import { CODEX_NAV_LINKS } from '@core/config/codex-nav';

export interface GuideTopicLink {
  label: string;
  path: string;
  hint?: string;
}

export interface GuideTopicFlash {
  title: string;
  bullets: string[];
  icon: string;
}

export interface GuideTopic {
  id: string;
  title: string;
  summary: string;
  icon: string;
  accent: string;
  audience: GuideAudience;
  groupId: string;
  groupLabel: string;
  tags: string[];
  paragraphs: string[];
  steps: GuideStep[];
  links: GuideTopicLink[];
  flow: string[];
  flashes: GuideTopicFlash[];
}

function groupOf(sectionId: string): GuideNavGroup | undefined {
  return GUIDE_NAV_GROUPS.find((g) => g.sectionIds.includes(sectionId));
}

function summaryFor(sectionId: string, fallback: string): string {
  const hit = GUIDE_FEATURE_INDEX.find((i) => i.sectionId === sectionId);
  return hit?.description ?? fallback;
}

function flashesFor(id: string, audience: GuideAudience): GuideTopicFlash[] {
  return GUIDE_FLASH_CARDS.filter(
    (f) =>
      f.sectionId === id &&
      (f.audience === 'all' || audience === 'all' || f.audience === audience),
  ).map((f) => ({ title: f.title, bullets: f.bullets, icon: f.icon }));
}

function contentFor(id: string): Pick<
  GuideTopic,
  'paragraphs' | 'steps' | 'links' | 'flow'
> {
  switch (id) {
    case 'demarrage':
      return {
        paragraphs: [
          'Dragons Generator sert à forger un héros, tenir une campagne, et jouer une soirée à la même table : carte, présence, dés, combat.',
          'Compte, héros, puis campagne. La table (carte de soirée, combat) n’existe que quand une session est ouverte.',
        ],
        steps: GUIDE_START_STEPS,
        links: [
          { label: 'S’inscrire', path: '/register', hint: 'Compte cloud' },
          { label: 'Forger un héros', path: '/create', hint: 'Wizard' },
          { label: 'Mes campagnes', path: '/campaigns', hint: 'MJ & joueurs' },
          { label: 'Règles MJ (table)', path: '/guide/mj-table', hint: 'PDF IRL' },
          { label: 'Règles Joueur (table)', path: '/guide/joueur-table', hint: 'PDF IRL' },
          { label: 'Paramètres / push', path: '/settings', hint: 'Notifications' },
        ],
        flow: ['Compte', 'Héros', 'Campagne', 'Session', 'Combat'],
      };
    case 'parcours':
      return {
        paragraphs: [
          'Deux parcours : le MJ prépare et ouvre la table ; le joueur forge un héros, le propose, puis rejoint la soirée.',
          'Filtrez MJ / Joueur en haut du guide. La fiche « La table » décrit la soirée pour les deux.',
        ],
        steps: [
          {
            title: 'Parcours MJ',
            body: 'Campagne → inviter → valider les héros → (docs) → planifier → Entrer en session → carte de soirée → combat.',
            badge: 'MJ',
            link: '/campaigns',
            linkLabel: 'Campagnes',
          },
          {
            title: 'Parcours joueur',
            body: 'Héros → accepter l’invite → proposer la fiche → Ce soir / Rejoindre la table → initiative.',
            badge: 'Joueur',
            link: '/create',
            linkLabel: 'Créer un héros',
          },
        ],
        links: [
          { label: 'Feuille one-shot (PDF)', path: '/guide/oneshot' },
          { label: 'Mes amis', path: '/friends' },
        ],
        flow: [...GUIDE_CAMPAIGN_MJ_FLOW.slice(0, 3), '…', ...GUIDE_CAMPAIGN_PLAYER_FLOW.slice(0, 3)],
      };
    case 'oneshot-parcours':
      return {
        paragraphs: [
          'Objectif : une table prête en une soirée, de l’invitation à la fin de session.',
          'Suivez l’ordre MJ / Joueur ci-dessous ; activez les push pour ne rien rater.',
          'La feuille PDF « 1 feuille » reste sur /guide/oneshot.',
        ],
        steps: GUIDE_ONESHOT_STEPS.map((s) => ({
          title: s.title,
          body: s.detail,
          badge: s.role === 'MJ' ? 'MJ' : s.role === 'Joueur' ? 'Joueur' : 'Tous',
        })),
        links: [
          { label: 'Feuille 1 page (PDF)', path: '/guide/oneshot' },
          { label: 'Campagnes', path: '/campaigns' },
          { label: 'Amis & invites', path: '/friends' },
          { label: 'Notifications', path: '/settings?tab=notifications' },
        ],
        flow: GUIDE_ONESHOT_STEPS.map((s) => s.title),
      };
    case 'actions':
      return {
        paragraphs: [
          'Raccourcis « 30 secondes » pour les gestes les plus fréquents à la table.',
          'Chaque carte pointe vers la fiche détaillée du guide.',
        ],
        steps: GUIDE_FLASH_CARDS.slice(0, 6).map((f) => ({
          title: f.title,
          body: f.bullets.join(' · '),
          badge: f.audience === 'dm' ? 'MJ' : f.audience === 'player' ? 'Joueur' : 'Tous',
          link: `/guide/${f.sectionId}`,
          linkLabel: 'Voir la fiche',
        })),
        links: [
          { label: 'Campagnes', path: '/campaigns' },
          { label: 'Création héros', path: '/create' },
        ],
        flow: [],
      };
    case 'journal':
      return {
        paragraphs: [
          'Journal des nouveautés produit — tous les posts, du plus récent au plus ancien. Le badge Nouveau expire après 14 jours ou dès que vous ouvrez cette page.',
          ...GUIDE_TIPS.slice(0, 2),
        ],
        steps: GUIDE_BLOG_POSTS.map((p) => ({
          title: p.title,
          body: `${p.date} · ${p.tag} · ${p.summary}`,
          badge: isGuideBlogPostNew(p) ? ('Nouveau' as const) : undefined,
        })),
        links: [
          { label: 'Sommaire du guide', path: '/guide' },
          { label: 'Support', path: '/support' },
        ],
        flow: [],
      };
    case 'personnage':
      return {
        paragraphs: [
          'Le wizard couvre espèce → civilisation → historique → classe → caracs → compétences → équipement → langues → magie → identité → PDF.',
          'Sauvegarde cloud dès que vous êtes connecté ; la fiche PDF se télécharge à la fin.',
        ],
        steps: GUIDE_CHARACTER_STEPS.map((s) => ({
          ...s,
          link: '/create',
          linkLabel: 'Ouvrir le wizard',
        })),
        links: [
          { label: 'Forger un héros', path: '/create' },
          { label: 'Mes héros', path: '/characters' },
          { label: 'Espèces (codex)', path: '/species' },
          { label: 'Classes', path: '/classes' },
        ],
        flow: GUIDE_CHARACTER_STEPS.map((s) => s.title),
      };
    case 'scenario':
      return {
        paragraphs: [
          'Créez une campagne via l’assistant scénario ou « Campagne vide ». Invitez des amis, validez les personnages proposés.',
          'Les joueurs ont « Ce soir » : table ouverte, dernier récit, documents et héros. Les MJ préparent docs, cartes et rencontres — la carte peut aussi se créer pendant la session.',
        ],
        steps: [
          {
            title: 'Flux proposition de perso',
            body: GUIDE_PROPOSAL_FLOW.map((s) => `${s.role} : ${s.label}`).join(' → '),
            badge: 'Tous',
            link: '/campaigns',
            linkLabel: 'Campagnes',
          },
          {
            title: 'Flux MJ',
            body: GUIDE_CAMPAIGN_MJ_FLOW.join(' → '),
            badge: 'MJ',
          },
          {
            title: 'Flux joueur',
            body: GUIDE_CAMPAIGN_PLAYER_FLOW.join(' → '),
            badge: 'Joueur',
          },
        ],
        links: [
          { label: 'Mes campagnes', path: '/campaigns' },
          { label: 'Nouveau scénario', path: '/story/create' },
          { label: 'Amis', path: '/friends' },
        ],
        flow: GUIDE_CAMPAIGN_MJ_FLOW,
      };
    case 'table':
      return {
        paragraphs: [
          'Une session ouverte, c’est la table : tout le monde voit la carte de soirée, qui est connecté, et le combat quand il y en a un.',
          'MJ : Entrer en session, puis Générer ou choisir un donjon sans quitter. Glissez les héros. Notes et tracker restent là.',
          'Joueur : Rejoindre la table (accueil ou Ce soir). Vous voyez la carte ; le MJ déplace les pions. Initiative via le bandeau.',
        ],
        steps: GUIDE_TABLE_PLAY_STEPS.map((s) => ({
          title: s.label,
          body: s.detail,
          badge: (s.label === 'Carte' ? 'MJ' : 'Tous') as 'MJ' | 'Tous',
          link: '/campaigns',
          linkLabel: 'Ouvrir une campagne',
        })),
        links: [
          { label: 'Campagnes', path: '/campaigns' },
          { label: 'Combat', path: '/guide/initiative' },
          { label: 'Documents', path: '/guide/documents' },
        ],
        flow: GUIDE_TABLE_PLAY_STEPS.map((s) => s.label),
      };
    case 'donjons':
      return {
        paragraphs: [
          'Le plus simple : générer le donjon pendant la table (bouton Générer). La première carte devient celle de la soirée.',
          'Vous pouvez aussi préparer plus tôt dans Préparation → Donjons, puis attribuer la carte. Un document « Carte » publié, c’est une image à lire hors table.',
        ],
        steps: GUIDE_DUNGEON_GEN_STEPS,
        links: [
          { label: 'Campagnes (cartes)', path: '/campaigns', hint: 'Onglet Cartes' },
          { label: 'Documents', path: '/guide/documents' },
        ],
        flow: GUIDE_DUNGEON_GEN_STEPS.map((s) => s.title),
      };
    case 'initiative':
      return {
        paragraphs: [
          'Le MJ importe la party, collecte l’initiative ; les joueurs saisissent leur jet via bandeau ou notification.',
          'Puis PV, tours, et historique de combat en fin de rencontre.',
        ],
        steps: GUIDE_COMBAT_FLOW.map((s) => ({
          title: s.label,
          body: `Rôle : ${s.role}`,
          badge: s.role === 'MJ' ? 'MJ' : s.role === 'Joueurs' ? 'Joueur' : 'Tous',
        })),
        links: [
          { label: 'Actions de combat (codex)', path: '/combat-actions' },
          { label: 'Campagnes', path: '/campaigns' },
          { label: 'Notifications', path: '/notifications' },
        ],
        flow: GUIDE_COMBAT_FLOW.map((s) => s.label),
      };
    case 'documents':
      return {
        paragraphs: [
          'Documents : créer, publier, les joueurs sont notifiés. Une carte PNG peut être jointe.',
        ],
        steps: [
          {
            title: 'Publier',
            body: 'Documents → Créer → rédiger → Publier.',
            badge: 'MJ',
            link: '/campaigns',
            linkLabel: 'Campagnes',
          },
          {
            title: 'Lire',
            body: 'Onglet Documents de la campagne, ou notification push.',
            badge: 'Joueur',
          },
        ],
        links: [{ label: 'Campagnes', path: '/campaigns' }],
        flow: ['Créer', 'Publier', 'Push', 'Lecture'],
      };
    case 'social':
      return {
        paragraphs: ['Amis, chat, invitations de campagne et suggestions de compagnons de table.'],
        steps: [
          {
            title: 'Ajouter un ami',
            body: 'Recherche par pseudo / e-mail, puis demande.',
            link: '/friends',
            linkLabel: 'Amis',
          },
        ],
        links: [
          { label: 'Amis & messages', path: '/friends' },
          { label: 'Profil', path: '/profile' },
        ],
        flow: ['Recherche', 'Demande', 'Chat', 'Invite campagne'],
      };
    case 'notifications':
      return {
        paragraphs: [
          'Activez les push PWA dans Paramètres. Événements couverts :',
          ...GUIDE_NOTIFICATION_EVENTS.map((e) => `· ${e}`),
        ],
        steps: [
          {
            title: 'Activer',
            body: 'Paramètres → Notifications → autoriser le navigateur.',
            link: '/settings?tab=notifications',
            linkLabel: 'Paramètres',
          },
        ],
        links: [
          { label: 'Centre de notifications', path: '/notifications' },
          { label: 'Paramètres', path: '/settings' },
        ],
        flow: GUIDE_NOTIFICATION_EVENTS,
      };
    case 'codex':
      return {
        paragraphs: [
          'Le grimoire d’Eana : hub Codex, puis espèces, classes, sorts, bestiaire, équipements, compétences, dons, historiques, civilisations, combat, divinités.',
        ],
        steps: [],
        links: [
          { label: 'Hub Codex', path: '/codex' },
          ...CODEX_NAV_LINKS.map((l) => ({ label: l.label, path: l.path })),
        ],
        flow: [],
      };
    case 'pdf':
      return {
        paragraphs: [
          'En fin de wizard : aperçu, sauvegarde cloud, téléchargement fiche et grimoire PDF.',
        ],
        steps: [
          {
            title: 'Exporter',
            body: 'Terminez toutes les étapes → vérifier l’aperçu → télécharger.',
            link: '/create',
            linkLabel: 'Wizard',
          },
        ],
        links: [
          { label: 'Créer un héros', path: '/create' },
          { label: 'Mes héros', path: '/characters' },
        ],
        flow: ['Aperçu', 'Sauvegarder', 'PDF'],
      };
    case 'faq':
      return {
        paragraphs: [
          'Questions fréquentes — ouvrez une entrée pour la réponse complète. Support si besoin.',
        ],
        steps: GUIDE_FAQ_ITEMS.map((f) => ({
          title: f.question,
          body: f.answer,
          badge: f.audience === 'dm' ? 'MJ' : f.audience === 'player' ? 'Joueur' : 'Tous',
        })),
        links: [
          { label: 'Support', path: '/support' },
          { label: 'Glossaire', path: '/guide/glossaire' },
        ],
        flow: [],
      };
    case 'glossaire':
      return {
        paragraphs: ['Termes du site — ouvrez une entrée pour la définition.'],
        steps: GUIDE_GLOSSARY.map((g) => ({
          title: g.term,
          body: g.definition,
        })),
        links: [
          { label: 'FAQ', path: '/guide/faq' },
          { label: 'Index', path: '/guide/index' },
        ],
        flow: [],
      };
    case 'index':
      return {
        paragraphs: ['Index des fonctionnalités : chaque entrée mène à la fiche concernée ou à l’outil Codex.'],
        steps: GUIDE_FEATURE_INDEX.map((i) => ({
          title: i.label,
          body: i.description,
          badge: i.audience === 'dm' ? 'MJ' : i.audience === 'player' ? 'Joueur' : 'Tous',
          link: i.href ?? `/guide/${i.sectionId}`,
          linkLabel: i.href ? 'Ouvrir' : 'Guide',
        })),
        links: [
          ...CODEX_NAV_LINKS.map((l) => ({ label: l.label, path: l.path, hint: l.blurb })),
          ...GUIDE_QUICK_CARDS.map((c) => ({ label: c.title, path: c.link, hint: c.description })),
        ],
        flow: [],
      };
    case 'support':
      return {
        paragraphs: [
          'Bug, question ou suggestion : ouvrez un ticket. Joignez éventuellement un personnage.',
        ],
        steps: [
          {
            title: 'Contacter le support',
            body: 'Décrivez le contexte (page, campagne, navigateur).',
            link: '/support',
            linkLabel: 'Ouvrir le support',
          },
        ],
        links: [
          { label: 'Support', path: '/support' },
          { label: 'Confidentialité', path: '/legal/privacy' },
          { label: 'CGU', path: '/legal/terms' },
        ],
        flow: [],
      };
    case 'compte':
      return {
        paragraphs: [
          'Compte, profil, paramètres. Connexion e-mail ou Google : même adresse = même compte.',
        ],
        steps: [
          {
            title: 'Profil public',
            body: 'Personnalisez votre présence à la table.',
            link: '/profile',
            linkLabel: 'Profil',
          },
          {
            title: 'Paramètres',
            body: 'Sécurité (mot de passe même après Google), notifications, données du compte.',
            link: '/settings',
            linkLabel: 'Paramètres',
          },
        ],
        links: [
          { label: 'Profil', path: '/profile' },
          { label: 'Paramètres', path: '/settings' },
          { label: 'Inscription', path: '/register' },
        ],
        flow: [],
      };
    case 'schemas':
      return {
        paragraphs: [
          'Schémas de flux utiles pour visualiser qui fait quoi (MJ vs joueur). Chaque étape ci-dessous est une case du parcours — pas une phrase concaténée.',
        ],
        steps: [
          ...GUIDE_PROPOSAL_FLOW.map((s, i) => ({
            title: `Proposition · ${i + 1}. ${s.label}`,
            body: `Rôle : ${s.role}`,
            badge: (s.role === 'MJ' ? 'MJ' : s.role.toLowerCase().includes('joueur') ? 'Joueur' : 'Tous') as
              | 'MJ'
              | 'Joueur'
              | 'Tous',
          })),
          ...GUIDE_COMBAT_FLOW.map((s, i) => ({
            title: `Combat · ${i + 1}. ${s.label}`,
            body: `Rôle : ${s.role}`,
            badge: (s.role === 'MJ' ? 'MJ' : s.role.toLowerCase().includes('joueur') ? 'Joueur' : 'Tous') as
              | 'MJ'
              | 'Joueur'
              | 'Tous',
          })),
        ],
        links: [
          { label: 'Campagnes', path: '/guide/scenario' },
          { label: 'Combat', path: '/guide/initiative' },
          { label: 'Actions de combat', path: '/combat-actions' },
        ],
        flow: GUIDE_PROPOSAL_FLOW.map((s) => s.label),
      };
    default: {
      const idx = GUIDE_FEATURE_INDEX.filter((i) => i.sectionId === id);
      return {
        paragraphs: idx.length
          ? idx.map((i) => `${i.label} — ${i.description}`)
          : [
              'Cette fiche explique le sujet. Utilisez les liens pour ouvrir l’outil correspondant dans l’app.',
              'Les commentaires ci-dessous sont des widgets : redimensionnez-les (1/3, 1/2, 1/1) et réordonnez-les.',
            ],
        steps: [],
        links: GUIDE_QUICK_CARDS.map((c) => ({ label: c.title, path: c.link })),
        flow: [],
      };
    }
  }
}

export const GUIDE_TOPICS: GuideTopic[] = GUIDE_ALL_NAV.map((nav) => {
  const group = groupOf(nav.id);
  const tags = [
    nav.audience === 'dm' ? 'mj' : nav.audience === 'player' ? 'joueur' : 'tous',
    group?.label.toLowerCase() ?? 'guide',
  ];
  const content = contentFor(nav.id);
  return {
    id: nav.id,
    title: nav.label,
    summary: summaryFor(nav.id, `Fiche guide · ${nav.label}`),
    icon: nav.icon,
    accent: nav.accent,
    audience: nav.audience,
    groupId: group?.id ?? 'reference',
    groupLabel: group?.label ?? 'Référence',
    tags,
    paragraphs: content.paragraphs,
    steps: content.steps,
    links: content.links,
    flow: content.flow,
    flashes: flashesFor(nav.id, nav.audience),
  };
});

export function getGuideTopic(id: string): GuideTopic | undefined {
  return GUIDE_TOPICS.find((t) => t.id === id);
}

export function guideTopicsByGroup(
  audience: GuideAudience | 'all',
  query: string,
  groupFilter: string | 'all',
): { groupId: string; groupLabel: string; topics: GuideTopic[] }[] {
  const q = query.trim().toLowerCase();
  const filtered = GUIDE_TOPICS.filter((t) => {
    if (audience !== 'all' && t.audience !== 'all' && t.audience !== audience) return false;
    if (groupFilter !== 'all' && t.groupId !== groupFilter) return false;
    if (!q) return true;
    return (
      t.title.toLowerCase().includes(q) ||
      t.summary.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.includes(q)) ||
      t.paragraphs.some((p) => p.toLowerCase().includes(q))
    );
  });

  const order = GUIDE_NAV_GROUPS.map((g) => g.id);
  const map = new Map<string, GuideTopic[]>();
  for (const t of filtered) {
    const list = map.get(t.groupId) ?? [];
    list.push(t);
    map.set(t.groupId, list);
  }

  return order
    .filter((id) => map.has(id))
    .map((id) => {
      const g = GUIDE_NAV_GROUPS.find((x) => x.id === id)!;
      return { groupId: id, groupLabel: g.label, topics: map.get(id)! };
    });
}
